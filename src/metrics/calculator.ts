import escomplex from 'typhonjs-escomplex';
import { normalizeForMetrics } from './normalize';
import { calculateReactMetrics, type ReactMetrics } from './reactMetrics';

export interface CodeMetrics extends ReactMetrics {
    cyclomaticComplexity: number;
    miEscomplex: number;
    sloc: number;
    physicalSloc: number;
    halsteadEffort: number;
    halsteadVolume: number;
    functionCount: number;
    cyclomaticAvg: number;
    cyclomaticMax: number;
    halsteadVolumeAvg: number;
    logicalSlocAvg: number;
    miClassic: number;
    miClassicNormalized: number;
}

export interface MetricsSuccess {
    ok: true;
    metrics: CodeMetrics;
}

export interface MetricsFailure {
    ok: false;
    error: string;
}

export type MetricsResult = MetricsSuccess | MetricsFailure;

export async function calculateMetrics(sourceCode: string): Promise<MetricsResult> {
    try {
        const normalizedSource = await normalizeForMetrics(sourceCode);
        const report = escomplex.analyzeModule(normalizedSource);
        const functions = [
            ...report.methods,
            ...report.classes.flatMap(({ methods }) => methods),
        ];
        const functionCount = functions.length;
        const cyclomaticAvg = average(functions.map(({ cyclomatic }) => cyclomatic));
        const cyclomaticMax = Math.max(
            0,
            ...functions.map(({ cyclomatic }) => cyclomatic),
        );
        const halsteadVolumeAvg = average(
            functions.map(({ halstead }) => halstead.volume),
        );
        const logicalSlocAvg = average(
            functions.map(({ sloc }) => sloc.logical),
        );
        const miClassic = calculateMiClassic(
            halsteadVolumeAvg,
            cyclomaticAvg,
            logicalSlocAvg,
        );
        const reactMetrics = calculateReactMetrics(normalizedSource);

        return {
            ok: true,
            metrics: {
                cyclomaticComplexity: report.aggregate.cyclomatic,
                miEscomplex: report.maintainability,
                sloc: report.aggregate.sloc.logical,
                physicalSloc: report.aggregate.sloc.physical,
                halsteadEffort: report.aggregate.halstead.effort,
                halsteadVolume: report.aggregate.halstead.volume,
                functionCount,
                cyclomaticAvg,
                cyclomaticMax,
                halsteadVolumeAvg,
                logicalSlocAvg,
                miClassic,
                miClassicNormalized: Math.max(0, (miClassic * 100) / 171),
                ...reactMetrics,
            },
        };
    } catch (error: unknown) {
        return {
            ok: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

export function calculateMiClassic(
    avgHalsteadVolume: number,
    avgCyclomaticComplexity: number,
    avgLogicalSloc: number,
): number {
    // escomplex's MI uses mean Halstead EFFORT, a 171 scale, and has an operator-precedence quirk: the 0.23 factor is not applied to ln(CC). Keep both MI values for that reason.
    const value =
        171 -
        5.2 * Math.log(avgHalsteadVolume) -
        0.23 * avgCyclomaticComplexity -
        16.2 * Math.log(avgLogicalSloc);
    return Math.min(171, value);
}

function average(values: number[]): number {
    if (values.length === 0) {
        return 0;
    }
    return values.reduce((total, value) => total + value, 0) / values.length;
}
