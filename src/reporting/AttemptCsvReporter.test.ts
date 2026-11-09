import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { AttemptRecord } from '../pipeline/RefactorPipeline';
import { AttemptCsvReporter } from './AttemptCsvReporter';

const temporaryDirectories: string[] = [];

afterEach(async () => {
    await Promise.all(
        temporaryDirectories.splice(0).map((directory) =>
            rm(directory, { recursive: true, force: true }),
        ),
    );
});

describe('AttemptCsvReporter', () => {
    it('writes model versions and context truncation diagnostics per attempt', async () => {
        const directory = await mkdtemp(path.join(os.tmpdir(), 'attempt-csv-'));
        temporaryDirectories.push(directory);
        const reporter = new AttemptCsvReporter(path.join(directory, 'attempts.csv'));
        const attempt: AttemptRecord = {
            attempt: 1,
            stageReached: 'Syntax',
            stageResults: {
                restoration: 'pass',
                syntax: 'pass',
                linter: 'not_run',
                test: 'not_run',
            },
            failureStage: 'None',
            errorCategory: null,
            errorMessage: '',
            errorMessageFullLength: 0,
            tokens: { prompt: 32_000, completion: 50, total: 32_050 },
            latencyMs: 200,
            stageDurationsMs: {
                restoration: 2,
                syntax: 1,
                linter: 0,
                test: 0,
            },
            apiRetries: 0,
            testsPassed: null,
            testsTotal: null,
            legacyPassed: null,
            generatedPassed: null,
            rawResponseLength: 100,
            formatCleaned: false,
            modelVersion: 'sha256:qwen-model',
            contextTruncationSuspected: true,
        };

        await reporter.appendAttempts('component-39', 'qwen2.5-coder:14b', [
            attempt,
        ]);
        const csv = await readFile(path.join(directory, 'attempts.csv'), 'utf8');

        expect(csv).toContain(
            'component,model,attempt,stage_reached,failure_stage,error_category,error_message,error_message_full_length,model_version,context_truncation_suspected',
        );
        expect(csv).toContain(
            'component-39,qwen2.5-coder:14b,1,Syntax,None,,,0,sha256:qwen-model,true,32000,50,32050',
        );
    });
});
