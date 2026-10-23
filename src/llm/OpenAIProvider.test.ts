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
        });
        const provider = new OpenAIProvider('local-token', {
            baseURL: 'http://localhost:11434/v1',
            model: 'qwen2.5-coder:7b',
        });
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
        expect(result).toBe('export const answer = 42;');
    });

    it('rejects empty model responses instead of returning invalid code', async () => {
        mocks.create.mockResolvedValue({
            choices: [{ message: { content: null } }],
        });
        const provider = new OpenAIProvider('api-token');

        await expect(
            provider.refactorComponent({ originalCode: 'class Counter {}', imports: [] }),
        ).rejects.toThrow('OpenAI-compatible API returned an empty response.');
    });
});
