import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runTests } from './tester';

const temporaryDirectories: string[] = [];

afterEach(async () => {
    await Promise.all(
        temporaryDirectories.splice(0).map((directory) =>
            rm(directory, { recursive: true, force: true }),
        ),
    );
});

describe('runTests', () => {
    it('returns an empty string when the component tests pass', async () => {
        const directory = await mkdtemp(path.join(process.cwd(), '.vitest-tester-'));
        temporaryDirectories.push(directory);
        const generatedFilePath = path.join(directory, 'GeneratedComponent.tsx');
        const testFilePath = path.join(directory, 'GeneratedComponent.test.tsx');
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

        const errors = await runTests('export const answer = 42;', generatedFilePath, testFilePath);

        expect(errors).toBe('');
        await expect(rm(generatedFilePath)).rejects.toMatchObject({ code: 'ENOENT' });
    });

    it('returns failure output and removes the temporary component', async () => {
        const directory = await mkdtemp(path.join(process.cwd(), '.vitest-tester-'));
        temporaryDirectories.push(directory);
        const generatedFilePath = path.join(directory, 'GeneratedComponent.tsx');
        const testFilePath = path.join(directory, 'GeneratedComponent.test.tsx');
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

        const errors = await runTests('export const answer = 0;', generatedFilePath, testFilePath);

        expect(errors).toContain('expected');
        await expect(rm(generatedFilePath)).rejects.toMatchObject({ code: 'ENOENT' });
    });
});
