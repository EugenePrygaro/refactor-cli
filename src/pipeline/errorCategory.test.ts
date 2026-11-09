import { describe, expect, it } from 'vitest';
import { categorizeError, type ErrorCategory } from './errorCategory';
import type { FailureStage } from './RefactorPipeline';

describe('categorizeError', () => {
    const cases: {
        category: ErrorCategory;
        stage: FailureStage;
        message: string;
        ruleId?: string;
    }[] = [
        { category: 'format', stage: 'Format', message: 'Response was empty.' },
        { category: 'generation_error', stage: 'Generation', message: 'HTTP 400' },
        { category: 'rest_missing_mask', stage: 'Restoration', message: 'omitted JSX_MASK_0' },
        { category: 'rest_duplicate_mask', stage: 'Restoration', message: 'duplicated JSX_MASK_0' },
        { category: 'rest_unknown_mask', stage: 'Restoration', message: 'unexpected JSX_MASK_7' },
        { category: 'syntax', stage: 'Syntax', message: 'Unexpected token (2:4)' },
        {
            category: 'hooks_rules',
            stage: 'Linter',
            ruleId: 'react-hooks/rules-of-hooks',
            message: 'React Hook useState is called conditionally',
        },
        {
            category: 'hooks_deps',
            stage: 'Linter',
            ruleId: 'react-hooks/exhaustive-deps',
            message: 'React Hook useEffect has a missing dependency',
        },
        { category: 'this_remaining', stage: 'Test', message: 'this.props remains in component' },
        { category: 'not_defined_or_missing_import', stage: 'Test', message: 'ReferenceError: title is not defined' },
        { category: 'not_defined_or_missing_import', stage: 'Test', message: 'Cannot find module ./Missing' },
        { category: 'not_defined_or_missing_import', stage: 'Infrastructure', message: 'Cannot find module ./Missing' },
        { category: 'invalid_hook_call', stage: 'Test', message: 'Invalid hook call. Hooks can only be called inside a function component.' },
        { category: 'test_assertion', stage: 'Test', message: 'AssertionError: expected 1 to be 2' },
        { category: 'test_runtime_error', stage: 'Test', message: 'TypeError: Cannot read properties of undefined' },
        { category: 'test_timeout', stage: 'Test', message: 'Test timed out in 5000ms' },
        {
            category: 'legacy_contract_failed',
            stage: 'Infrastructure',
            message: 'legacy_contract_failed: shared legacy behavior failed',
        },
        { category: 'infrastructure', stage: 'Infrastructure', message: 'Vitest runner crashed' },
        { category: 'other', stage: 'Test', message: 'unclassified test problem' },
    ];

    it.each(cases)(
        'classifies "$message" as $category',
        ({ stage, message, ruleId, category }) => {
            expect(categorizeError(stage, message, ruleId)).toBe(category);
        },
    );
});
