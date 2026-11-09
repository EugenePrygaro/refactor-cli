import 'dotenv/config';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import { getEncoding } from 'js-tiktoken';
import { maskJSX, sliceContext } from '../src/ast/slicer';
import { buildFullContextPrompt, buildPrompt } from '../src/llm/promptBuilder';
import {
    countPromptTokens,
    serializePromptTokenCsv,
    type PromptTokenCounter,
    type PromptTokenRow,
} from '../src/llm/promptTokenCounts';
import { discoverComponentJobs } from '../src/index';

const GPT_MODEL = 'gpt-4o-mini';
const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-2.0-flash';

interface OllamaGenerateResponse {
    prompt_eval_count?: number;
    error?: string;
}

async function main(): Promise<void> {
    const datasetPath = path.resolve(process.argv[2] ?? './dataset');
    const outputPath = path.resolve('./results/tokens/prompt-tokens.csv');
    const jobs = await discoverComponentJobs(datasetPath, path.dirname(outputPath));
    const rows: PromptTokenRow[] = [];

    const gptEncoding = getEncoding('o200k_base');
    const gptCounter: PromptTokenCounter = {
        count(prompt) {
            return gptEncoding.encode(prompt).length;
        },
    };

    let geminiCounter: PromptTokenCounter | undefined;
    if (process.env.GEMINI_API_KEY?.trim()) {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY.trim() });
        geminiCounter = {
            async count(prompt) {
                const result = await ai.models.countTokens({
                    model: GEMINI_MODEL,
                    contents: prompt,
                });
                if (typeof result.totalTokens !== 'number') {
                    throw new Error('Gemini countTokens response did not include totalTokens.');
                }
                return result.totalTokens;
            },
        };
    } else {
        console.warn('Skipping Gemini token counts: GEMINI_API_KEY is not set.');
    }

    const ollamaModel = process.env.OLLAMA_MODEL?.trim();
    const ollamaBaseUrl = process.env.OLLAMA_BASE_URL?.trim();
    const ollamaCounter =
        ollamaModel && ollamaBaseUrl
            ? createOllamaCounter(ollamaModel, getOllamaGenerateUrl(ollamaBaseUrl))
            : undefined;
    if (!ollamaCounter) {
        console.warn(
            'Skipping Ollama token counts: OLLAMA_MODEL and OLLAMA_BASE_URL are required.',
        );
    }

    for (const job of jobs) {
        const source = await readFile(job.sourcePath, 'utf8');
        const { maskedCode, dependencyContract } = maskJSX(source);
        const slicedContext = {
            ...sliceContext(maskedCode),
            dependencyContract,
        };
        const slicedPrompt = buildPrompt(slicedContext);
        const fullPrompt = buildFullContextPrompt(source);

        rows.push(
            await countPromptTokens(job.name, GPT_MODEL, slicedPrompt, fullPrompt, gptCounter),
        );
        if (geminiCounter) {
            rows.push(
                await countPromptTokens(
                    job.name,
                    GEMINI_MODEL,
                    slicedPrompt,
                    fullPrompt,
                    geminiCounter,
                ),
            );
        }
        if (ollamaCounter && ollamaModel) {
            rows.push(
                await countPromptTokens(
                    job.name,
                    ollamaModel,
                    slicedPrompt,
                    fullPrompt,
                    ollamaCounter,
                ),
            );
        }
    }

    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, serializePromptTokenCsv(rows), 'utf8');
    console.log(`Prompt token counts written to ${outputPath}`);
}

function createOllamaCounter(
    model: string,
    endpoint: string,
): PromptTokenCounter {
    return {
        async count(prompt) {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    model,
                    prompt,
                    stream: false,
                    options: { num_predict: 1 },
                }),
            });
            if (!response.ok) {
                throw new Error(
                    `Ollama token count failed with HTTP ${response.status}: ${await response.text()}`,
                );
            }
            const result = (await response.json()) as OllamaGenerateResponse;
            if (result.error) {
                throw new Error(`Ollama token count failed: ${result.error}`);
            }
            if (typeof result.prompt_eval_count !== 'number') {
                throw new Error('Ollama response did not include prompt_eval_count.');
            }
            return result.prompt_eval_count;
        },
    };
}

function getOllamaGenerateUrl(baseUrl: string): string {
    const url = new URL(baseUrl);
    url.pathname = `${url.pathname.replace(/\/v1\/?$/, '').replace(/\/$/, '')}/api/generate`;
    return url.toString();
}

if (require.main === module) {
    main().catch((error: unknown) => {
        console.error(
            `Prompt token counting failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        process.exitCode = 1;
    });
}
