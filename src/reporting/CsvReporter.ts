import { mkdir, open } from 'node:fs/promises';
import path from 'node:path';
import type { CodeMetrics } from '../metrics/calculator';
import type { FailureStage } from '../pipeline/RefactorPipeline';

export interface CsvReportEntry {
    component: string;
    durationMs: number;
    attempts: number;
    status: 'Success' | 'Fail';
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    failureStage: FailureStage;
    beforeMetrics?: CodeMetrics;
    afterMetrics?: CodeMetrics;
    failureReason?: string;
}

const headers = [
    'component',
    'duration_ms',
    'attempts',
    'status',
    'before_cyclomatic_complexity',
    'before_sloc',
    'before_maintainability_index',
    'after_cyclomatic_complexity',
    'after_sloc',
    'after_maintainability_index',
    'PromptTokens',
    'CompletionTokens',
    'TotalTokens',
    'HalsteadEffortBefore',
    'HalsteadEffortAfter',
    'HalsteadVolumeBefore',
    'HalsteadVolumeAfter',
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
            entry.component,
            String(entry.durationMs),
            String(entry.attempts),
            entry.status,
            this.metricValue(entry.beforeMetrics?.cyclomaticComplexity),
            this.metricValue(entry.beforeMetrics?.sloc),
            this.metricValue(entry.beforeMetrics?.maintainabilityIndex),
            this.metricValue(entry.afterMetrics?.cyclomaticComplexity),
            this.metricValue(entry.afterMetrics?.sloc),
            this.metricValue(entry.afterMetrics?.maintainabilityIndex),
            String(entry.promptTokens),
            String(entry.completionTokens),
            String(entry.totalTokens),
            this.metricValue(entry.beforeMetrics?.halsteadEffort),
            this.metricValue(entry.afterMetrics?.halsteadEffort),
            this.metricValue(entry.beforeMetrics?.halsteadVolume),
            this.metricValue(entry.afterMetrics?.halsteadVolume),
            entry.failureStage,
            entry.failureReason ?? '',
        ].map(escapeCsv);
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
