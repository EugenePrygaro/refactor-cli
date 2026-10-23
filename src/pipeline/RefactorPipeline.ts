import { readFileSync } from 'node:fs';
import { sliceContext } from '../ast/slicer';
import type { LLMProvider } from '../llm/LLMProvider';
import { lintCode } from '../verification/linter';
import { runTests } from '../verification/tester';

export interface VerificationContext {
    generatedPath: string;
    testPath: string;
}

export interface VerificationStep {
    name: string;
    verify(code: string, context: VerificationContext): Promise<string[]>;
}

const syntaxVerification: VerificationStep = {
    name: 'Syntax',
    async verify(code) {
        try {
            const { parseSource } = await import('../ast/parser');
            parseSource(code);
            return [];
        } catch (error: unknown) {
            if (!(error instanceof SyntaxError)) {
                throw error;
            }
            return [error.message];
        }
    },
};

const linterVerification: VerificationStep = {
    name: 'Linter',
    async verify(code) {
        return lintCode(code);
    },
};

const unitTestVerification: VerificationStep = {
    name: 'Unit Tests',
    async verify(code, { generatedPath, testPath }) {
        const errors = await runTests(code, generatedPath, testPath);
        return errors ? [errors] : [];
    },
};

const defaultVerificationSteps: readonly VerificationStep[] = [
    syntaxVerification,
    linterVerification,
    unitTestVerification,
];

export class RefactorPipeline {
    constructor(
        private readonly llm: LLMProvider,
        private readonly maxAttempts = 3,
        private readonly verificationSteps: readonly VerificationStep[] =
            defaultVerificationSteps,
    ) {
        if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
            throw new RangeError('maxAttempts must be a positive integer.');
        }
        if (verificationSteps.length === 0) {
            throw new RangeError('At least one verification step must be configured.');
        }
    }

    async run(
        sourcePath: string,
        generatedPath: string,
        testPath: string,
    ): Promise<string> {
        const sourceCode = readFileSync(sourcePath, 'utf8');
        const context = sliceContext(sourceCode);
        let lastError = 'No verification steps were configured.';

        for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
            const generatedCode = await this.llm.refactorComponent(context);
            let verificationError: string | undefined;

            for (const step of this.verificationSteps) {
                const errors = await step.verify(generatedCode, {
                    generatedPath,
                    testPath,
                });

                if (errors.length > 0) {
                    verificationError = `${step.name} verification failed:\n${errors.join('\n')}`;
                    break;
                }
            }

            if (verificationError === undefined) {
                return generatedCode;
            }

            lastError = verificationError;
            context.errorMessage = verificationError;
        }

        throw new Error(
            `Refactoring failed after ${this.maxAttempts} attempts.\nLast verification error:\n${lastError}`,
        );
    }
}
