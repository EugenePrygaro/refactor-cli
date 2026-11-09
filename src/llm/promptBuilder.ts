import type {
    JSXDependencyContract,
    RefactoringContext,
} from './LLMProvider';

export interface CleanedModelResponse {
    code: string;
    formatCleaned: boolean;
}

export function buildPrompt(context: RefactoringContext): string {
    return createPrompt(context, true);
}

export function buildFullContextPrompt(sourceCode: string): string {
    return createPrompt({ originalCode: sourceCode, imports: [] }, false);
}

function createPrompt(
    context: RefactoringContext,
    includePlaceholderInstruction: boolean,
): string {
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

    if (
        includePlaceholderInstruction &&
        /\bJSX_MASK_\d+\b/.test(context.originalCode)
    ) {
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

export function cleanModelResponse(text: string): CleanedModelResponse {
    const trimmed = text.trim();
    const fencedBlock = trimmed.match(
        /```(?:tsx|ts|typescript|javascript|js|jsx)?\s*\r?\n([\s\S]*?)\r?\n?```/i,
    );
    if (fencedBlock) {
        return {
            code: fencedBlock[1].trim(),
            formatCleaned: true,
        };
    }

    const sourceStart = trimmed.search(
        /^(?:import\b|export\b|declare\b|type\b|interface\b|class\b|function\b|async\s+function\b|const\b|let\b|var\b|\/[/*]|["']use strict["'];?|<)/m,
    );
    if (sourceStart > 0) {
        return {
            code: trimmed.slice(sourceStart).trim(),
            formatCleaned: true,
        };
    }

    return {
        code: trimmed,
        formatCleaned: trimmed !== text,
    };
}
