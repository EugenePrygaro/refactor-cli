import traverse from '@babel/traverse';
import type { NodePath } from '@babel/traverse';
import type {
    JSXElement,
    JSXFragment,
    MemberExpression,
    Node,
    OptionalMemberExpression,
} from '@babel/types';
import { parseSource } from './parser';
import type {
    JSXDependencyContract,
    RefactoringContext,
} from '../llm/LLMProvider';

export interface JSXMaskingResult {
    maskedCode: string;
    jsxMap: Record<string, string>;
    dependencyContract: JSXDependencyContract;
}

export function sliceContext(sourceCode: string): RefactoringContext {
    const ast = parseSource(sourceCode);
    const imports: string[] = [];
    const codeStatements: string[] = [];
    const statements = [...ast.program.directives, ...ast.program.body].sort(
        (left, right) => getStart(left) - getStart(right),
    );

    for (const node of statements) {
        const statement = getSourceText(sourceCode, node.start, node.end);
        if (!statement) {
            continue;
        }

        if (node.type === 'ImportDeclaration') {
            imports.push(statement);
            continue;
        }

        codeStatements.push(statement);
    }

    return {
        originalCode: codeStatements.join('\n\n'),
        imports,
    };
}

export function maskJSX(sourceCode: string): JSXMaskingResult {
    const ast = parseSource(sourceCode);
    const candidates: SourceRange[] = [];
    const dependencyContract = createDependencyContract();

    traverse(ast, {
        JSXElement(path) {
            if (hasJSXAncestor(path) || !hasReturnAncestor(path)) {
                return;
            }
            const range = getNodeRange(path.node);
            candidates.push(range);
            collectJSXDependencies(
                sourceCode.slice(range.start, range.end),
                dependencyContract,
            );
        },
        JSXFragment(path) {
            if (hasJSXAncestor(path) || !hasReturnAncestor(path)) {
                return;
            }
            const range = getNodeRange(path.node);
            candidates.push(range);
            collectJSXDependencies(
                sourceCode.slice(range.start, range.end),
                dependencyContract,
            );
        },
    });

    const ranges = candidates.sort((left, right) => left.start - right.start);
    const jsxMap: Record<string, string> = {};
    const usedKeys = new Set<string>();
    const replacements: SourceReplacement[] = [];

    for (const range of ranges) {
        const key = createMaskKey(sourceCode, Object.keys(jsxMap).length, usedKeys);
        usedKeys.add(key);
        const jsx = sourceCode.slice(range.start, range.end);
        jsxMap[key] = jsx;
        replacements.push({
            ...range,
            replacement: `<${key} />`,
        });
    }

    return {
        maskedCode: applyReplacements(sourceCode, replacements),
        jsxMap,
        dependencyContract: sortDependencyContract(dependencyContract),
    };
}

export function restoreJSX(
    refactoredCode: string,
    jsxMap: Record<string, string>,
): string {
    const keys = Object.keys(jsxMap);
    if (keys.length === 0) {
        return refactoredCode;
    }

    for (const key of keys) {
        if (!/^JSX_MASK_\d+$/.test(key)) {
            throw new Error(`Invalid JSX mask key "${key}".`);
        }
        assertJSXExpression(jsxMap[key], key);
    }

    const replacements: SourceReplacement[] = [];
    const occurrences = new Map<string, number>();
    const expectedKeys = new Set(keys);

    traverse(parseSource(refactoredCode), {
        JSXElement(path) {
            const name = path.node.openingElement.name;
            if (name.type !== 'JSXIdentifier' || !/^JSX_MASK_\d+$/.test(name.name)) {
                return;
            }

            if (!expectedKeys.has(name.name)) {
                throw new Error(`Unexpected JSX placeholder "${name.name}".`);
            }

            occurrences.set(name.name, (occurrences.get(name.name) ?? 0) + 1);
            replacements.push({
                ...getNodeRange(path.node),
                replacement: adaptThisReferences(jsxMap[name.name]),
            });
        },
    });

    for (const key of keys) {
        const count = occurrences.get(key) ?? 0;
        if (count !== 1) {
            throw new Error(
                count === 0
                    ? `The LLM response omitted JSX placeholder "${key}".`
                    : `The LLM response duplicated JSX placeholder "${key}" ${count} times.`,
            );
        }
    }

    return applyReplacements(refactoredCode, replacements);
}

