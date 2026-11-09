import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LLMProvider } from './llm/LLMProvider';
import { calculateMetrics } from './metrics/calculator';
import {
    createRunId,
    discoverComponentJobs,
    parseComponentIds,
    runCli,
} from './index';

const metricMocks = vi.hoisted(() => ({
    calculateMetrics: vi.fn(),
    originalCalculateMetrics: undefined as
        | ((sourceCode: string) => Promise<unknown>)
        | undefined,
}));

vi.mock('./metrics/calculator', async (importOriginal) => {
    const actual = await importOriginal<typeof import('./metrics/calculator')>();
    metricMocks.originalCalculateMetrics = actual.calculateMetrics;
    metricMocks.calculateMetrics.mockImplementation(actual.calculateMetrics);
    return {
        ...actual,
        calculateMetrics: metricMocks.calculateMetrics,
    };
});

const temporaryDirectories: string[] = [];

afterEach(async () => {
    vi.restoreAllMocks();
    metricMocks.calculateMetrics.mockReset();
    if (metricMocks.originalCalculateMetrics) {
        metricMocks.calculateMetrics.mockImplementation((sourceCode: string) =>
            metricMocks.originalCalculateMetrics!(sourceCode),
        );
    }
    await Promise.all(
        temporaryDirectories.splice(0).map((directory) =>
            rm(directory, { recursive: true, force: true }),
        ),
    );
});

async function createCliFixture(root: string): Promise<{
    datasetPath: string;
    outputPath: string;
}> {
    const componentPath = path.join(root, 'dataset', 'component-01');
    await mkdir(componentPath, { recursive: true });
    await writeFile(
        path.join(componentPath, 'LegacyCounter.tsx'),
        'export class LegacyCounter {}',
    );
    await writeFile(
        path.join(componentPath, 'ModernCounter.test.tsx'),
        `
            import { expect, it } from 'vitest';
            import { answer } from './ModernCounter';

            it('checks the generated module', () => {
                expect(answer).toBe(42);
            });
        `,
    );

    return {
        datasetPath: path.join(root, 'dataset'),
        outputPath: path.join(root, 'results'),
    };
}

describe('discoverComponentJobs', () => {
    it('finds components in sorted order and maps source, test, and output paths', async () => {
        const root = await mkdtemp(path.join(os.tmpdir(), 'refactor-cli-'));
        temporaryDirectories.push(root);
        const datasetPath = path.join(root, 'dataset');
        const outputPath = path.join(root, 'results');

        for (const name of ['component-02', 'component-01']) {
            const componentPath = path.join(datasetPath, name);
            await mkdir(componentPath, { recursive: true });
            await writeFile(path.join(componentPath, 'LegacyCounter.tsx'), 'export class Counter {}');
            await writeFile(path.join(componentPath, 'ModernCounter.test.tsx'), 'import { it } from "vitest";');
        }

        const jobs = await discoverComponentJobs(datasetPath, outputPath);

        expect(jobs.map((job) => job.name)).toEqual(['component-01', 'component-02']);
        expect(jobs[0]).toEqual({
            name: 'component-01',
            sourcePath: path.join(datasetPath, 'component-01', 'LegacyCounter.tsx'),
            generatedPath: path.join(datasetPath, 'component-01', 'ModernCounter.tsx'),
            testPath: path.join(datasetPath, 'component-01', 'ModernCounter.test.tsx'),
            outputPath: path.join(outputPath, 'component-01', 'ModernCounter.tsx'),
        });
    });

    it('selects only the requested components', async () => {
        const root = await mkdtemp(path.join(os.tmpdir(), 'refactor-cli-selected-'));
        temporaryDirectories.push(root);
        const datasetPath = path.join(root, 'dataset');
        const outputPath = path.join(root, 'results');

        for (const name of ['component-03', 'component-02', 'component-01']) {
            const componentPath = path.join(datasetPath, name);
            await mkdir(componentPath, { recursive: true });
            await writeFile(
                path.join(componentPath, 'LegacyCounter.tsx'),
                'export class Counter {}',
            );
            await writeFile(
                path.join(componentPath, 'ModernCounter.test.tsx'),
                'import { it } from "vitest";',
            );
        }

        const jobs = await discoverComponentJobs(datasetPath, outputPath, [
            'component-03',
            'component-01',
        ]);

        expect(jobs.map((job) => job.name)).toEqual([
            'component-01',
            'component-03',
        ]);
    });

    it('rejects requested components that are not in the dataset', async () => {
        const root = await mkdtemp(path.join(os.tmpdir(), 'refactor-cli-unknown-'));
        temporaryDirectories.push(root);
        const componentPath = path.join(root, 'component-01');
        await mkdir(componentPath);
        await writeFile(path.join(componentPath, 'LegacyCounter.tsx'), 'export class Counter {}');
        await writeFile(
            path.join(componentPath, 'ModernCounter.test.tsx'),
            'import { it } from "vitest";',
        );

        await expect(
            discoverComponentJobs(root, path.join(root, 'results'), ['component-99']),
        ).rejects.toThrow('Unknown component ID(s): component-99');
    });

    it('reports component folders with ambiguous source files', async () => {
        const root = await mkdtemp(path.join(os.tmpdir(), 'refactor-cli-'));
        temporaryDirectories.push(root);
        const componentPath = path.join(root, 'component-01');
        await mkdir(componentPath);
        await writeFile(path.join(componentPath, 'First.tsx'), 'export const First = 1;');
        await writeFile(path.join(componentPath, 'Second.tsx'), 'export const Second = 2;');

        await expect(discoverComponentJobs(root, path.join(root, 'results'))).rejects.toThrow(
            'must contain exactly one source component file',
        );
    });

    it('rejects empty datasets', async () => {
        const root = await mkdtemp(path.join(os.tmpdir(), 'refactor-cli-empty-'));
        temporaryDirectories.push(root);

        await expect(discoverComponentJobs(root, path.join(root, 'results'))).rejects.toThrow(
            'No component-* directories found',
        );
    });

    it('reports when a component has no matching test file', async () => {
        const root = await mkdtemp(path.join(os.tmpdir(), 'refactor-cli-no-tests-'));
        temporaryDirectories.push(root);
        const componentPath = path.join(root, 'component-01');
        await mkdir(componentPath);
        await writeFile(path.join(componentPath, 'LegacyCounter.tsx'), 'export class Counter {}');

        await expect(discoverComponentJobs(root, path.join(root, 'results'))).rejects.toThrow(
            'needs exactly one matching test file (found 0)',
        );
    });
});

