import { mkdir, open } from 'node:fs/promises';
import path from 'node:path';
import type { AttemptRecord } from '../pipeline/RefactorPipeline';

const headers = [
    'component',
    'model',
    'attempt',
    'stage_reached',
    'failure_stage',
    'error_category',
    'error_message',
    'error_message_full_length',
    'model_version',
    'context_truncation_suspected',
    'prompt_tokens',
    'completion_tokens',
    'total_tokens',
    'latency_ms',
    'api_retries',
    'tests_passed',
    'tests_total',
    'legacy_passed',
    'generated_passed',
    'raw_response_length',
    'format_cleaned',
    'stage_results',
    'stage_durations_ms',
];

export class AttemptCsvReporter {
    constructor(private readonly filePath: string) {}

    async appendAttempts(
        component: string,
        model: string,
        attempts: AttemptRecord[],
    ): Promise<void> {
        await mkdir(path.dirname(this.filePath), { recursive: true });
        const file = await open(this.filePath, 'a+');
        try {
            const { size } = await file.stat();
            if (size === 0) {
                await file.writeFile(`${headers.join(',')}\n`, 'utf8');
            }
            if (attempts.length > 0) {
                const rows = attempts.map((attempt) =>
                    serializeAttempt(component, model, attempt),
                );
                await file.writeFile(`${rows.join('\n')}\n`, 'utf8');
            }
        } finally {
            await file.close();
        }
    }
}

function serializeAttempt(
    component: string,
    model: string,
    attempt: AttemptRecord,
): string {
    return [
        component,
        model,
        String(attempt.attempt),
        attempt.stageReached,
        attempt.failureStage,
        attempt.errorCategory ?? '',
        attempt.errorMessage,
        String(attempt.errorMessageFullLength),
        attempt.modelVersion ?? '',
        String(attempt.contextTruncationSuspected),
        nullableNumber(attempt.tokens.prompt),
        nullableNumber(attempt.tokens.completion),
        nullableNumber(attempt.tokens.total),
        String(attempt.latencyMs),
        String(attempt.apiRetries),
        nullableNumber(attempt.testsPassed),
        nullableNumber(attempt.testsTotal),
        nullableBoolean(attempt.legacyPassed),
        nullableBoolean(attempt.generatedPassed),
        nullableNumber(attempt.rawResponseLength),
        String(attempt.formatCleaned),
        JSON.stringify(attempt.stageResults),
        JSON.stringify(attempt.stageDurationsMs),
    ]
        .map(escapeCsv)
        .join(',');
}

function nullableNumber(value: number | null): string {
    return value === null ? '' : String(value);
}

function nullableBoolean(value: boolean | null): string {
    return value === null ? '' : String(value);
}

function escapeCsv(value: string): string {
    if (!/[",\r\n]/.test(value)) {
        return value;
    }
    return `"${value.replace(/"/g, '""')}"`;
}
