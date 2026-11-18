import { readFileSync } from 'node:fs';
import { maskJSX, restoreJSX, sliceContext } from '../ast/slicer';
import { parseSource } from '../ast/parser';
import type { LLMProvider, TokenUsage } from '../llm/LLMProvider';
import { categorizeError, type ErrorCategory } from './errorCategory';
import { lintCode } from '../verification/linter';
import { runTests } from '../verification/tester';
import type { TestRunResult } from '../verification/tester';

export interface VerificationContext {
    generatedPath: string;
    testPath: string;
}

export interface VerificationStep {
    name: string;
    verify(
        code: string,
        context: VerificationContext,
    ): Promise<string[] | VerificationStepResult>;
}

export interface VerificationStepResult {
    errors: string[];
    testResult?: TestRunResult;
    ruleId?: string;
    infrastructureError?: boolean;
}

export type VerificationStageResult = 'pass' | 'fail' | 'skipped' | 'not_run';

export interface AttemptRecord {
    attempt: number;
    stageReached: Exclude<FailureStage, 'None'>;
    stageResults: {
        restoration: VerificationStageResult;
        syntax: VerificationStageResult;
        linter: VerificationStageResult;
        test: VerificationStageResult;
    };
    failureStage: FailureStage;
    errorCategory: ErrorCategory | null;
    errorMessage: string;
    errorMessageFullLength: number;
    tokens: {
        prompt: number | null;
        completion: number | null;
        total: number | null;
    };
    latencyMs: number;
    stageDurationsMs: {
        restoration: number;
        syntax: number;
        linter: number;
        test: number;
    };
    apiRetries: number;
    testsPassed: number | null;
    testsTotal: number | null;
    legacyPassed: boolean | null;
    generatedPassed: boolean | null;
    rawResponseLength: number | null;
    formatCleaned: boolean;
    modelVersion: string | null;
    contextTruncationSuspected: boolean;
}

export interface PipelineRunResult {
    generatedCode: string;
    attempts: AttemptRecord[];
    attemptCount: number;
    retries: number;
    usage: TokenUsage;
    failureStage: FailureStage;
}

export type FailureStage =
    | 'Generation'
    | 'Format'
    | 'Restoration'
    | 'Syntax'
    | 'Linter'
    | 'Test'
    | 'Infrastructure'
    | 'None';

export interface RetryOptions {
    maxRetries: number;
    baseDelayMs: number;
    /** Upper bound for one exponential backoff pause (default 60 s). */
    maxDelayMs?: number;
    /** Minimum time between the starts of two model requests, for per-minute rate limits (default 0). */
    minRequestIntervalMs?: number;
    sleep: (milliseconds: number) => Promise<void>;
    now?: () => number;
}

/** Longest pause accepted from a server's "retry in N s" hint. */
const MAX_SERVER_RETRY_DELAY_MS = 120_000;

export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
    maxRetries: 3,
    // Overload (503) and quota (429) errors need tens of seconds, not milliseconds, to clear.
    baseDelayMs: 15_000,
    maxDelayMs: 60_000,
    minRequestIntervalMs: 0,
    sleep: (milliseconds) =>
        new Promise((resolve) => setTimeout(resolve, milliseconds)),
};

export class PipelineError extends Error {
    constructor(
        message: string,
        readonly attempts: AttemptRecord[],
        readonly retries: number,
        readonly usage: TokenUsage,
        readonly failureStage: FailureStage,
        readonly componentStatus: 'Fail' | 'Invalid' = 'Fail',
        readonly fatal = false,
        options?: ErrorOptions,
    ) {
        super(message, options);
        this.name = 'PipelineError';
    }

    get attemptCount(): number {
        return this.attempts.length;
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
        const testResult = await runTests(code, generatedPath, testPath);
        return {
            errors: testResult.errorText ? [testResult.errorText] : [],
            testResult,
            infrastructureError: testResult.infrastructureError,
        };
    },
};

const defaultVerificationSteps: readonly VerificationStep[] = [
    syntaxVerification,
    linterVerification,
    unitTestVerification,
];

export const DEFAULT_MAX_ATTEMPTS = 3;

