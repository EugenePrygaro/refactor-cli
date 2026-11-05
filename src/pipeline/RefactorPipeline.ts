import { readFileSync } from 'node:fs';
import { maskJSX, restoreJSX, sliceContext } from '../ast/slicer';
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
    retries: number;
    usage: TokenUsage;
    failureStage: FailureStage;
}

export type FailureStage = 'Restoration' | 'Syntax' | 'Linter' | 'Test' | 'None';

export interface RetryOptions {
    maxRetries: number;
    baseDelayMs: number;
    sleep: (milliseconds: number) => Promise<void>;
}

const defaultRetryOptions: RetryOptions = {
    maxRetries: 3,
    baseDelayMs: 1_000,
    sleep: (milliseconds) =>
        new Promise((resolve) => setTimeout(resolve, milliseconds)),
};

export class PipelineError extends Error {
    constructor(
        message: string,
        readonly attempts: number,
        readonly retries: number,
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
        private readonly retryOptions: RetryOptions = defaultRetryOptions,
    ) {
        if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
            throw new RangeError('maxAttempts must be a positive integer.');
        }
        if (verificationSteps.length === 0) {
            throw new RangeError('At least one verification step must be configured.');
        }
        if (
            !Number.isInteger(retryOptions.maxRetries) ||
            retryOptions.maxRetries < 0 ||
            !Number.isFinite(retryOptions.baseDelayMs) ||
            retryOptions.baseDelayMs < 0
        ) {
            throw new RangeError('Retry settings must be non-negative.');
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
        const { maskedCode, jsxMap, dependencyContract } = maskJSX(sourceCode);
        const context = {
            ...sliceContext(maskedCode),
            dependencyContract,
        };
        if (Object.keys(jsxMap).length > 0) {
            const characterDelta = sourceCode.length - maskedCode.length;
            const change = characterDelta >= 0
                ? `${characterDelta} fewer`
                : `${Math.abs(characterDelta)} more`;
            const percentage = sourceCode.length === 0
                ? 0
                : (characterDelta / sourceCode.length) * 100;
            console.info(
                `[AST slicer] JSX masking changed source length by ${change} characters (${percentage.toFixed(1)}%). Actual token savings are reported by provider usage.`,
            );
        }
        let lastError = 'No verification steps were configured.';
        let failureStage: FailureStage = 'None';
        let retries = 0;
        const totalUsage: TokenUsage = {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
        };

        for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
            let activeFailureStage: FailureStage = 'None';
            try {
                const result = await this.refactorWithRetries(context, () => {
                    retries++;
                });
                totalUsage.promptTokens += result.usage.promptTokens;
                totalUsage.completionTokens += result.usage.completionTokens;
                totalUsage.totalTokens += result.usage.totalTokens;
                let generatedCode = result.generatedCode;
                let verificationError: string | undefined;

                try {
                    generatedCode = restoreJSX(result.generatedCode, jsxMap);
                } catch (error: unknown) {
                    activeFailureStage = 'Restoration';
                    verificationError = `JSX restoration failed:\n${getErrorMessage(error)}`;
                }

                if (verificationError === undefined) {
                    for (const step of this.verificationSteps) {
                        activeFailureStage = toFailureStage(step.name);
                        const errors = await step.verify(generatedCode, {
                            generatedPath,
                            testPath,
                        });

                        if (errors.length > 0) {
                            verificationError = `${step.name} verification failed:\n${errors.join('\n')}`;
                            break;
                        }
                    }
                }

                if (verificationError === undefined) {
                    return {
                        generatedCode,
                        attempts: attempt,
                        retries,
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
                    retries,
                    { ...totalUsage },
                    activeFailureStage,
                    { cause: error },
                );
            }
        }

        throw new PipelineError(
            `Refactoring failed after ${this.maxAttempts} attempts.\nLast verification error:\n${lastError}`,
            this.maxAttempts,
            retries,
            { ...totalUsage },
            failureStage,
        );
    }

    private async refactorWithRetries(
        context: ReturnType<typeof sliceContext>,
        onRetry: () => void,
    ): Promise<Awaited<ReturnType<LLMProvider['refactorComponent']>>> {
        for (let retry = 0; ; retry++) {
            try {
                return await this.llm.refactorComponent(context);
            } catch (error: unknown) {
                if (retry >= this.retryOptions.maxRetries || !isTransientModelError(error)) {
                    throw error;
                }
                onRetry();
                const delay = Math.min(
                    this.retryOptions.baseDelayMs * 2 ** retry,
                    30_000,
                );
                await this.retryOptions.sleep(delay);
            }
        }
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

function isTransientModelError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) {
        return false;
    }

    const candidate = error as {
        name?: unknown;
        status?: unknown;
        code?: unknown;
        cause?: unknown;
    };
    if (
        typeof candidate.name === 'string' &&
        /APIConnection(?:Timeout)?Error/.test(candidate.name)
    ) {
        return true;
    }
    if (
        typeof candidate.status === 'number' &&
        (candidate.status === 429 || candidate.status >= 500)
    ) {
        return true;
    }

    const transientCodes = new Set([
        'ECONNABORTED',
        'ECONNREFUSED',
        'ECONNRESET',
        'EHOSTUNREACH',
        'ENETUNREACH',
        'ETIMEDOUT',
    ]);
    if (typeof candidate.code === 'string' && transientCodes.has(candidate.code)) {
        return true;
    }

    return (
        typeof candidate.cause === 'object' &&
        candidate.cause !== null &&
        'code' in candidate.cause &&
        typeof candidate.cause.code === 'string' &&
        transientCodes.has(candidate.cause.code)
    );
}
