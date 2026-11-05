import OpenAI from 'openai';
import type {
    LLMProvider,
    RefactoringContext,
    RefactoringResult,
} from './LLMProvider';
import { formatJSXDependencyContract } from './LLMProvider';

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
            messages: [{ role: 'user', content: this.buildPrompt(context) }],
            temperature: 0.1,
        });
        const content = response.choices[0]?.message.content;

        if (typeof content !== 'string' || content.trim() === '') {
            throw new Error('OpenAI-compatible API returned an empty response.');
        }

        const promptTokens = response.usage?.prompt_tokens ?? 0;
        const completionTokens = response.usage?.completion_tokens ?? 0;

        return {
            generatedCode: this.cleanResponse(content),
            usage: {
                promptTokens,
                completionTokens,
                totalTokens:
                    response.usage?.total_tokens ?? promptTokens + completionTokens,
            },
        };
    }

    private buildPrompt(context: RefactoringContext): string {
        const sections = [
            'You are a senior React engineer. Refactor the legacy React class component into a modern functional component using React Hooks where appropriate.',
        ];

        if (context.errorMessage) {
            sections.push(
                `The previous generated result failed verification. Fix the following error while preserving the original behavior:\n\`\`\`\n${context.errorMessage}\n\`\`\``,
            );
        }

        if (context.imports.length > 0) {
            sections.push(
                `Original imports:\n\`\`\`tsx\n${context.imports.join('\n')}\n\`\`\``,
            );
        }

        if (/\bJSX_MASK_\d+\b/.test(context.originalCode)) {
            sections.push(
                'Keep every JSX_MASK_N placeholder exactly unchanged and include each one exactly once in the refactored component.',
            );
        }

        const dependencyContract = context.dependencyContract
            ? formatJSXDependencyContract(context.dependencyContract)
            : undefined;
        if (dependencyContract) {
            sections.push(dependencyContract);
        }

        sections.push(
            `Original component code:\n\`\`\`tsx\n${context.originalCode}\n\`\`\``,
            'Return only valid TypeScript/TSX source code. Do not include explanations or Markdown fences. Preserve all required imports and exports.',
        );

        return sections.join('\n\n');
    }

    private cleanResponse(text: string): string {
        return text
            .replace(/^```(?:tsx|ts|typescript|javascript|js)?\s*\r?\n/i, '')
            .replace(/\r?\n?```\s*$/, '')
            .trim();
    }
}