export class RefactorPipeline {
    private lastRequestStartedAt: number | undefined;

    constructor(
        private readonly llm: LLMProvider,
        private readonly maxAttempts = DEFAULT_MAX_ATTEMPTS,
        private readonly verificationSteps: readonly VerificationStep[] =
            defaultVerificationSteps,
        private readonly retryOptions: RetryOptions = DEFAULT_RETRY_OPTIONS,
        private readonly feedbackErrorMaxChars = 4_000,
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
            retryOptions.baseDelayMs < 0 ||
            !isNonNegativeOrUnset(retryOptions.maxDelayMs) ||
            !isNonNegativeOrUnset(retryOptions.minRequestIntervalMs)
        ) {
            throw new RangeError('Retry settings must be non-negative.');
        }
        if (!Number.isInteger(feedbackErrorMaxChars) || feedbackErrorMaxChars < 32) {
            throw new RangeError('feedbackErrorMaxChars must be an integer of at least 32.');
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
        const knownModelVersion = this.llm.getModelVersion
            ? await this.llm.getModelVersion()
            : null;
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
        const attemptRecords: AttemptRecord[] = [];
        const totalUsage: TokenUsage = {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
        };

        for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
            const record = createAttemptRecord(attempt);
            record.modelVersion = knownModelVersion;
            let result: Awaited<ReturnType<LLMProvider['refactorComponent']>>;
            let attemptErrorFull = '';
            // Rate-limit pacing happens before the clock starts so it does not inflate latency.
            await this.waitForRequestSlot();
            const modelCallStarted = performance.now();
            try {
                result = await this.refactorWithRetries(context, () => {
                    retries++;
                    record.apiRetries++;
                });
            } catch (error: unknown) {
                record.latencyMs = elapsed(modelCallStarted);
                const message = getErrorMessage(error);
                if (isTransientModelError(error)) {
                    // The model never answered: an outage, not a model failure. Do not spend
                    // the attempt; mark the component Invalid so analysis excludes it and it
                    // can be re-run.
                    const outage =
                        `Model API unavailable after ${record.apiRetries} retries: ${message}`;
                    setAttemptFailure(record, 'Infrastructure', outage, 'infrastructure');
                    skipStagesAfter(record, 'Generation');
                    attemptRecords.push(record);
                    throw new PipelineError(
                        outage,
                        attemptRecords,
                        retries,
                        { ...totalUsage },
                        'Infrastructure',
                        'Invalid',
                    );
                }
                const fatal = isFatalConfigurationError(error);
                const feedback = fatal
                    ? `Fatal provider configuration error: ${message}`
                    : `Generation failed: ${message}`;
                attemptErrorFull = feedback;
                setAttemptFailure(
                    record,
                    'Generation',
                    feedback,
                    categorizeError('Generation', message),
                );
                skipStagesAfter(record, 'Generation');
                attemptRecords.push(record);
                lastError = attemptErrorFull;
                failureStage = 'Generation';
                if (fatal) {
                    throw new PipelineError(
                        `Fatal LLM configuration error: ${message}`,
                        attemptRecords,
                        retries,
                        { ...totalUsage },
                        failureStage,
                        'Fail',
                        true,
                    );
                }

                context.errorMessage = truncateForFeedback(
                    feedback,
                    this.feedbackErrorMaxChars,
                );
                continue;
            }

            record.latencyMs = elapsed(modelCallStarted);
            record.tokens = {
                prompt: result.usage.promptTokens,
                completion: result.usage.completionTokens,
                total: result.usage.totalTokens,
            };
            record.rawResponseLength =
                result.rawResponseLength ?? result.generatedCode.length;
            record.formatCleaned = result.formatCleaned ?? false;
            record.modelVersion = result.modelVersion ?? null;
            record.contextTruncationSuspected =
                result.contextTruncationSuspected ?? false;
            totalUsage.promptTokens += result.usage.promptTokens;
            totalUsage.completionTokens += result.usage.completionTokens;
            totalUsage.totalTokens += result.usage.totalTokens;

            const generatedCode = result.generatedCode;
            if (isObviouslyNotCode(generatedCode)) {
                const message = generatedCode.trim()
                    ? 'The cleaned LLM response does not look like source code.'
                    : 'The cleaned LLM response is empty.';
                attemptErrorFull = message;
                setAttemptFailure(record, 'Format', message, 'format');
                skipStagesAfter(record, 'Format');
                attemptRecords.push(record);
                lastError = message;
                failureStage = 'Format';
                context.errorMessage = truncateForFeedback(
                    message,
                    this.feedbackErrorMaxChars,
                );
                continue;
            }

            let restoredCode: string;
            record.stageReached = 'Restoration';
            const restorationStarted = performance.now();
            try {
                restoredCode = restoreJSX(generatedCode, jsxMap);
                record.stageResults.restoration = 'pass';
            } catch (error: unknown) {
                const message = `JSX restoration failed:\n${getErrorMessage(error)}`;
                attemptErrorFull = message;
                record.stageResults.restoration = 'fail';
                skipStagesAfter(record, 'Restoration');
                record.stageDurationsMs.restoration = elapsed(restorationStarted);
                setAttemptFailure(
                    record,
                    'Restoration',
                    message,
                    categorizeError('Restoration', message),
                );
                attemptRecords.push(record);
                lastError = attemptErrorFull;
                failureStage = 'Restoration';
                context.errorMessage = truncateForFeedback(
                    message,
                    this.feedbackErrorMaxChars,
                );
                continue;
            }
            record.stageDurationsMs.restoration = elapsed(restorationStarted);

            let verificationFailed = false;
            for (const step of this.verificationSteps) {
                const stage = toFailureStage(step.name);
                if (
                    stage === 'None' ||
                    stage === 'Format' ||
                    stage === 'Generation' ||
                    stage === 'Infrastructure'
                ) {
                    continue;
                }

                record.stageReached = stage;
                const stageStarted = performance.now();
                let rawOutcome: string[] | VerificationStepResult;
                try {
                    rawOutcome = await step.verify(restoredCode, {
                        generatedPath,
                        testPath,
                    });
                } catch (error: unknown) {
                    const message = `${step.name} verification infrastructure failed: ${getErrorMessage(error)}`;
                    attemptErrorFull = message;
                    const stepFailureStage = stage === 'Test' ? 'Infrastructure' : stage;
                    setStageResult(record, stage, 'fail');
                    record.stageDurationsMs[stageKey(stage)] = elapsed(stageStarted);
                    skipStagesAfter(record, stage);
                    setAttemptFailure(
                        record,
                        stepFailureStage,
                        message,
                        categorizeError(stepFailureStage, message),
                    );
                    verificationFailed = true;
                    break;
                }

                const outcome = normalizeVerificationResult(rawOutcome);
                record.stageDurationsMs[stageKey(stage)] = elapsed(stageStarted);
                if (outcome.testResult) {
                    record.testsPassed = outcome.testResult.testsPassed;
                    record.testsTotal = outcome.testResult.testsTotal;
                    record.legacyPassed = outcome.testResult.legacyPassed;
                    record.generatedPassed = outcome.testResult.generatedPassed;
                }

                if (outcome.testResult?.legacyPassed === false) {
                    const message =
                        'The legacy behavioral contract failed; the dataset baseline is invalid.';
                    attemptErrorFull = message;
                    setStageResult(record, stage, 'fail');
                    skipStagesAfter(record, stage);
                    setAttemptFailure(
                        record,
                        'Infrastructure',
                        message,
                        'legacy_contract_failed',
                    );
                    attemptRecords.push(record);
                    throw new PipelineError(
                        message,
                        attemptRecords,
                        retries,
                        { ...totalUsage },
                        'Infrastructure',
                        'Invalid',
                    );
                }

                const isInfrastructureFailure =
                    outcome.infrastructureError === true ||
                    outcome.testResult?.infrastructureError === true;
                if (isInfrastructureFailure || outcome.errors.length > 0) {
                    const message = outcome.errors.length > 0
                        ? `${step.name} verification failed:\n${outcome.errors.join('\n')}`
                        : `${step.name} verification infrastructure failed.`;
                    attemptErrorFull = message;
                    const stageFailure = isInfrastructureFailure
                        ? 'Infrastructure'
                        : stage;
                    setStageResult(record, stage, 'fail');
                    skipStagesAfter(record, stage);
                    setAttemptFailure(
                        record,
                        stageFailure,
                        message,
                        categorizeError(stageFailure, message, outcome.ruleId),
                    );
                    verificationFailed = true;
                    break;
                }

                setStageResult(record, stage, 'pass');
            }

            if (!verificationFailed) {
                record.failureStage = 'None';
                record.errorCategory = null;
                attemptRecords.push(record);
                return {
                    generatedCode: restoredCode,
                    attempts: attemptRecords,
                    attemptCount: attemptRecords.length,
                    retries,
                    usage: { ...totalUsage },
                    failureStage: 'None',
                };
            }

            attemptRecords.push(record);
            failureStage = record.failureStage;
            lastError = attemptErrorFull;
            context.errorMessage = truncateForFeedback(
                attemptErrorFull,
                this.feedbackErrorMaxChars,
            );
        }

