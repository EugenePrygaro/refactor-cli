import { GoogleGenAI } from '@google/genai';
import type {
    LLMProvider,
    RefactoringContext,
    RefactoringResult,
} from './LLMProvider';

export class GeminiProvider implements LLMProvider {
    readonly name = 'Gemini 2.0 Flash';
    private readonly ai: GoogleGenAI;

    constructor(apiKey: string) {
        this.ai = new GoogleGenAI({ apiKey });
    }

    async refactorComponent(context: RefactoringContext): Promise<RefactoringResult> {
        const response = await this.ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: this.buildPrompt(context),
            config: { temperature: 0.1 },
        });
        const text = response.text;

        if (typeof text !== 'string' || text.trim() === '') {
            throw new Error('Gemini returned an empty response.');
        }

        const usage = response.usageMetadata;
        const promptTokens = usage?.promptTokenCount ?? 0;
        const completionTokens = usage?.candidatesTokenCount ?? 0;

        return {
            generatedCode: this.cleanResponse(text),
            usage: {
                promptTokens,
                completionTokens,
                totalTokens: usage?.totalTokenCount ?? promptTokens + completionTokens,
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
