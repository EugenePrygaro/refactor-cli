import { afterEach, describe, expect, it, vi } from 'vitest';
import { GeminiProvider } from './GeminiProvider';
import { OllamaProvider } from './OllamaProvider';
import { OpenAIProvider } from './OpenAIProvider';
import { createProvider } from './ProviderFactory';

afterEach(() => {
    vi.unstubAllEnvs();
});

describe('createProvider', () => {
    it('creates Gemini using GEMINI_API_KEY and ACTIVE_LLM', () => {
        vi.stubEnv('ACTIVE_LLM', 'gemini');
        vi.stubEnv('GEMINI_API_KEY', 'gemini-token');

        expect(createProvider()).toBeInstanceOf(GeminiProvider);
    });

    it('allows selecting an explicit model ID for each provider', () => {
        vi.stubEnv('GEMINI_API_KEY', 'gemini-token');
        vi.stubEnv('OPENAI_API_KEY', 'openai-token');
        vi.stubEnv('OLLAMA_BASE_URL', 'http://localhost:11434/v1');

        expect(createProvider('gemini', 'gemini-latest').modelName).toBe('gemini-latest');
        expect(createProvider('openai', 'gpt-custom').modelName).toBe('gpt-custom');
        const ollama = createProvider('ollama', 'qwen-custom');
        expect(ollama).toBeInstanceOf(OllamaProvider);
        expect(ollama.modelName).toBe('qwen-custom');
    });

    it('uses the Gemini model environment variable when no override is given', () => {
        vi.stubEnv('GEMINI_API_KEY', 'gemini-token');
        vi.stubEnv('GEMINI_MODEL', 'gemini-test');

        expect(createProvider('gemini').modelName).toBe('gemini-test');
    });

    it('rejects an empty model override', () => {
        expect(() => createProvider('openai', '  ')).toThrow('Model ID must not be empty.');
    });

    it('creates OpenAI using OPENAI_API_KEY', () => {
        vi.stubEnv('ACTIVE_LLM', 'openai');
        vi.stubEnv('OPENAI_API_KEY', 'openai-token');

        expect(createProvider()).toBeInstanceOf(OpenAIProvider);
    });

    it('creates native Ollama provider using its model and base URL without requiring a key', () => {
        vi.stubEnv('ACTIVE_LLM', 'ollama');
        vi.stubEnv('OLLAMA_MODEL', 'qwen2.5-coder:7b');
        vi.stubEnv('OLLAMA_BASE_URL', 'http://localhost:11434/v1');

        expect(createProvider()).toBeInstanceOf(OllamaProvider);
    });

    it('passes the seed and configured context window to the Ollama provider', () => {
        vi.stubEnv('OLLAMA_MODEL', 'qwen2.5-coder:14b');
        vi.stubEnv('OLLAMA_BASE_URL', 'https://colab.example/tunnel');
        vi.stubEnv('OLLAMA_NUM_CTX', '65536');

        const provider = createProvider('ollama', undefined, 73);

        expect(provider).toBeInstanceOf(OllamaProvider);
        if (provider instanceof OllamaProvider) {
            expect(provider.numCtx).toBe(65_536);
            expect(provider.seed).toBe(73);
        }
    });

    it('throws a clear error when a selected provider is missing its key', () => {
        vi.stubEnv('ACTIVE_LLM', 'openai');
        vi.stubEnv('OPENAI_API_KEY', '');

        expect(() => createProvider()).toThrow(
            'OPENAI_API_KEY is required when using the openai provider.',
        );
    });

    it('rejects unsupported provider values', () => {
        vi.stubEnv('ACTIVE_LLM', 'unknown');

        expect(() => createProvider()).toThrow(
            'Unsupported ACTIVE_LLM value "unknown". Expected gemini, openai, or ollama.',
        );
    });
});
