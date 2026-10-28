export interface RefactoringContext {
    originalCode: string;
    imports: string[];
    errorMessage?: string;
}

export interface TokenUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
}

export interface RefactoringResult {
    generatedCode: string;
    usage: TokenUsage;
}

export interface LLMProvider {
    name: string;
    refactorComponent(context: RefactoringContext): Promise<RefactoringResult>;
}