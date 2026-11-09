export interface JSXDependencyContract {
    requiredProps: string[];
    requiredState: string[];
    requiredMethods: string[];
    unresolvedAccesses: string[];
}

export interface RefactoringContext {
    originalCode: string;
    imports: string[];
    dependencyContract?: JSXDependencyContract;
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
    rawResponseLength?: number;
    formatCleaned?: boolean;
    modelVersion?: string;
    contextTruncationSuspected?: boolean;
}

export interface LLMProvider {
    name: string;
    providerName: 'gemini' | 'openai' | 'ollama';
    modelName: string;
    refactorComponent(context: RefactoringContext): Promise<RefactoringResult>;
    getModelVersion?(): Promise<string>;
}