interface SourceRange {
    start: number;
    end: number;
}

interface SourceReplacement extends SourceRange {
    replacement: string;
}

type ThisMemberExpression = MemberExpression | OptionalMemberExpression;

const JSX_PREFIX = 'const __jsx = ';

function createDependencyContract(): JSXDependencyContract {
    return {
        requiredProps: [],
        requiredState: [],
        requiredMethods: [],
        unresolvedAccesses: [],
    };
}

function collectJSXDependencies(
    jsxSource: string,
    contract: JSXDependencyContract,
): void {
    const ast = parseSource(`${JSX_PREFIX}${jsxSource};`);
    traverse(ast, {
        MemberExpression(path) {
            if (isObjectOfMemberParent(path)) {
                return;
            }
            collectDependency(path.node, contract);
        },
        OptionalMemberExpression(path) {
            if (isObjectOfMemberParent(path)) {
                return;
            }
            collectDependency(path.node, contract);
        },
    });
}

function isObjectOfMemberParent(path: NodePath<ThisMemberExpression>): boolean {
    const parent = path.parentPath;
    return Boolean(
        parent &&
            (parent.isMemberExpression() || parent.isOptionalMemberExpression()) &&
            parent.node.object === path.node,
    );
}

function collectDependency(
    node: ThisMemberExpression,
    contract: JSXDependencyContract,
): void {
    const chain = getThisMemberChain(node);
    if (!chain) {
        return;
    }

    const [rootName, memberName] = chain.properties;
    if (rootName === 'state' || rootName === 'props') {
        if (chain.properties.length === 1) {
            contract.unresolvedAccesses.push(`this.${rootName} (whole object)`);
        } else if (memberName === undefined) {
            contract.unresolvedAccesses.push(`this.${rootName}[dynamic]`);
        } else if (rootName === 'state') {
            contract.requiredState.push(memberName);
        } else {
            contract.requiredProps.push(memberName);
        }
        return;
    }

    if (rootName !== undefined) {
        contract.requiredMethods.push(rootName);
    } else {
        contract.unresolvedAccesses.push('this[dynamic]');
    }
}

function adaptThisReferences(jsxSource: string): string {
    const replacements: SourceReplacement[] = [];
    const ast = parseSource(`${JSX_PREFIX}${jsxSource};`);
    traverse(ast, {
        MemberExpression(path) {
            collectThisReplacement(path.node, replacements);
        },
        OptionalMemberExpression(path) {
            collectThisReplacement(path.node, replacements);
        },
    });

    return applyReplacements(jsxSource, replacements);
}

function collectThisReplacement(
    node: ThisMemberExpression,
    replacements: SourceReplacement[],
): void {
    const chain = getThisMemberChain(node);
    if (!chain) {
        return;
    }

    const [rootName, memberName] = chain.properties;
    let replacement: string | undefined;
    if (
        (rootName === 'state' || rootName === 'props') &&
        memberName !== undefined &&
        chain.properties.length === 2
    ) {
        replacement = memberName;
    } else if (
        rootName !== undefined &&
        rootName !== 'state' &&
        rootName !== 'props' &&
        chain.properties.length === 1
    ) {
        replacement = rootName;
    }

    if (replacement === undefined) {
        return;
    }

    const range = getNodeRange(node);
    replacements.push({
        start: range.start - JSX_PREFIX.length,
        end: range.end - JSX_PREFIX.length,
        replacement,
    });
}

interface ThisMemberChain {
    properties: (string | undefined)[];
}

