declare module 'typhonjs-escomplex' {
    interface ESComplexReport {
        aggregate: {
            cyclomatic: number;
            halstead: {
                effort: number;
                volume: number;
            };
            sloc: {
                logical: number;
                physical: number;
            };
        };
        maintainability: number;
    }

    interface ESComplex {
        analyzeModule(source: string): ESComplexReport;
    }

    const escomplex: ESComplex;
    export default escomplex;
}
