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
