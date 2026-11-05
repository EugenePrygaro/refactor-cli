export interface JSXDependencyContract {
    requiredProps: string[];
    requiredState: string[];
    requiredMethods: string[];
    unresolvedAccesses: string[];
}

export function formatJSXDependencyContract(
    contract: JSXDependencyContract,
): string | undefined {
    const hasDependencies = Object.values(contract).some(
        (dependencies) => dependencies.length > 0,
    );
    if (!hasDependencies) {
        return undefined;
    }

    const list = (values: string[]) =>
        values.length === 0 ? 'none' : values.map((value) => `\`${value}\``).join(', ');
    const sections = [
        'The JSX is masked with placeholders, but it depends on these bindings that must exist in the functional component lexical scope:',
        `- State variables: ${list(contract.requiredState)}`,
        `- Props: ${list(contract.requiredProps)}`,
        `- Handlers: ${list(contract.requiredMethods)}`,
        'Declare required state with useState, expose or destructure required props, and define the required handlers before the JSX is restored.',
    ];

    if (contract.unresolvedAccesses.length > 0) {
        sections.push(
            `- Unresolved instance accesses: ${list(contract.unresolvedAccesses)}. Their exact bindings could not be inferred; preserve their semantics and ensure they work without a class instance.`,
        );
    }

    return sections.join('\n');
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
}

export interface LLMProvider {
    name: string;
    providerName: 'gemini' | 'openai' | 'ollama';
    modelName: string;
    refactorComponent(context: RefactoringContext): Promise<RefactoringResult>;
}