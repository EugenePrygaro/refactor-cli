declare module 'typhonjs-escomplex' {
    interface ESComplexMethod {
        cyclomatic: number;
        halstead: {
            volume: number;
        };
        sloc: {
            logical: number;
        };
    }

    interface ESComplexClass {
        methods: ESComplexMethod[];
    }

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
        methods: ESComplexMethod[];
        classes: ESComplexClass[];
    }

    interface ESComplex {
        analyzeModule(source: string): ESComplexReport;
    }

    const escomplex: ESComplex;
    export default escomplex;
}