        throw new PipelineError(
            `Refactoring failed after ${attemptRecords.length} attempts.\nLast verification error:\n${lastError}`,
            attemptRecords,
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
            if (retry > 0) {
                await this.waitForRequestSlot();
            }
            try {
                return await this.llm.refactorComponent(context);
            } catch (error: unknown) {
                if (retry >= this.retryOptions.maxRetries || !isTransientModelError(error)) {
                    throw error;
                }
                onRetry();
                await this.retryOptions.sleep(retryDelayMs(error, retry, this.retryOptions));
            }
        }
    }

    /** Waits until at least minRequestIntervalMs has passed since the previous request started. */
    private async waitForRequestSlot(): Promise<void> {
        const interval = this.retryOptions.minRequestIntervalMs ?? 0;
        const now = this.retryOptions.now ?? (() => performance.now());
        if (interval > 0 && this.lastRequestStartedAt !== undefined) {
            const wait = this.lastRequestStartedAt + interval - now();
            if (wait > 0) {
                await this.retryOptions.sleep(Math.ceil(wait));
            }
        }
        this.lastRequestStartedAt = now();
    }
}

function isNonNegativeOrUnset(value: number | undefined): boolean {
    return value === undefined || (Number.isFinite(value) && value >= 0);
}

/**
 * Pause before the next retry: the server's own hint when it gives one (Gemini 429 bodies carry
 * "retryDelay", OpenAI sends a Retry-After header), otherwise exponential backoff.
 */
