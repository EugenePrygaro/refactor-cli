import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CsvReporter } from './CsvReporter';

const temporaryDirectories: string[] = [];

afterEach(async () => {
    await Promise.all(
        temporaryDirectories.splice(0).map((directory) =>
            rm(directory, { recursive: true, force: true }),
        ),
    );
});

describe('CsvReporter', () => {
    it('writes headers and component metrics and appends subsequent rows', async () => {
        const directory = await mkdtemp(path.join(os.tmpdir(), 'csv-reporter-'));
        temporaryDirectories.push(directory);
        const filePath = path.join(directory, 'nested', 'report.csv');
        const reporter = new CsvReporter(filePath);

        await reporter.appendResult({
            runId: 'run-01',
            provider: 'ollama',
            model: 'qwen-test',
            component: 'component-01',
            durationMs: 1520,
            attempts: 2,
            retries: 1,
            status: 'Success',
            promptTokens: 100,
            completionTokens: 50,
            totalTokens: 150,
            failureStage: 'None',
            beforeMetrics: {
                cyclomaticComplexity: 8,
                sloc: 21,
                maintainabilityIndex: 76.5,
                halsteadEffort: 400,
                halsteadVolume: 80,
            },
            afterMetrics: {
                cyclomaticComplexity: 4,
                sloc: 14,
                maintainabilityIndex: 83,
                halsteadEffort: 200,
                halsteadVolume: 40,
            },
        });
        await reporter.appendResult({
            runId: 'run-01',
            provider: 'ollama',
            model: 'qwen-test',
            component: 'component,02',
            durationMs: 600,
            attempts: 3,
            retries: 0,
            status: 'Fail',
            promptTokens: 300,
            completionTokens: 90,
            totalTokens: 390,
            failureStage: 'Test',
            failureReason: 'Tests failed: "expected 1"\nreceived 2',
        });

        const report = await readFile(filePath, 'utf8');
        const failedRow = [
            'run-01',
            'ollama',
            'qwen-test',
            '"component,02"',
            '600',
            '3',
            '0',
            'Fail',
            '',
            '',
            '',
            '',
            '',
            '',
            '300',
            '90',
            '390',
            '',
            '',
            '',
            '',
            'Test',
            '"Tests failed: ""expected 1""\nreceived 2"',
        ].join(',');
        expect(report).toBe(
            'run_id,provider,model,component,duration_ms,attempts,api_retries,status,before_cyclomatic_complexity,before_sloc,before_maintainability_index,after_cyclomatic_complexity,after_sloc,after_maintainability_index,PromptTokens,CompletionTokens,TotalTokens,HalsteadEffortBefore,HalsteadEffortAfter,HalsteadVolumeBefore,HalsteadVolumeAfter,FailureStage,failure_reason\n' +
                'run-01,ollama,qwen-test,component-01,1520,2,1,Success,8,21,76.5,4,14,83,100,50,150,400,200,80,40,None,\n' +
                `${failedRow}\n`,
        );
    });
});
