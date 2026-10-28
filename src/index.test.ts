import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { discoverComponentJobs } from './index';

const temporaryDirectories: string[] = [];

afterEach(async () => {
    await Promise.all(
        temporaryDirectories.splice(0).map((directory) =>
            rm(directory, { recursive: true, force: true }),
        ),
    );
});

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
});
