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

describe('OpenAIProvider', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('uses a custom base URL and model and cleans fenced code from the response', async () => {
        mocks.create.mockResolvedValue({
            choices: [{ message: { content: '```tsx\nexport const answer = 42;\n```' } }],
            usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 },
        });
        const provider = new OpenAIProvider(
            'local-token',
            'qwen2.5-coder:7b',
            'http://localhost:11434/v1',
        );
        const context: RefactoringContext = {
            originalCode: 'class Counter {}',
            imports: [],
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
        expect(result).toEqual({
            generatedCode: 'export const answer = 42;',
            usage: { promptTokens: 12, completionTokens: 8, totalTokens: 20 },
        });
    });

    it('rejects empty model responses instead of returning invalid code', async () => {
        mocks.create.mockResolvedValue({
            choices: [{ message: { content: null } }],
            usage: { prompt_tokens: 4, completion_tokens: 0, total_tokens: 4 },
        });
        const provider = new OpenAIProvider('api-token', 'gpt-4o-mini');

        await expect(
            provider.refactorComponent({ originalCode: 'class Counter {}', imports: [] }),
        ).rejects.toThrow('OpenAI-compatible API returned an empty response.');
    });

    it('uses a dummy API key when no key is supplied for a local provider', () => {
        new OpenAIProvider('', 'qwen2.5-coder:7b', 'http://localhost:11434/v1');

        expect(mocks.constructor).toHaveBeenCalledWith({
            apiKey: 'ollama',
            baseURL: 'http://localhost:11434/v1',
        });
    });
});
