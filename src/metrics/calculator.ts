import escomplex from 'typhonjs-escomplex';

export interface CodeMetrics {
    cyclomaticComplexity: number;
    maintainabilityIndex: number;
    sloc: number;
    halsteadEffort: number;
    halsteadVolume: number;
}

export function calculateMetrics(sourceCode: string): CodeMetrics {
    const report = escomplex.analyzeModule(sourceCode);

    return {
        cyclomaticComplexity: report.aggregate.cyclomatic,
        maintainabilityIndex: report.maintainability,
        sloc: report.aggregate.sloc.logical,
        halsteadEffort: report.aggregate.halstead.effort,
        halsteadVolume: report.aggregate.halstead.volume,
    };
}
