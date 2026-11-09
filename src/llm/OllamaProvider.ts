import type {
    LLMProvider,
    RefactoringContext,
    RefactoringResult,
} from './LLMProvider';
import { buildPrompt, cleanModelResponse } from './promptBuilder';

interface OllamaChatResponse {
    message?: { content?: string };
    prompt_eval_count?: number;
    eval_count?: number;
    error?: string;
}

interface OllamaShowResponse {
    digest?: string;
    error?: string;
}

export const DEFAULT_OLLAMA_NUM_CTX = 32_768;

export class OllamaProvider implements LLMProvider {
    readonly name: string;
    readonly providerName = 'ollama';
    private readonly chatUrl: string;
    private readonly showUrl: string;
    private modelVersionPromise?: Promise<string>;

    constructor(
        baseUrl: string,
        readonly modelName: string,
        readonly numCtx = getOllamaNumCtx(),
        readonly seed?: number,
        private readonly fetcher: typeof fetch = fetch,
    ) {
        if (!Number.isInteger(numCtx) || numCtx <= 256) {
            throw new RangeError('OLLAMA_NUM_CTX must be an integer greater than 256.');
        }
        this.chatUrl = getNativeOllamaUrl(baseUrl, '/api/chat');
        this.showUrl = getNativeOllamaUrl(baseUrl, '/api/show');
        this.name = `ollama (${modelName})`;
    }

    async getModelVersion(): Promise<string> {
        this.modelVersionPromise ??= this.fetchModelVersion();
        return this.modelVersionPromise;
    }

    async refactorComponent(context: RefactoringContext): Promise<RefactoringResult> {
        const modelVersion = await this.getModelVersion();
        const prompt = buildPrompt(context);
        const response = await this.fetcher(this.chatUrl, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                model: this.modelName,
                messages: [{ role: 'user', content: prompt }],
                stream: false,
                options: {
                    temperature: 0.1,
                    num_ctx: this.numCtx,
                    ...(this.seed === undefined ? {} : { seed: this.seed }),
                },
            }),
        });
        const result = await readOllamaResponse<OllamaChatResponse>(
            response,
            'chat',
        );
        const rawContent = result.message?.content ?? '';
        const cleaned = cleanModelResponse(rawContent);
        const promptTokens = result.prompt_eval_count ?? 0;
        const completionTokens = result.eval_count ?? 0;

        return {
            generatedCode: cleaned.code,
            modelVersion,
            usage: {
                promptTokens,
                completionTokens,
                totalTokens: promptTokens + completionTokens,
            },
            rawResponseLength: rawContent.length,
            formatCleaned: cleaned.formatCleaned,
            contextTruncationSuspected: promptTokens >= this.numCtx - 256,
        };
    }

    private async fetchModelVersion(): Promise<string> {
        const response = await this.fetcher(this.showUrl, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ model: this.modelName }),
        });
        const result = await readOllamaResponse<OllamaShowResponse>(
            response,
            'show',
        );
        if (!result.digest) {
            throw new Error(
                `Ollama /api/show response for "${this.modelName}" did not include a model digest.`,
            );
        }
        return result.digest;
    }
}

export function getNativeOllamaUrl(baseUrl: string, endpointPath: string): string {
    let url: URL;
    try {
        url = new URL(baseUrl);
    } catch (error: unknown) {
        throw new Error(`Invalid OLLAMA_BASE_URL "${baseUrl}".`, { cause: error });
    }
    url.pathname = `${url.pathname.replace(/\/v1\/?$/, '').replace(/\/$/, '')}${endpointPath}`;
    url.search = '';
    url.hash = '';
    return url.toString();
}

function getOllamaNumCtx(): number {
    const configured = process.env.OLLAMA_NUM_CTX?.trim();
    if (!configured) {
        return DEFAULT_OLLAMA_NUM_CTX;
    }
    const numCtx = Number(configured);
    if (!Number.isInteger(numCtx) || numCtx <= 256) {
        throw new RangeError('OLLAMA_NUM_CTX must be an integer greater than 256.');
    }
    return numCtx;
}

async function readOllamaResponse<T extends { error?: string }>(
    response: Response,
    operation: 'chat' | 'show',
): Promise<T> {
    if (!response.ok) {
        throw new Error(
            `Ollama /api/${operation} failed with HTTP ${response.status}: ${await response.text()}`,
        );
    }
    const result = (await response.json()) as T;
    if (result.error) {
        throw new Error(`Ollama /api/${operation} failed: ${result.error}`);
    }
    return result;
}
