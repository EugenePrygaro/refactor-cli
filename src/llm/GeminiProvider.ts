import { GoogleGenAI } from '@google/genai';
import type {
    LLMProvider,
    RefactoringContext,
    RefactoringResult,
} from './LLMProvider';
import { cleanModelResponse, buildPrompt } from './promptBuilder';

export class GeminiProvider implements LLMProvider {
    readonly providerName = 'gemini';
    readonly name: string;
    private readonly ai: GoogleGenAI;

    constructor(
        apiKey: string,
        readonly modelName = 'gemini-2.0-flash',
        readonly seed?: number,
    ) {
        this.ai = new GoogleGenAI({ apiKey });
        this.name = `Gemini (${modelName})`;
    }

    async refactorComponent(context: RefactoringContext): Promise<RefactoringResult> {
        const response = await this.ai.models.generateContent({
            model: this.modelName,
            contents: buildPrompt(context),
            config: {
                temperature: 0.1,
                ...(this.seed === undefined ? {} : { seed: this.seed }),
            },
        });
        const text = response.text;
        const rawContent = typeof text === 'string' ? text : '';
        const cleaned = cleanModelResponse(rawContent);

        const usage = response.usageMetadata;
        const promptTokens = usage?.promptTokenCount ?? 0;
        const completionTokens = usage?.candidatesTokenCount ?? 0;

        return {
            generatedCode: cleaned.code,
            modelVersion: response.modelVersion,
            usage: {
                promptTokens,
                completionTokens,
                totalTokens: usage?.totalTokenCount ?? promptTokens + completionTokens,
            },
            rawResponseLength: rawContent.length,
            formatCleaned: cleaned.formatCleaned,
        };
    }

}
