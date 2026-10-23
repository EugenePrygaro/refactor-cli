import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { LLMProvider, RefactoringContext } from '../llm/LLMProvider';
import { RefactorPipeline } from './RefactorPipeline';

const temporaryDirectories: string[] = [];

afterEach(async () => {
    await Promise.all(
        temporaryDirectories.splice(0).map((directory) =>
            rm(directory, { recursive: true, force: true }),
        ),
    );
});

describe('RefactorPipeline', () => {
    it('stops at the first failed check and sends its error to the next LLM attempt', async () => {
        const directory = await mkdtemp(path.join(process.cwd(), '.pipeline-test-'));
        temporaryDirectories.push(directory);

        const sourcePath = path.join(directory, 'LegacyComponent.tsx');
        const generatedFilePath = path.join(directory, 'GeneratedComponent.tsx');
        const testFilePath = path.join(directory, 'GeneratedComponent.test.tsx');
        await writeFile(sourcePath, 'export const original = true;');
        await writeFile(
            testFilePath,
            `
                import { expect, it } from 'vitest';
                import { answer } from './GeneratedComponent';

                it('returns the expected value', () => {
                    expect(answer).toBe(42);
                });
            `,
        );

        const generatedResponses = [
            'export const answer = ;',
            `
                import { useState } from 'react';

                export function Component() {
                    if (true) useState(0);
                    return null;
                }
            `,
            'export const answer = 0;',
            'export const answer = 42;',
        ];
        const contexts: RefactoringContext[] = [];
        const llm: LLMProvider = {
            name: 'test',
            async refactorComponent(context) {
                contexts.push({ ...context });
                const response = generatedResponses.shift();
                if (response === undefined) {
                    throw new Error('No generated response remains.');
                }
                return response;
            },
        };

        const result = await new RefactorPipeline(llm, 4).run(
            sourcePath,
            generatedFilePath,
            testFilePath,
        );

        expect(result).toBe('export const answer = 42;');
        expect(contexts).toHaveLength(4);
        expect(contexts[0].errorMessage).toBeUndefined();
        expect(contexts[1].errorMessage).toContain('Syntax verification failed');
        expect(contexts[2].errorMessage).toContain('Linter verification failed');
        expect(contexts[3].errorMessage).toContain('Unit Tests verification failed');
    }, 15_000);
});