export function retryDelayMs(error: unknown, retry: number, options: RetryOptions): number {
    const suggested = serverSuggestedDelayMs(error);
    if (suggested !== undefined) {
        return Math.min(suggested + 1_000, MAX_SERVER_RETRY_DELAY_MS);
    }
    return Math.min(options.baseDelayMs * 2 ** retry, options.maxDelayMs ?? 60_000);
}

function serverSuggestedDelayMs(error: unknown): number | undefined {
    const message = getErrorMessage(error);
    const fromBody =
        /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(message) ??
        /retry in (\d+(?:\.\d+)?)\s*s/i.exec(message);
    if (fromBody) {
        return Math.ceil(Number(fromBody[1]) * 1_000);
    }
    if (typeof error !== 'object' || error === null || !('headers' in error)) {
        return undefined;
    }
    const headers = error.headers;
    let retryAfter: unknown;
    if (headers instanceof Headers) {
        retryAfter = headers.get('retry-after');
    } else if (typeof headers === 'object' && headers !== null && 'retry-after' in headers) {
        retryAfter = (headers as Record<string, unknown>)['retry-after'];
    }
    const seconds = typeof retryAfter === 'string' ? Number(retryAfter) : NaN;
    return Number.isFinite(seconds) && seconds >= 0 ? Math.ceil(seconds * 1_000) : undefined;
}

