import traverse from '@babel/traverse';
import type {
    ClassBody,
    ClassDeclaration,
    ClassExpression,
} from '@babel/types';
import { parseSource } from './parser';

type ClassNode = ClassExpression | ClassDeclaration;

export function isClassComponent(sourceCode: string): boolean {
    let found = false;

    traverse(parseSource(sourceCode), {
        ClassDeclaration(path) {
            if (isReactComponentClass(path.node)) {
                found = true;
                path.stop();
            }
        },
        ClassExpression(path) {
            if (isReactComponentClass(path.node)) {
                found = true;
                path.stop();
            }
        },
    });

    return found;
}

function isReactComponentClass(node: ClassNode): boolean {
    return isReactComponentSuperclass(node.superClass) &&
        node.body.body.some((member) => isRenderMethod(member));
}

function isReactComponentSuperclass(
    node: ClassNode['superClass'],
): boolean {
    if (!node) {
        return false;
    }

    if (node.type === 'Identifier') {
        return node.name === 'Component' || node.name === 'PureComponent';
    }

    return (
        node.type === 'MemberExpression' &&
        !node.computed &&
        node.object.type === 'Identifier' &&
        node.object.name === 'React' &&
        (node.property.type === 'Identifier') &&
        (node.property.name === 'Component' ||
            node.property.name === 'PureComponent')
    );
}

function isRenderMethod(member: ClassBody['body'][number]): boolean {
    if (
        member.type !== 'ClassMethod' &&
        member.type !== 'TSDeclareMethod'
    ) {
        return false;
    }
    if (member.computed) {
        return false;
    }
    return (
        (member.key.type === 'Identifier' && member.key.name === 'render') ||
        (member.key.type === 'StringLiteral' && member.key.value === 'render')
    );
}
