import { mkdir, open } from 'node:fs/promises';
import path from 'node:path';
import type { CodeMetrics } from '../metrics/calculator';
import type { AttemptRecord, FailureStage } from '../pipeline/RefactorPipeline';

export interface CsvReportEntry {
    runId: string;
    provider: string;
    model: string;
    component: string;
    durationMs: number;
    attempts: number;
    retries: number;
    status: 'Success' | 'Fail' | 'Invalid' | 'Excluded';
    isClassComponent: boolean | null;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    failureStage: FailureStage;
    beforeMetrics?: CodeMetrics;
    afterMetrics?: CodeMetrics;
    beforeMetricsError?: string;
    afterMetricsError?: string;
    attemptRecords?: AttemptRecord[];
    failureReason?: string;
}

const metricFields: (keyof CodeMetrics)[] = [
    'cyclomaticComplexity',
    'miEscomplex',
    'sloc',
    'physicalSloc',
    'halsteadEffort',
    'halsteadVolume',
    'functionCount',
    'cyclomaticAvg',
    'cyclomaticMax',
    'halsteadVolumeAvg',
    'logicalSlocAvg',
    'miClassic',
    'miClassicNormalized',
    'classDeclarations',
    'thisExpressions',
    'useStateCalls',
    'useEffectCalls',
    'useLayoutEffectCalls',
    'useCallbackCalls',
    'useMemoCalls',
    'useRefCalls',
    'useContextCalls',
    'useReducerCalls',
    'customHookCalls',
];

const headers = [
    'run_id',
    'provider',
    'model',
    'component',
    'is_class_component',
    'duration_ms',
    'attempts',
    'api_retries',
    'status',
    ...metricFields.map((field) => `before_${field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)}`),
    'before_metrics_error',
    ...metricFields.map((field) => `after_${field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)}`),
    'after_metrics_error',
    'attempt_records',
    'PromptTokens',
    'CompletionTokens',
    'TotalTokens',
    'FailureStage',
    'failure_reason',
];

export class CsvReporter {
    constructor(private readonly filePath: string) {}

    async appendResult(entry: CsvReportEntry): Promise<void> {
        await mkdir(path.dirname(this.filePath), { recursive: true });
        const file = await open(this.filePath, 'a+');

        try {
            const { size } = await file.stat();
            if (size === 0) {
                await file.writeFile(`${headers.join(',')}\n`, 'utf8');
            }
            await file.writeFile(`${this.serialize(entry).join(',')}\n`, 'utf8');
        } finally {
            await file.close();
        }
    }

    private serialize(entry: CsvReportEntry): string[] {
        return [
            entry.runId,
            entry.provider,
            entry.model,
            entry.component,
            entry.isClassComponent === null ? '' : String(entry.isClassComponent),
            String(entry.durationMs),
            String(entry.attempts),
            String(entry.retries),
            entry.status,
            ...this.metricsValues(entry.beforeMetrics),
            entry.beforeMetricsError ?? '',
            ...this.metricsValues(entry.afterMetrics),
            entry.afterMetricsError ?? '',
            JSON.stringify(entry.attemptRecords ?? []),
            String(entry.promptTokens),
            String(entry.completionTokens),
            String(entry.totalTokens),
            entry.failureStage,
            entry.failureReason ?? '',
        ].map(escapeCsv);
    }

    private metricsValues(metrics: CodeMetrics | undefined): string[] {
        return metricFields.map((field) =>
            this.metricValue(metrics?.[field]),
        );
    }

    private metricValue(value: number | undefined): string {
        return value === undefined ? '' : String(value);
    }
}

function escapeCsv(value: string): string {
    if (!/[",\r\n]/.test(value)) {
        return value;
    }
    return `"${value.replace(/"/g, '""')}"`;
}
