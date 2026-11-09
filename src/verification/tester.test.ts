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

        const result = await runTests(
            'export const answer = 42;',
            generatedFilePath,
            testFilePath,
        );

        expect(result).toMatchObject({
            passed: true,
            testsTotal: 1,
            testsPassed: 1,
            legacyPassed: true,
            generatedPassed: true,
            errorText: '',
        });
        await expect(rm(generatedFilePath)).rejects.toMatchObject({ code: 'ENOENT' });
    }, 20_000);

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

        const result = await runTests(
            'export const answer = 0;',
            generatedFilePath,
            testFilePath,
        );

        expect(result.passed).toBe(false);
        expect(result.generatedPassed).toBe(false);
        expect(result.errorText).toContain('expected');
        await expect(rm(generatedFilePath)).rejects.toMatchObject({ code: 'ENOENT' });
    }, 20_000);

    it('reports legacy and generated contract cases separately', async () => {
        const directory = await mkdtemp(path.join(process.cwd(), '.vitest-tester-'));
        temporaryDirectories.push(directory);
        const generatedFilePath = path.join(directory, 'GeneratedComponent.tsx');
        const testFilePath = path.join(directory, 'GeneratedComponent.test.tsx');
        await writeFile(
            testFilePath,
            `
                import { expect, it } from 'vitest';
                import { answer } from './GeneratedComponent';

                it('satisfies the shared legacy behavior', () => {
                    expect(answer).toBe(0);
                });
                it('satisfies the shared generated behavior', () => {
                    expect(answer).toBe(42);
                });
            `,
        );

        const result = await runTests(
            'export const answer = 42;',
            generatedFilePath,
            testFilePath,
        );

        expect(result).toMatchObject({
            passed: false,
            testsTotal: 2,
            testsPassed: 1,
            legacyPassed: false,
            generatedPassed: true,
        });
        expect(result.errorText).toContain('satisfies the shared legacy behavior');
    }, 20_000);

    it('returns infrastructure failures as structured results', async () => {
        const directory = await mkdtemp(path.join(process.cwd(), '.vitest-tester-'));
        temporaryDirectories.push(directory);
        const result = await runTests(
            'export const answer = 42;',
            path.join(directory, 'GeneratedComponent.tsx'),
            path.join(directory, 'Missing.test.tsx'),
        );

        expect(result).toMatchObject({
            passed: false,
            testsTotal: 0,
            legacyPassed: true,
            generatedPassed: false,
            infrastructureError: true,
        });
        expect(result.errorText).toContain('ENOENT');
    });
});
