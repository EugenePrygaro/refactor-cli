import { afterEach, describe, expect, it, vi } from 'vitest';
import { GeminiProvider } from './GeminiProvider';
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
        expect(createProvider('ollama', 'qwen-custom').modelName).toBe('qwen-custom');
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

    it('creates Ollama using its model and base URL without requiring a key', () => {
        vi.stubEnv('ACTIVE_LLM', 'ollama');
        vi.stubEnv('OLLAMA_MODEL', 'qwen2.5-coder:7b');
        vi.stubEnv('OLLAMA_BASE_URL', 'http://localhost:11434/v1');

        expect(createProvider()).toBeInstanceOf(OpenAIProvider);
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
