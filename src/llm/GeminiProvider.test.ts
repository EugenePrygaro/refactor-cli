import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    generateContent: vi.fn(),
    constructor: vi.fn(),
}));

vi.mock('@google/genai', () => ({
    GoogleGenAI: class {
        models = { generateContent: mocks.generateContent };

        constructor(options: unknown) {
            mocks.constructor(options);
        }
    },
}));

import {
    GEMINI_REQUEST_TIMEOUT_MS,
    GeminiProvider,
    GeminiRequestTimeoutError,
} from './GeminiProvider';
import { buildPrompt } from './promptBuilder';

describe('GeminiProvider', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns cleaned generated code and token usage metadata', async () => {
        mocks.generateContent.mockResolvedValue({
            text: '```tsx\nexport const answer = 42;\n```',
            modelVersion: 'gemini-2.0-flash-001',
            usageMetadata: {
                promptTokenCount: 17,
                candidatesTokenCount: 9,
                totalTokenCount: 26,
            },
        });
        const provider = new GeminiProvider('gemini-token');

        const context = {
            originalCode: 'class Counter {}',
            imports: [],
            dependencyContract: {
                requiredProps: ['title'],
                requiredState: ['counter'],
                requiredMethods: ['handleClick'],
                unresolvedAccesses: [],
            },
        };
        const result = await provider.refactorComponent(context);

        expect(result).toEqual({
            generatedCode: 'export const answer = 42;',
            modelVersion: 'gemini-2.0-flash-001',
            usage: {
                promptTokens: 17,
                completionTokens: 9,
                totalTokens: 26,
            },
            rawResponseLength: 36,
            formatCleaned: true,
        });
        expect(mocks.generateContent).toHaveBeenCalledWith(
            expect.objectContaining({ model: 'gemini-3.8-flash' }),
        );
        expect(mocks.generateContent.mock.calls[0][0].contents).toBe(
            buildPrompt(context),
        );
    });

    it('uses the configured model ID', async () => {
        mocks.generateContent.mockResolvedValue({
            text: 'export const answer = 42;',
            usageMetadata: {},
        });
        const provider = new GeminiProvider('gemini-token', 'gemini-test-model');

        await provider.refactorComponent({ originalCode: 'class Counter {}', imports: [] });

        expect(mocks.generateContent).toHaveBeenCalledWith(
            expect.objectContaining({ model: 'gemini-test-model' }),
        );
    });

    it('passes the configured seed in the generation config', async () => {
        mocks.generateContent.mockResolvedValue({
            text: 'export const answer = 42;',
            usageMetadata: {},
        });
        const provider = new GeminiProvider('gemini-token', 'gemini-test-model', 42);

        await provider.refactorComponent({ originalCode: 'class Counter {}', imports: [] });

        expect(mocks.generateContent).toHaveBeenCalledWith(
            expect.objectContaining({
                config: { temperature: 0.1, seed: 42 },
            }),
        );
    });

    it('uses available counts when Gemini omits the total token count', async () => {
        mocks.generateContent.mockResolvedValue({
            text: 'export const answer = 42;',
            usageMetadata: {
                promptTokenCount: 7,
                candidatesTokenCount: 3,
            },
        });
        const provider = new GeminiProvider('gemini-token');

        const result = await provider.refactorComponent({
            originalCode: 'class Counter {}',
            imports: [],
        });

        expect(result.usage).toEqual({
            promptTokens: 7,
            completionTokens: 3,
            totalTokens: 10,
        });
    });

    it('configures a per-request HTTP timeout', () => {
        new GeminiProvider('gemini-token');

        expect(mocks.constructor).toHaveBeenCalledWith({
            apiKey: 'gemini-token',
            httpOptions: { timeout: GEMINI_REQUEST_TIMEOUT_MS },
        });
    });

    it('reports an aborted request as a retryable connection timeout', async () => {
        const abort = Object.assign(new Error('This operation was aborted'), {
            name: 'AbortError',
        });
        mocks.generateContent.mockRejectedValue(abort);
        const provider = new GeminiProvider('gemini-token');

        const error = await provider
            .refactorComponent({ originalCode: 'class Counter {}', imports: [] })
            .catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(GeminiRequestTimeoutError);
        expect(error).toMatchObject({ name: 'APIConnectionTimeoutError', cause: abort });
    });

    it('passes other provider errors through unchanged', async () => {
        const quota = Object.assign(new Error('quota'), { status: 429 });
        mocks.generateContent.mockRejectedValue(quota);
        const provider = new GeminiProvider('gemini-token');

        await expect(
            provider.refactorComponent({ originalCode: 'class Counter {}', imports: [] }),
        ).rejects.toBe(quota);
    });
});
