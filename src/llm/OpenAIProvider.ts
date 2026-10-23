import OpenAI from 'openai';
import type { LLMProvider, RefactoringContext } from './LLMProvider';

export interface OpenAIProviderOptions {
    baseURL?: string;
    model?: string;
}

export class OpenAIProvider implements LLMProvider {
    public name = 'OpenAI-compatible API';
    private client: OpenAI;
    private model: string;

    constructor(
        apiKey: string,
        { baseURL, model = 'gpt-4o-mini' }: OpenAIProviderOptions = {},
    ) {
        this.client = new OpenAI({
            apiKey,
            ...(baseURL ? { baseURL } : {}),
        });
        this.model = model;
    }

    async refactorComponent(context: RefactoringContext): Promise<string> {
        const response = await this.client.chat.completions.create({
            model: this.model,
            messages: [{ role: 'user', content: this.buildPrompt(context) }],
            temperature: 0.1,
        });
        const content = response.choices[0]?.message.content;

        if (typeof content !== 'string' || content.trim() === '') {
            throw new Error('OpenAI-compatible API returned an empty response.');
        }

        return this.cleanResponse(content);
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
