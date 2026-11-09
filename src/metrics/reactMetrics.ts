import traverse from '@babel/traverse';
import type { Node, OptionalCallExpression } from '@babel/types';
import { parseSource } from '../ast/parser';

export interface ReactMetrics {
    classDeclarations: number;
    thisExpressions: number;
    useStateCalls: number;
    useEffectCalls: number;
    useLayoutEffectCalls: number;
    useCallbackCalls: number;
    useMemoCalls: number;
    useRefCalls: number;
    useContextCalls: number;
    useReducerCalls: number;
    customHookCalls: number;
}

const builtInHookNames = [
    'useState',
    'useEffect',
    'useLayoutEffect',
    'useCallback',
    'useMemo',
    'useRef',
    'useContext',
    'useReducer',
] as const;

type BuiltInHookName = (typeof builtInHookNames)[number];
type HookCallCounts = Record<BuiltInHookName, number>;

export function calculateReactMetrics(sourceCode: string): ReactMetrics {
    const hookCalls: HookCallCounts = {
        useState: 0,
        useEffect: 0,
        useLayoutEffect: 0,
        useCallback: 0,
        useMemo: 0,
        useRef: 0,
        useContext: 0,
        useReducer: 0,
    };
    let classDeclarations = 0;
    let thisExpressions = 0;
    let customHookCalls = 0;
    const builtIns = new Set<string>(builtInHookNames);

    traverse(parseSource(sourceCode), {
        ClassDeclaration() {
            classDeclarations++;
        },
        ThisExpression() {
            thisExpressions++;
        },
        CallExpression(path) {
            countHookCall(path.node.callee, hookCalls, builtIns, () => {
                customHookCalls++;
            });
        },
        OptionalCallExpression(path) {
            countHookCall(path.node.callee, hookCalls, builtIns, () => {
                customHookCalls++;
            });
        },
    });

    return {
        classDeclarations,
        thisExpressions,
        useStateCalls: hookCalls.useState,
        useEffectCalls: hookCalls.useEffect,
        useLayoutEffectCalls: hookCalls.useLayoutEffect,
        useCallbackCalls: hookCalls.useCallback,
        useMemoCalls: hookCalls.useMemo,
        useRefCalls: hookCalls.useRef,
        useContextCalls: hookCalls.useContext,
        useReducerCalls: hookCalls.useReducer,
        customHookCalls,
    };
}

function countHookCall(
    callee: Node | OptionalCallExpression['callee'],
    hookCalls: HookCallCounts,
    builtIns: ReadonlySet<string>,
    onCustomHook: () => void,
): void {
    const name = getCalleeName(callee);
    if (!name) {
        return;
    }

    if (builtIns.has(name)) {
        hookCalls[name as BuiltInHookName]++;
    } else if (/^use[A-Z]/.test(name)) {
        onCustomHook();
    }
}

function getCalleeName(callee: Node | OptionalCallExpression['callee']): string | undefined {
    if (callee.type === 'Identifier') {
        return callee.name;
    }

    if (
        (callee.type === 'MemberExpression' ||
            callee.type === 'OptionalMemberExpression') &&
        !callee.computed &&
        callee.property.type === 'Identifier'
    ) {
        return callee.property.name;
    }

    return undefined;
}
