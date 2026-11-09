import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { CodeMetrics } from '../metrics/calculator';
import { CsvReporter } from './CsvReporter';

const temporaryDirectories: string[] = [];

afterEach(async () => {
    await Promise.all(
        temporaryDirectories.splice(0).map((directory) =>
            rm(directory, { recursive: true, force: true }),
        ),
    );
});

function createMetrics(value: number): CodeMetrics {
    return {
        cyclomaticComplexity: value,
        miEscomplex: value,
        sloc: value,
        physicalSloc: value,
        halsteadEffort: value,
        halsteadVolume: value,
        functionCount: value,
        cyclomaticAvg: value,
        cyclomaticMax: value,
        halsteadVolumeAvg: value,
        logicalSlocAvg: value,
        miClassic: value,
        miClassicNormalized: value,
        classDeclarations: value,
        thisExpressions: value,
        useStateCalls: value,
        useEffectCalls: value,
        useLayoutEffectCalls: value,
        useCallbackCalls: value,
        useMemoCalls: value,
        useRefCalls: value,
        useContextCalls: value,
        useReducerCalls: value,
        customHookCalls: value,
    };
}

describe('CsvReporter', () => {
    it('writes all before/after metrics, metric errors, and appends escaped rows', async () => {
        const directory = await mkdtemp(path.join(os.tmpdir(), 'csv-reporter-'));
        temporaryDirectories.push(directory);
        const filePath = path.join(directory, 'nested', 'report.csv');
        const reporter = new CsvReporter(filePath);

        await reporter.appendResult({
            runId: 'run-01',
            provider: 'ollama',
            model: 'qwen-test',
            component: 'component-01',
            isClassComponent: true,
            durationMs: 1520,
            attempts: 2,
            retries: 1,
            status: 'Success',
            promptTokens: 100,
            completionTokens: 50,
            totalTokens: 150,
            failureStage: 'None',
            beforeMetrics: createMetrics(8),
            afterMetrics: createMetrics(4),
            afterMetricsError: 'after metrics unavailable',
        });
        await reporter.appendResult({
            runId: 'run-01',
            provider: 'ollama',
            model: 'qwen-test',
            component: 'component,02',
            isClassComponent: false,
            durationMs: 600,
            attempts: 3,
            retries: 0,
            status: 'Fail',
            promptTokens: 300,
            completionTokens: 90,
            totalTokens: 390,
            failureStage: 'Test',
            beforeMetricsError: 'unsupported "legacy" syntax',
            failureReason: 'Tests failed: "expected 1"\nreceived 2',
        });

        const report = await readFile(filePath, 'utf8');
        const [headerLine, successLine] = report.split('\n');
        const headers = headerLine.split(',');
        const successValues = successLine.split(',');
        const valueFor = (column: string) => successValues[headers.indexOf(column)];

        expect(headers).toContain('before_metrics_error');
        expect(headers).toContain('is_class_component');
        expect(headers).toContain('after_metrics_error');
        expect(headers).toContain('before_mi_escomplex');
        expect(headers).toContain('after_physical_sloc');
        expect(headers).toContain('before_cyclomatic_avg');
        expect(headers).toContain('after_halstead_volume_avg');
        expect(headers).toContain('before_class_declarations');
        expect(headers).toContain('after_this_expressions');
        expect(headers).toContain('before_use_state_calls');
        expect(headers).toContain('after_custom_hook_calls');
        expect(headers).toHaveLength(successValues.length);
        expect(valueFor('before_mi_escomplex')).toBe('8');
        expect(valueFor('is_class_component')).toBe('true');
        expect(valueFor('after_physical_sloc')).toBe('4');
        expect(valueFor('before_metrics_error')).toBe('');
        expect(valueFor('after_metrics_error')).toBe('after metrics unavailable');
        expect(report).toContain('component-01');
        expect(report).toContain('"component,02"');
        expect(report).toContain('"unsupported ""legacy"" syntax"');
        expect(report).toContain('"Tests failed: ""expected 1""\nreceived 2"');
        expect(report.match(/run_id,provider,model,component/g)).toHaveLength(1);
    });
});
