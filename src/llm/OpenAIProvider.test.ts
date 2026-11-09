import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RefactoringContext } from './LLMProvider';

const mocks = vi.hoisted(() => ({
    create: vi.fn(),
    constructor: vi.fn(),
}));

vi.mock('openai', () => ({
    default: class {
        chat = { completions: { create: mocks.create } };

        constructor(options: unknown) {
            mocks.constructor(options);
        }
    },
}));

import { OpenAIProvider } from './OpenAIProvider';
import { buildPrompt } from './promptBuilder';

describe('OpenAIProvider', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('uses a custom base URL and model and cleans fenced code from the response', async () => {
        mocks.create.mockResolvedValue({
            choices: [{ message: { content: '```tsx\nexport const answer = 42;\n```' } }],
            usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 },
            model: 'gpt-4o-mini-2026-10-01',
        });
        const provider = new OpenAIProvider(
            'local-token',
            'qwen2.5-coder:7b',
            'http://localhost:11434/v1',
        );
        const context: RefactoringContext = {
            originalCode: 'class Counter {}',
            imports: [],
            dependencyContract: {
                requiredProps: ['title'],
                requiredState: ['counter'],
                requiredMethods: ['handleClick'],
                unresolvedAccesses: [],
            },
            errorMessage: 'A previous attempt failed.',
        };

        const result = await provider.refactorComponent(context);

        expect(mocks.constructor).toHaveBeenCalledWith({
            apiKey: 'local-token',
            baseURL: 'http://localhost:11434/v1',
        });
        expect(mocks.create).toHaveBeenCalledWith({
            model: 'qwen2.5-coder:7b',
            messages: [
                {
                    role: 'user',
                    content: expect.stringContaining('A previous attempt failed.'),
                },
            ],
            temperature: 0.1,
        });
        expect(mocks.create.mock.calls[0][0].messages[0].content).toBe(
            buildPrompt(context),
        );
        expect(mocks.create.mock.calls[0][0].messages[0].content).toContain(
            'State variables: `counter`',
        );
        expect(mocks.create.mock.calls[0][0].messages[0].content).toContain(
            'Handlers: `handleClick`',
        );
        expect(result).toEqual({
            generatedCode: 'export const answer = 42;',
            modelVersion: 'gpt-4o-mini-2026-10-01',
            usage: { promptTokens: 12, completionTokens: 8, totalTokens: 20 },
            rawResponseLength: 36,
            formatCleaned: true,
        });
    });

    it('returns empty responses for the pipeline to classify as a format failure', async () => {
        mocks.create.mockResolvedValue({
            choices: [{ message: { content: null } }],
            usage: { prompt_tokens: 4, completion_tokens: 0, total_tokens: 4 },
        });
        const provider = new OpenAIProvider('api-token', 'gpt-4o-mini');

        await expect(
            provider.refactorComponent({ originalCode: 'class Counter {}', imports: [] }),
        ).resolves.toMatchObject({
            generatedCode: '',
            rawResponseLength: 0,
            formatCleaned: false,
        });
    });

    it('removes introductory prose around a model response and records that cleanup', async () => {
        mocks.create.mockResolvedValue({
            choices: [{
                message: {
                    content: 'Here is the refactored component:\nexport const answer = 42;',
                },
            }],
            usage: {},
        });
        const provider = new OpenAIProvider('api-token', 'gpt-test');

        await expect(
            provider.refactorComponent({ originalCode: 'class Counter {}', imports: [] }),
        ).resolves.toMatchObject({
            generatedCode: 'export const answer = 42;',
            rawResponseLength: 59,
            formatCleaned: true,
        });
    });

    it('uses a dummy API key when no key is supplied for a local provider', () => {
        new OpenAIProvider('', 'qwen2.5-coder:7b', 'http://localhost:11434/v1');

        expect(mocks.constructor).toHaveBeenCalledWith({
            apiKey: 'ollama',
            baseURL: 'http://localhost:11434/v1',
        });
    });
});
