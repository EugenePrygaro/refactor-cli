import OpenAI from 'openai';
import type {
    LLMProvider,
    RefactoringContext,
    RefactoringResult,
} from './LLMProvider';
import { buildPrompt, cleanModelResponse } from './promptBuilder';

export class OpenAIProvider implements LLMProvider {
    readonly name: string;
    private readonly client: OpenAI;

    constructor(
        apiKey: string,
        readonly modelName: string,
        baseURL?: string,
        readonly providerName: 'openai' | 'ollama' = 'openai',
    ) {
        this.client = new OpenAI({
            apiKey: apiKey || 'ollama',
            ...(baseURL ? { baseURL } : {}),
        });
        this.name = `${providerName} (${modelName})`;
    }

    async refactorComponent(context: RefactoringContext): Promise<RefactoringResult> {
        const response = await this.client.chat.completions.create({
            model: this.modelName,
            messages: [{ role: 'user', content: buildPrompt(context) }],
            temperature: 0.1,
        });
        const content = response.choices[0]?.message.content;
        const rawContent = typeof content === 'string' ? content : '';
        const cleaned = cleanModelResponse(rawContent);

        const promptTokens = response.usage?.prompt_tokens ?? 0;
        const completionTokens = response.usage?.completion_tokens ?? 0;

        return {
            generatedCode: cleaned.code,
            modelVersion: response.model,
            usage: {
                promptTokens,
                completionTokens,
                totalTokens:
                    response.usage?.total_tokens ?? promptTokens + completionTokens,
            },
            rawResponseLength: rawContent.length,
            formatCleaned: cleaned.formatCleaned,
        };
    }

}