function getThisMemberChain(node: ThisMemberExpression): ThisMemberChain | undefined {
    const properties: (string | undefined)[] = [];
    let current: Node = node;

    while (isThisMemberExpression(current)) {
        properties.push(getStaticMemberName(current));
        current = current.object;
    }

    if (current.type !== 'ThisExpression') {
        return undefined;
    }

    return { properties: properties.reverse() };
}

function isThisMemberExpression(node: Node): node is ThisMemberExpression {
    return node.type === 'MemberExpression' || node.type === 'OptionalMemberExpression';
}

function getStaticMemberName(node: ThisMemberExpression): string | undefined {
    if (!node.computed && node.property.type === 'Identifier') {
        return node.property.name;
    }
    if (node.computed && node.property.type === 'StringLiteral') {
        return node.property.value;
    }
    if (node.computed && node.property.type === 'NumericLiteral') {
        return String(node.property.value);
    }
    return undefined;
}

function sortDependencyContract(
    contract: JSXDependencyContract,
): JSXDependencyContract {
    return {
        requiredProps: [...new Set(contract.requiredProps)].sort(),
        requiredState: [...new Set(contract.requiredState)].sort(),
        requiredMethods: [...new Set(contract.requiredMethods)].sort(),
        unresolvedAccesses: [...new Set(contract.unresolvedAccesses)].sort(),
    };
}

function hasJSXAncestor(
    path: NodePath<JSXElement | JSXFragment>,
): boolean {
    return path.findParent(
        (parent) => parent.isJSXElement() || parent.isJSXFragment(),
    ) !== null;
}

function hasReturnAncestor(
    path: NodePath<JSXElement | JSXFragment>,
): boolean {
    return path.findParent((parent) => parent.isReturnStatement()) !== null;
}

function getNodeRange(node: Node): SourceRange {
    if (node.start === null || node.start === undefined ||
        node.end === null || node.end === undefined) {
        throw new Error('The parser did not provide source offsets for a JSX node.');
    }
    return { start: node.start, end: node.end };
}

function createMaskKey(
    sourceCode: string,
    initialIndex: number,
    usedKeys: ReadonlySet<string>,
): string {
    let index = initialIndex;
    let key = `JSX_MASK_${index}`;
    while (sourceCode.includes(key) || usedKeys.has(key)) {
        index++;
        key = `JSX_MASK_${index}`;
    }
    return key;
}

function assertJSXExpression(sourceCode: string, key: string): void {
    const statement = parseSource(sourceCode).program.body[0];
    if (
        statement?.type !== 'ExpressionStatement' ||
        (statement.expression.type !== 'JSXElement' &&
            statement.expression.type !== 'JSXFragment')
    ) {
        throw new Error(`The value for JSX placeholder "${key}" is not a JSX expression.`);
    }
}

function applyReplacements(
    sourceCode: string,
    replacements: SourceReplacement[],
): string {
    const orderedReplacements = [...replacements].sort(
        (left, right) => right.start - left.start,
    );
    let result = sourceCode;
    let previousStart = sourceCode.length;

    for (const replacement of orderedReplacements) {
        if (
            replacement.start < 0 ||
            replacement.end > previousStart ||
            replacement.start > replacement.end
        ) {
            throw new Error('JSX source ranges overlap or are invalid.');
        }
        result =
            result.slice(0, replacement.start) +
            replacement.replacement +
            result.slice(replacement.end);
        previousStart = replacement.start;
    }

    return result;
}

function getStart(node: { start?: number | null }): number {
    if (node.start === null || node.start === undefined) {
        throw new Error('The parser did not provide a start offset for a source node.');
    }
    return node.start;
}

function getSourceText(
    sourceCode: string,
    start: number | null | undefined,
    end: number | null | undefined,
): string {
    if (
        start === null ||
        start === undefined ||
        end === null ||
        end === undefined
    ) {
        throw new Error('The parser did not provide source offsets for a source node.');
    }
    return sourceCode.slice(start, end).trim();
}
