import { describe, expect, it } from 'vitest';
import {
    buildFullContextPrompt,
    buildPrompt,
    cleanModelResponse,
} from './promptBuilder';

describe('promptBuilder', () => {
    it('preserves the prompt text previously sent by both providers', () => {
        const prompt = buildPrompt({
            imports: ["import React from 'react';"],
            originalCode: 'const Component = () => <JSX_MASK_0 />;',
            dependencyContract: {
                requiredProps: ['title'],
                requiredState: ['count'],
                requiredMethods: ['handleClick'],
                unresolvedAccesses: [],
            },
            errorMessage: 'Previous verification failed.',
        });

        expect(prompt).toMatchInlineSnapshot(`
          "You are a senior React engineer. Refactor the legacy React class component into a modern functional component using React Hooks where appropriate.

          The previous generated result failed verification. Fix the following error while preserving the original behavior:
          \`\`\`
          Previous verification failed.
          \`\`\`

          Original imports:
          \`\`\`tsx
          import React from 'react';
          \`\`\`

          Keep every JSX_MASK_N placeholder exactly unchanged and include each one exactly once in the refactored component.

          The JSX is masked with placeholders, but it depends on these bindings that must exist in the functional component lexical scope:
          - State variables: \`count\`
          - Props: \`title\`
          - Handlers: \`handleClick\`
          Declare required state with useState, expose or destructure required props, and define the required handlers before the JSX is restored.

          Original component code:
          \`\`\`tsx
          const Component = () => <JSX_MASK_0 />;
          \`\`\`

          Return only valid TypeScript/TSX source code. Do not include explanations or Markdown fences. Preserve all required imports and exports."
        `);
    });

    it('builds full-context prompts with the original unmasked file and no dependency contract', () => {
        const source = "import React from 'react';\nclass Counter { render() { return <div>{this.state.count}</div>; } }";
        const prompt = buildFullContextPrompt(source);

        expect(prompt).toContain(`Original component code:\n\`\`\`tsx\n${source}\n\`\`\``);
        expect(prompt).not.toContain('JSX_MASK_');
        expect(prompt).not.toContain('State variables:');
        expect(prompt).not.toContain('Original imports:');
    });

    it('cleans model responses using the shared implementation', () => {
        expect(cleanModelResponse('```tsx\nexport const value = 1;\n```')).toEqual({
            code: 'export const value = 1;',
            formatCleaned: true,
        });
    });
});
