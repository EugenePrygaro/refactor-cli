import traverse from '@babel/traverse';
import type {
    ClassBody,
    ClassDeclaration,
    ClassExpression,
    ClassMethod,
    ClassProperty,
    ClassPrivateProperty,
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
    if (member.type === 'ClassMethod' || member.type === 'TSDeclareMethod') {
        return !member.computed && isRenderKey(member.key);
    }
    if (member.type === 'ClassProperty') {
        return (
            !member.computed &&
            isRenderKey(member.key) &&
            isFunctionValue(member.value)
        );
    }
    if (member.type === 'ClassPrivateProperty') {
        return isRenderKey(member.key) && isFunctionValue(member.value);
    }
    return false;
}

function isRenderKey(
    key: ClassMethod['key'] | ClassProperty['key'] | ClassPrivateProperty['key'],
): boolean {
    return (
        (key.type === 'Identifier' && key.name === 'render') ||
        (key.type === 'StringLiteral' && key.value === 'render') ||
        (key.type === 'PrivateName' && key.id.name === 'render')
    );
}

function isFunctionValue(
    value: ClassProperty['value'] | ClassPrivateProperty['value'],
): boolean {
    return (
        value?.type === 'ArrowFunctionExpression' ||
        value?.type === 'FunctionExpression'
    );
}
