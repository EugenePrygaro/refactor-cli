export interface RefactoringContext {
    originalCode: string;
    imports: string[];
    errorMessage?: string;
}

export interface LLMProvider {
    name: string;
    refactorComponent(context: RefactoringContext): Promise<string>;
}