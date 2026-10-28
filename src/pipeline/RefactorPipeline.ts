import { readFileSync } from 'node:fs';
import { sliceContext } from '../ast/slicer';
import type { LLMProvider, TokenUsage } from '../llm/LLMProvider';
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

export interface PipelineRunResult {
    generatedCode: string;
    attempts: number;
    usage: TokenUsage;
    failureStage: FailureStage;
}

export type FailureStage = 'Syntax' | 'Linter' | 'Test' | 'None';

export class PipelineError extends Error {
    constructor(
        message: string,
        readonly attempts: number,
        readonly usage: TokenUsage,
        readonly failureStage: FailureStage,
        options?: ErrorOptions,
    ) {
        super(message, options);
        this.name = 'PipelineError';
    }
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
        const result = await this.runWithAttempts(sourcePath, generatedPath, testPath);
        return result.generatedCode;
    }

    async runWithAttempts(
        sourcePath: string,
        generatedPath: string,
        testPath: string,
    ): Promise<PipelineRunResult> {
        const sourceCode = readFileSync(sourcePath, 'utf8');
        const context = sliceContext(sourceCode);
        let lastError = 'No verification steps were configured.';
        let failureStage: FailureStage = 'None';
        const totalUsage: TokenUsage = {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
        };

        for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
            let activeFailureStage: FailureStage = 'None';
            try {
                const result = await this.llm.refactorComponent(context);
                totalUsage.promptTokens += result.usage.promptTokens;
                totalUsage.completionTokens += result.usage.completionTokens;
                totalUsage.totalTokens += result.usage.totalTokens;
                let verificationError: string | undefined;

                for (const step of this.verificationSteps) {
                    activeFailureStage = toFailureStage(step.name);
                    const errors = await step.verify(result.generatedCode, {
                        generatedPath,
                        testPath,
                    });

                    if (errors.length > 0) {
                        verificationError = `${step.name} verification failed:\n${errors.join('\n')}`;
                        break;
                    }
                }

                if (verificationError === undefined) {
                    return {
                        generatedCode: result.generatedCode,
                        attempts: attempt,
                        usage: { ...totalUsage },
                        failureStage: 'None',
                    };
                }

                lastError = verificationError;
                failureStage = activeFailureStage;
                context.errorMessage = verificationError;
            } catch (error: unknown) {
                throw new PipelineError(
                    `Refactoring attempt ${attempt} failed: ${getErrorMessage(error)}`,
                    attempt,
                    { ...totalUsage },
                    activeFailureStage,
                    { cause: error },
                );
            }
        }

        throw new PipelineError(
            `Refactoring failed after ${this.maxAttempts} attempts.\nLast verification error:\n${lastError}`,
            this.maxAttempts,
            { ...totalUsage },
            failureStage,
        );
    }
}

function toFailureStage(stepName: string): FailureStage {
    switch (stepName.toLowerCase()) {
        case 'syntax':
            return 'Syntax';
        case 'linter':
            return 'Linter';
        case 'test':
        case 'unit tests':
            return 'Test';
        default:
            return 'None';
    }
}

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
