import { parseSource } from './parser';
import type { RefactoringContext } from '../llm/LLMProvider';

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
