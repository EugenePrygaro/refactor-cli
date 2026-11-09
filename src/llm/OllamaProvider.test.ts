import { describe, expect, it, vi } from 'vitest';
import { OllamaProvider, getNativeOllamaUrl } from './OllamaProvider';

describe('OllamaProvider', () => {
    it('uses native chat and show APIs, records the digest, seed, usage, and truncation warning', async () => {
        const fetcher = vi
            .fn<typeof fetch>()
            .mockResolvedValueOnce(
                new Response(JSON.stringify({ digest: 'sha256:ollama-model-digest' })),
            )
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        message: { content: 'export const answer = 42;' },
                        prompt_eval_count: 1_800,
                        eval_count: 33,
                    }),
                ),
            );
        const provider = new OllamaProvider(
            'https://colab.example/tunnel/v1/',
            'qwen2.5-coder:14b',
            2_048,
            42,
            fetcher,
        );

        await expect(provider.getModelVersion()).resolves.toBe(
            'sha256:ollama-model-digest',
        );
        const result = await provider.refactorComponent({
            originalCode: 'class Counter {}',
            imports: [],
        });

        expect(fetcher).toHaveBeenCalledTimes(2);
        expect(fetcher.mock.calls[0][0]).toBe(
            'https://colab.example/tunnel/api/show',
        );
        expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({
            model: 'qwen2.5-coder:14b',
        });
        expect(fetcher.mock.calls[1][0]).toBe(
            'https://colab.example/tunnel/api/chat',
        );
        expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toMatchObject({
            model: 'qwen2.5-coder:14b',
            stream: false,
            options: {
                temperature: 0.1,
                num_ctx: 2_048,
                seed: 42,
            },
        });
        expect(result).toMatchObject({
            generatedCode: 'export const answer = 42;',
            modelVersion: 'sha256:ollama-model-digest',
            usage: {
                promptTokens: 1_800,
                completionTokens: 33,
                totalTokens: 1_833,
            },
            contextTruncationSuspected: true,
        });
    });

    it('does not flag prompts below the configured safety threshold', async () => {
        const fetcher = vi
            .fn<typeof fetch>()
            .mockResolvedValueOnce(
                new Response(JSON.stringify({ digest: 'sha256:digest' })),
            )
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        message: { content: 'export const answer = 42;' },
                        prompt_eval_count: 1_791,
                        eval_count: 2,
                    }),
                ),
            );
        const provider = new OllamaProvider(
            'http://localhost:11434',
            'qwen-test',
            2_048,
            undefined,
            fetcher,
        );

        const result = await provider.refactorComponent({
            originalCode: 'class Counter {}',
            imports: [],
        });

        expect(result.contextTruncationSuspected).toBe(false);
    });

    it('supports base URLs with and without the OpenAI-compatible suffix', () => {
        expect(getNativeOllamaUrl('http://localhost:11434/v1', '/api/chat')).toBe(
            'http://localhost:11434/api/chat',
        );
        expect(getNativeOllamaUrl('http://localhost:11434', '/api/show')).toBe(
            'http://localhost:11434/api/show',
        );
    });

    it('caches the model digest request', async () => {
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
            new Response(JSON.stringify({ digest: 'sha256:cached' })),
        );
        const provider = new OllamaProvider(
            'http://localhost:11434/v1',
            'qwen-test',
            32_768,
            undefined,
            fetcher,
        );

        await expect(provider.getModelVersion()).resolves.toBe('sha256:cached');
        await expect(provider.getModelVersion()).resolves.toBe('sha256:cached');
        expect(fetcher).toHaveBeenCalledTimes(1);
    });
});
