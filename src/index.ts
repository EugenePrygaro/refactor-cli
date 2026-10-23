import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { GeminiProvider } from './llm/GeminiProvider';
import { OpenAIProvider } from './llm/OpenAIProvider';
import type { LLMProvider } from './llm/LLMProvider';
import { RefactorPipeline } from './pipeline/RefactorPipeline';

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function createProvider(): LLMProvider {
    const provider = process.env.LLM_PROVIDER ?? 'gemini';

    if (provider === 'gemini') {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY is required when LLM_PROVIDER=gemini.');
        }
        return new GeminiProvider(apiKey);
    }

    if (provider === 'openai') {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error('OPENAI_API_KEY is required when LLM_PROVIDER=openai.');
        }
        return new OpenAIProvider(apiKey, {
            baseURL: process.env.OPENAI_BASE_URL || undefined,
            model: process.env.OPENAI_MODEL || undefined,
        });
    }

    throw new Error(`Unsupported LLM_PROVIDER: ${provider}`);
}

async function main(): Promise<void> {
    const sourcePath = path.resolve(
        __dirname,
        '../../dataset/component-01/LegacyCounter.tsx',
    );
    const generatedPath = path.resolve(
        __dirname,
        '../../dataset/component-01/ModernCounter.tsx',
    );
    const testPath = path.resolve(
        __dirname,
        '../../dataset/component-01/ModernCounter.test.tsx',
    );

    const pipeline = new RefactorPipeline(createProvider());
    const result = await pipeline.run(sourcePath, generatedPath, testPath);
    writeFileSync(generatedPath, result, 'utf8');
    console.log(`Refactored component written to ${generatedPath}`);
}

main().catch((error: unknown) => {
    console.error(`Refactoring failed: ${getErrorMessage(error)}`);
    process.exitCode = 1;
});