function createAttemptRecord(attempt: number): AttemptRecord {
    return {
        attempt,
        stageReached: 'Generation',
        stageResults: {
            restoration: 'not_run',
            syntax: 'not_run',
            linter: 'not_run',
            test: 'not_run',
        },
        failureStage: 'None',
        errorCategory: null,
        errorMessage: '',
        errorMessageFullLength: 0,
        tokens: { prompt: null, completion: null, total: null },
        latencyMs: 0,
        stageDurationsMs: {
            restoration: 0,
            syntax: 0,
            linter: 0,
            test: 0,
        },
        apiRetries: 0,
        testsPassed: null,
        testsTotal: null,
        legacyPassed: null,
        generatedPassed: null,
        rawResponseLength: null,
        formatCleaned: false,
        modelVersion: null,
        contextTruncationSuspected: false,
    };
}

function setAttemptFailure(
    record: AttemptRecord,
    stage: Exclude<FailureStage, 'None'>,
    message: string,
    category: ErrorCategory,
): void {
    record.stageReached = stage;
    record.failureStage = stage;
    record.errorCategory = category;
    record.errorMessageFullLength = message.length;
    record.errorMessage = truncateForFeedback(message, 2_000);
}

function truncateForFeedback(message: string, maximumLength: number): string {
    if (message.length <= maximumLength) {
        return message;
    }

    const marker = '…truncated…';
    const availableLength = maximumLength - marker.length;
    const headLength = Math.ceil(availableLength / 2);
    const tailLength = Math.floor(availableLength / 2);
    return `${message.slice(0, headLength)}${marker}${message.slice(-tailLength)}`;
}

function elapsed(startedAt: number): number {
    return Math.max(0, Math.round(performance.now() - startedAt));
}

function normalizeVerificationResult(
    result: string[] | VerificationStepResult,
): VerificationStepResult {
    return Array.isArray(result) ? { errors: result } : result;
}

function stageKey(
    stage: Exclude<FailureStage, 'None' | 'Generation' | 'Format' | 'Infrastructure'>,
): keyof AttemptRecord['stageDurationsMs'] {
    switch (stage) {
        case 'Restoration':
            return 'restoration';
        case 'Syntax':
            return 'syntax';
        case 'Linter':
            return 'linter';
        case 'Test':
            return 'test';
    }
}

function setStageResult(
    record: AttemptRecord,
    stage: FailureStage,
    result: VerificationStageResult,
): void {
    switch (stage) {
        case 'Restoration':
            record.stageResults.restoration = result;
            break;
        case 'Syntax':
            record.stageResults.syntax = result;
            break;
        case 'Linter':
            record.stageResults.linter = result;
            break;
        case 'Test':
            record.stageResults.test = result;
            break;
    }
}

function skipStagesAfter(record: AttemptRecord, stage: FailureStage): void {
    const stages: (keyof AttemptRecord['stageResults'])[] = [
        'restoration',
        'syntax',
        'linter',
        'test',
    ];
    const failedStageIndex = stages.indexOf(stage.toLowerCase() as typeof stages[number]);
    if (failedStageIndex < 0) {
        for (const stageName of stages) {
            if (record.stageResults[stageName] === 'not_run') {
                record.stageResults[stageName] = 'skipped';
            }
        }
        return;
    }

    for (const stageName of stages.slice(failedStageIndex + 1)) {
        if (record.stageResults[stageName] === 'not_run') {
            record.stageResults[stageName] = 'skipped';
        }
    }
}

function isObviouslyNotCode(code: string): boolean {
    const trimmed = code.trim();
    if (!trimmed) {
        return true;
    }

    try {
        parseSource(trimmed);
        return false;
    } catch {
        return !/^(?:import\b|export\b|declare\b|type\b|interface\b|class\b|function\b|async\b|const\b|let\b|var\b|\/[/*]|["']use strict["'];?|<|return\b)/.test(
            trimmed,
        );
    }
}

function isFatalConfigurationError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) {
        return false;
    }
    const candidate = error as { status?: unknown; message?: unknown };
    if (
        candidate.status === 401 ||
        // 402: billing/prepaid credits exhausted; every further request fails the same way.
        candidate.status === 402 ||
        candidate.status === 403
    ) {
        return true;
    }
    return candidate.status === 404 &&
        typeof candidate.message === 'string' &&
        /model|deployment/i.test(candidate.message);
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
