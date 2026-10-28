import type { LLMProvider } from './LLMProvider';
import { GeminiProvider } from './GeminiProvider';
import { OpenAIProvider } from './OpenAIProvider';

export type ProviderName = 'gemini' | 'openai' | 'ollama';

function requiredEnvironmentVariable(name: string, providerName: ProviderName): string {
    const value = process.env[name]?.trim();
    if (!value) {
        throw new Error(`${name} is required when using the ${providerName} provider.`);
    }
    return value;
}

export function createProvider(providerName?: string): LLMProvider {
    const selectedProvider = providerName ?? process.env.ACTIVE_LLM ?? 'gemini';

    switch (selectedProvider) {
        case 'gemini':
            return new GeminiProvider(
                requiredEnvironmentVariable('GEMINI_API_KEY', 'gemini'),
            );
        case 'openai':
            return new OpenAIProvider(
                requiredEnvironmentVariable('OPENAI_API_KEY', 'openai'),
                process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini',
                process.env.OPENAI_BASE_URL?.trim() || undefined,
            );
        case 'ollama':
            return new OpenAIProvider(
                '',
                requiredEnvironmentVariable('OLLAMA_MODEL', 'ollama'),
                requiredEnvironmentVariable('OLLAMA_BASE_URL', 'ollama'),
            );
        default:
            throw new Error(
                `Unsupported ACTIVE_LLM value "${selectedProvider}". Expected gemini, openai, or ollama.`,
            );
    }
}
