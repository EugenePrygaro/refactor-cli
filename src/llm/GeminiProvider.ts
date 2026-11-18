import { GoogleGenAI } from '@google/genai';
import type {
    LLMProvider,
    RefactoringContext,
    RefactoringResult,
} from './LLMProvider';
import { cleanModelResponse, buildPrompt } from './promptBuilder';

/**
 * Per-request deadline; without it a stalled request waits for the server's 10-minute limit.
 * The SDK also sends it to the server as X-Server-Timeout, so it must exceed the slowest normal
 * generation: large components with Gemini "thinking" took up to ~2 minutes, and a 2-minute value
 * made the server answer 504 DEADLINE_EXCEEDED.
 */
export const GEMINI_REQUEST_TIMEOUT_MS = 300_000;

/** Named so the pipeline's transient-error check retries it like other connection timeouts. */
export class GeminiRequestTimeoutError extends Error {
    constructor(timeoutMs: number, options?: { cause?: unknown }) {
        super(`Gemini request timed out after ${timeoutMs / 1000} s.`, options);
        this.name = 'APIConnectionTimeoutError';
    }
}

function isAbortError(error: unknown): boolean {
    return (
        typeof error === 'object' &&
        error !== null &&
        'name' in error &&
        (error.name === 'AbortError' || error.name === 'TimeoutError')
    );
}

export class GeminiProvider implements LLMProvider {
    readonly providerName = 'gemini';
    readonly name: string;
    private readonly ai: GoogleGenAI;

    constructor(
        apiKey: string,
        readonly modelName = 'gemini-3.8-flash',
        readonly seed?: number,
    ) {
        this.ai = new GoogleGenAI({
            apiKey,
            httpOptions: { timeout: GEMINI_REQUEST_TIMEOUT_MS },
        });
        this.name = `Gemini (${modelName})`;
    }

    async refactorComponent(context: RefactoringContext): Promise<RefactoringResult> {
        let response: Awaited<ReturnType<GoogleGenAI['models']['generateContent']>>;
        try {
            response = await this.ai.models.generateContent({
                model: this.modelName,
                contents: buildPrompt(context),
                config: {
                    temperature: 0.1,
                    ...(this.seed === undefined ? {} : { seed: this.seed }),
                },
            });
        } catch (error: unknown) {
            if (isAbortError(error)) {
                throw new GeminiRequestTimeoutError(GEMINI_REQUEST_TIMEOUT_MS, { cause: error });
            }
            throw error;
        }
        const text = response.text;
        const rawContent = typeof text === 'string' ? text : '';
        const cleaned = cleanModelResponse(rawContent);

        const usage = response.usageMetadata;
        const promptTokens = usage?.promptTokenCount ?? 0;
        const completionTokens = usage?.candidatesTokenCount ?? 0;

        return {
            generatedCode: cleaned.code,
            modelVersion: response.modelVersion,
            usage: {
                promptTokens,
                completionTokens,
                totalTokens: usage?.totalTokenCount ?? promptTokens + completionTokens,
            },
            rawResponseLength: rawContent.length,
            formatCleaned: cleaned.formatCleaned,
        };
    }

}
