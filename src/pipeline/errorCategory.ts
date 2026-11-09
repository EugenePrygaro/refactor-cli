import type { FailureStage } from './RefactorPipeline';

export type ErrorCategory =
    | 'format'
    | 'generation_error'
    | 'rest_missing_mask'
    | 'rest_duplicate_mask'
    | 'rest_unknown_mask'
    | 'syntax'
    | 'hooks_rules'
    | 'hooks_deps'
    | 'this_remaining'
    | 'not_defined_or_missing_import'
    | 'invalid_hook_call'
    | 'test_assertion'
    | 'test_runtime_error'
    | 'test_timeout'
    | 'legacy_contract_failed'
    | 'infrastructure'
    | 'other';

export function categorizeError(
    stage: FailureStage,
    message: string,
    ruleId?: string,
): ErrorCategory {
    const text = message.toLowerCase();
    const rule = ruleId ?? extractRuleId(message);

    if (stage === 'Format') {
        return 'format';
    }
    if (stage === 'Generation') {
        return 'generation_error';
    }
    if (stage === 'Restoration') {
        if (/omit(?:ted)?|missing/.test(text)) {
            return 'rest_missing_mask';
        }
        if (/duplicat/.test(text)) {
            return 'rest_duplicate_mask';
        }
        if (/unknown|unexpected/.test(text)) {
            return 'rest_unknown_mask';
        }
        return 'other';
    }
    if (stage === 'Syntax') {
        return 'syntax';
    }
    if (
        stage === 'Infrastructure' &&
        /legacy_contract_failed|legacy behavior.*(?:fail|error)|legacy contract/.test(text)
    ) {
        return 'legacy_contract_failed';
    }

    if (rule === 'react-hooks/rules-of-hooks') {
        return 'hooks_rules';
    }
    if (rule === 'react-hooks/exhaustive-deps') {
        return 'hooks_deps';
    }
    if (/\bthis\b/.test(text) && /remaining|class instance|this\./.test(text)) {
        return 'this_remaining';
    }
    if (
        /\binvalid hook call\b/.test(text) ||
        /hooks can only be called inside/.test(text)
    ) {
        return 'invalid_hook_call';
    }
    if (
        /\breferenceerror\b/.test(text) ||
        /\bis not defined\b/.test(text) ||
        /cannot find module|failed to resolve import|cannot resolve module/.test(text)
    ) {
        return 'not_defined_or_missing_import';
    }
    if (/timed? ?out|timeout|exceeded.*time limit/.test(text)) {
        return 'test_timeout';
    }
    if (
        /assertionerror|assertion failed|expected .*received|expected .* to (?:be|equal|contain)|to be .*received/.test(
            text,
        )
    ) {
        return 'test_assertion';
    }
    if (
        /\b(?:typeerror|syntaxerror|rangeerror)\b/.test(text) ||
        /uncaught exception|unhandled rejection/.test(text)
    ) {
        return 'test_runtime_error';
    }
    if (stage === 'Infrastructure') {
        return 'infrastructure';
    }
    if (stage === 'Linter' || stage === 'Test') {
        return 'other';
    }
    return 'other';
}

function extractRuleId(message: string): string | undefined {
    return message.match(/\[(react-hooks\/[^\]]+)\]/)?.[1];
}