describe('parseComponentIds', () => {
    it('parses comma-separated IDs and trims surrounding whitespace', () => {
        expect(parseComponentIds(' component-06,component-51 ')).toEqual([
            'component-06',
            'component-51',
        ]);
    });

    it('rejects empty or malformed IDs', () => {
        expect(() => parseComponentIds('component-01,,component-02')).toThrow(
            'comma-separated component IDs',
        );
        expect(() => parseComponentIds('../component-01')).toThrow(
            'comma-separated component IDs',
        );
    });
});

describe('createRunId', () => {
    it('includes provider, model, and a unique suffix for default run IDs', () => {
        const first = createRunId(undefined, 'ollama', 'Qwen 2.5 Coder');
        const second = createRunId(undefined, 'ollama', 'Qwen 2.5 Coder');

        expect(first).toMatch(/^ollama-qwen-2-5-coder-/);
        expect(second).not.toBe(first);
    });

    it('rejects IDs that could escape the output directory', () => {
        expect(() => createRunId('../outside', 'ollama', 'model')).toThrow(
            'Run ID may contain only',
        );
    });
});

describe('runCli', () => {
    it('runs generation and verification and writes the component and CSV report', async () => {
        const root = await mkdtemp(path.join(process.cwd(), '.refactor-cli-e2e-'));
        temporaryDirectories.push(root);
        const { datasetPath, outputPath } = await createCliFixture(root);
        const provider: LLMProvider = {
            name: 'test',
            providerName: 'openai',
            modelName: 'test-model',
            async getModelVersion() {
                return 'test-model-version';
            },
            async refactorComponent() {
                return {
                    generatedCode: 'export const answer = 42;',
                    modelVersion: 'test-model-version',
                    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
                };
            },
        };
        vi.spyOn(console, 'log').mockImplementation(() => undefined);
        vi.spyOn(console, 'error').mockImplementation(() => undefined);

        await runCli(
            { dataset: datasetPath, out: outputPath, provider: 'openai', runId: 'e2e-run' },
            provider,
        );

        const runPath = path.join(outputPath, 'e2e-run');
        await expect(
            readFile(path.join(runPath, 'component-01', 'ModernCounter.tsx'), 'utf8'),
        ).resolves.toBe('export const answer = 42;');
        const report = await readFile(path.join(runPath, 'report.csv'), 'utf8');
        expect(report).toContain('component-01');
        expect(report).toContain(',Success,');
        expect(report).toContain(',10,5,15,');
        const attempts = await readFile(path.join(runPath, 'attempts.csv'), 'utf8');
        expect(attempts).toContain(
            'component,model,attempt,stage_reached,failure_stage',
        );
        expect(attempts).toContain(
            'component-01,test-model,1,Test,None,,,0,test-model-version,false,10,5,15',
        );
        const runMetadata = JSON.parse(
            await readFile(path.join(runPath, 'run.json'), 'utf8'),
        ) as {
            provider: string;
            model: string;
            modelVersion: string | null;
            timestamp: string;
            gitCommit: string | null;
            seed: number | null;
            temperature: number;
            maxAttempts: number;
        };
        expect(runMetadata).toMatchObject({
            provider: 'openai',
            model: 'test-model',
            modelVersion: 'test-model-version',
            seed: null,
            temperature: 0.1,
            maxAttempts: 3,
        });
        expect(Number.isNaN(Date.parse(runMetadata.timestamp))).toBe(false);
        expect(runMetadata.gitCommit === null || /^[\da-f]{40}$/i.test(runMetadata.gitCommit)).toBe(true);
        await expect(
            readFile(path.join(datasetPath, 'component-01', 'ModernCounter.tsx'), 'utf8'),
        ).rejects.toMatchObject({ code: 'ENOENT' });
    }, 30_000);

    it('keeps Success and saves the candidate when before and after metrics fail', async () => {
        const root = await mkdtemp(path.join(process.cwd(), '.refactor-cli-metrics-failure-'));
        temporaryDirectories.push(root);
        const { datasetPath, outputPath } = await createCliFixture(root);
        const provider: LLMProvider = {
            name: 'test',
            providerName: 'openai',
            modelName: 'test-model',
            async refactorComponent() {
                return {
                    generatedCode: 'export const answer = 42;',
                    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
                };
            },
        };
        vi.mocked(calculateMetrics).mockResolvedValue({
            ok: false,
            error: 'simulated metrics failure',
        });
        vi.spyOn(console, 'log').mockImplementation(() => undefined);
        vi.spyOn(console, 'error').mockImplementation(() => undefined);

        await runCli(
            { dataset: datasetPath, out: outputPath, provider: 'openai', runId: 'metrics-run' },
            provider,
        );

        const runPath = path.join(outputPath, 'metrics-run');
        await expect(
            readFile(path.join(runPath, 'component-01', 'ModernCounter.tsx'), 'utf8'),
        ).resolves.toBe('export const answer = 42;');
        const report = await readFile(path.join(runPath, 'report.csv'), 'utf8');
        const [headerLine, resultLine] = report.trimEnd().split('\n');
        const headers = headerLine.split(',');
        const values = resultLine.split(',');

        expect(values[headers.indexOf('status')]).toBe('Success');
        expect(values[headers.indexOf('before_metrics_error')]).toBe(
            'simulated metrics failure',
        );
        expect(values[headers.indexOf('after_metrics_error')]).toBe(
            'simulated metrics failure',
        );
    }, 30_000);

    it('runs only the selected components', async () => {
        const root = await mkdtemp(path.join(process.cwd(), '.refactor-cli-selected-'));
        temporaryDirectories.push(root);
        const { datasetPath, outputPath } = await createCliFixture(root);
        const secondComponent = path.join(datasetPath, 'component-02');
        await mkdir(secondComponent);
        await writeFile(
            path.join(secondComponent, 'LegacyCounter.tsx'),
            'export class LegacyCounter {}',
        );
        await writeFile(
            path.join(secondComponent, 'ModernCounter.test.tsx'),
            `
                import { expect, it } from 'vitest';
                import { answer } from './ModernCounter';

                it('checks the selected generated module', () => {
                    expect(answer).toBe(7);
                });

            `,
        );
        const refactorComponent = vi.fn(async () => ({
            generatedCode: 'export const answer = 7;',
            usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        }));
        const provider: LLMProvider = {
            name: 'test',
            providerName: 'openai',
            modelName: 'test-model',
            refactorComponent,
        };
        vi.spyOn(console, 'log').mockImplementation(() => undefined);
        vi.spyOn(console, 'error').mockImplementation(() => undefined);

        await runCli(
            {
                dataset: datasetPath,
                out: outputPath,
                provider: 'openai',
                runId: 'selected-run',
                components: ['component-02'],
            },
            provider,
        );

        expect(refactorComponent).toHaveBeenCalledOnce();
        const runPath = path.join(outputPath, 'selected-run');
        await expect(
            readFile(path.join(runPath, 'component-02', 'ModernCounter.tsx'), 'utf8'),
        ).resolves.toBe('export const answer = 7;');
        await expect(
            readFile(path.join(runPath, 'component-01', 'ModernCounter.tsx'), 'utf8'),
        ).rejects.toMatchObject({ code: 'ENOENT' });
        const report = await readFile(path.join(runPath, 'report.csv'), 'utf8');
        expect(report).toContain('component-02');
        expect(report).not.toContain('component-01');
    }, 30_000);

    it('excludes non-class components in class-only mode without calling the model', async () => {
        const root = await mkdtemp(path.join(process.cwd(), '.refactor-cli-class-only-'));
        temporaryDirectories.push(root);
        const { datasetPath, outputPath } = await createCliFixture(root);
        const refactorComponent = vi.fn(async () => ({
            generatedCode: 'export const answer = 42;',
            usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        }));
        const provider: LLMProvider = {
            name: 'test',
            providerName: 'openai',
            modelName: 'test-model',
            refactorComponent,
        };
        vi.spyOn(console, 'log').mockImplementation(() => undefined);
        vi.spyOn(console, 'error').mockImplementation(() => undefined);

        await runCli(
            {
                dataset: datasetPath,
                out: outputPath,
                provider: 'openai',
                runId: 'class-only',
                classOnly: true,
            },
            provider,
        );

        expect(refactorComponent).not.toHaveBeenCalled();
        const report = await readFile(
            path.join(outputPath, 'class-only', 'report.csv'),
            'utf8',
        );
        const [headerLine, resultLine] = report.trimEnd().split('\n');
        const headers = headerLine.split(',');
        const values = resultLine.split(',');
        expect(values[headers.indexOf('status')]).toBe('Excluded');
        expect(values[headers.indexOf('is_class_component')]).toBe('false');
        expect(values[headers.indexOf('attempts')]).toBe('0');
    }, 30_000);

    it('records a provider failure and rejects the run after writing its report', async () => {
        const root = await mkdtemp(path.join(process.cwd(), '.refactor-cli-failure-'));
        temporaryDirectories.push(root);
        const { datasetPath, outputPath } = await createCliFixture(root);
        const provider: LLMProvider = {
            name: 'test',
            providerName: 'openai',
            modelName: 'test-model',
            async refactorComponent() {
                throw new Error('simulated model failure');
            },
        };
        vi.spyOn(console, 'log').mockImplementation(() => undefined);
        vi.spyOn(console, 'error').mockImplementation(() => undefined);

        await expect(
            runCli(
                { dataset: datasetPath, out: outputPath, provider: 'openai', runId: 'failed-run' },
                provider,
            ),
        ).rejects.toThrow('1 component(s) failed.');

        const runPath = path.join(outputPath, 'failed-run');
        const report = await readFile(path.join(runPath, 'report.csv'), 'utf8');
        expect(report).toContain(',Fail,');
        expect(report).toContain('simulated model failure');
        await expect(
            readFile(path.join(runPath, 'component-01', 'ModernCounter.tsx'), 'utf8'),
        ).rejects.toMatchObject({ code: 'ENOENT' });
    });

    it('stops the overall run on a fatal provider configuration error', async () => {
        const root = await mkdtemp(path.join(os.tmpdir(), 'refactor-cli-fatal-'));
        temporaryDirectories.push(root);
        const { datasetPath, outputPath } = await createCliFixture(root);
        const secondComponent = path.join(datasetPath, 'component-02');
        await mkdir(secondComponent);
        await writeFile(
            path.join(secondComponent, 'LegacyCounter.tsx'),
            'export class LegacyCounter {}',
        );
        await writeFile(
            path.join(secondComponent, 'ModernCounter.test.tsx'),
            `import { it } from 'vitest'; it('exists', () => {});`,
        );
        const refactorComponent = vi.fn(async () => {
            throw Object.assign(new Error('The requested model was not found.'), {
                status: 404,
            });
        });
        const provider: LLMProvider = {
            name: 'test',
            providerName: 'openai',
            modelName: 'missing-model',
            refactorComponent,
        };
        vi.spyOn(console, 'log').mockImplementation(() => undefined);
        vi.spyOn(console, 'error').mockImplementation(() => undefined);

        await expect(
            runCli(
                { dataset: datasetPath, out: outputPath, provider: 'openai', runId: 'fatal-run' },
                provider,
            ),
        ).rejects.toThrow('Fatal LLM configuration error');

        expect(refactorComponent).toHaveBeenCalledOnce();
        const report = await readFile(
            path.join(outputPath, 'fatal-run', 'report.csv'),
            'utf8',
        );
        expect(report).toContain(',Fail,');
        expect(report.trimEnd().split('\n')).toHaveLength(2);
    });
});
