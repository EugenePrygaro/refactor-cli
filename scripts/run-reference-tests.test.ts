import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runReferenceTests } from './run-reference-tests';

const temporaryDirectories: string[] = [];

afterEach(async () => {
    await Promise.all(
        temporaryDirectories.splice(0).map((directory) =>
            rm(directory, { recursive: true, force: true }),
        ),
    );
});

describe('runReferenceTests', () => {
    it('runs source Jest tests with candidate imports mapped to temporary candidate code', async () => {
        const root = await mkdtemp(path.join(os.tmpdir(), 'reference-runner-'));
        temporaryDirectories.push(root);
        const sourceRoot = path.join(root, 'repository');
        const componentPath = path.join(
            sourceRoot,
            'frontend',
            'src',
            'metabase',
            'visualizations',
            'components',
            'Visualization',
            'Visualization.tsx',
        );
        const sourceTest = path.join(
            path.dirname(componentPath),
            'Visualization-themed.unit.spec.tsx',
        );
        const datasetDirectory = path.join(root, 'dataset', 'component-43');
        const candidatePath = path.join(datasetDirectory, 'ModernVisualization.tsx');
        const jestDirectory = path.join(sourceRoot, 'node_modules', 'jest', 'bin');
        await mkdir(path.dirname(componentPath), { recursive: true });
        await mkdir(datasetDirectory, { recursive: true });
        await mkdir(jestDirectory, { recursive: true });
        await writeFile(componentPath, 'export default function Source() { return null; }');
        await writeFile(
            sourceTest,
            'import Visualization from "."; test("loads", () => expect(Visualization).toBeDefined());',
        );
        await writeFile(candidatePath, 'export default function Candidate() { return null; }');
        await writeFile(
            path.join(sourceRoot, 'jest.config.js'),
            `module.exports = { projects: [{ displayName: 'core', moduleNameMapper: { '^existing$': 'source' } }] };`,
        );
        await writeFile(
            path.join(jestDirectory, 'jest.js'),
            [
                "const fs = require('node:fs');",
                "const configPath = process.argv[process.argv.indexOf('--config') + 1];",
                "const config = require(configPath);",
                "const tests = process.argv.slice(process.argv.indexOf('--runTestsByPath') + 1);",
                "const testContents = tests.map((test) => fs.readFileSync(test, 'utf8'));",
                'process.stdout.write(JSON.stringify({',
                '  mappedCandidateExists: fs.existsSync(config.moduleNameMapper["^metabase/visualizations/components/Visualization$"]),',
                '  preservesExistingMapper: config.moduleNameMapper["^existing$"] === "source",',
                '  hasSourceAlias: testContents.every((contents) => contents.includes("metabase/visualizations/components/Visualization")),',
                '  testPaths: tests,',
                '}));',
            ].join('\n'),
        );
        await writeFile(
            path.join(datasetDirectory, 'source-manifest.json'),
            JSON.stringify({
                sourceRoot: root,
                sourceFile: path.relative(root, componentPath),
                testFiles: [path.relative(root, sourceTest)],
            }),
        );

        const result = await runReferenceTests(datasetDirectory, candidatePath);

        expect(result.passed).toBe(true);
        const details = JSON.parse(result.output) as {
            mappedCandidateExists: boolean;
            preservesExistingMapper: boolean;
            hasSourceAlias: boolean;
            testPaths: string[];
        };
        expect(details).toMatchObject({
            mappedCandidateExists: true,
            preservesExistingMapper: true,
            hasSourceAlias: true,
        });
        expect(details.testPaths[0]).toContain('.candidate-');
        await expect(readFile(componentPath, 'utf8')).resolves.toContain('Source');
        const remainingFiles = await readdir(path.dirname(componentPath));
        expect(remainingFiles.some((file) => file.startsWith('.Visualization.candidate-'))).toBe(
            false,
        );
    });

    it('reports a clear error if the source repository has no Jest installation', async () => {
        const root = await mkdtemp(path.join(os.tmpdir(), 'reference-runner-no-jest-'));
        temporaryDirectories.push(root);
        const sourceRoot = path.join(root, 'repository');
        const sourceFile = path.join(
            sourceRoot,
            'frontend',
            'src',
            'metabase',
            'components',
            'Visualization',
            'Visualization.tsx',
        );
        const datasetDirectory = path.join(root, 'dataset', 'component-01');
        await mkdir(path.dirname(sourceFile), { recursive: true });
        await mkdir(datasetDirectory, { recursive: true });
        await writeFile(path.join(sourceRoot, 'jest.config.js'), 'module.exports = {};');
        await writeFile(sourceFile, 'export default function Source() {}');
        await writeFile(
            path.join(datasetDirectory, 'source-manifest.json'),
            JSON.stringify({
                sourceRoot: root,
                sourceFile: path.relative(root, sourceFile),
                testFiles: [],
            }),
        );

        await expect(runReferenceTests(datasetDirectory)).rejects.toThrow(
            'Jest is not installed',
        );
    });
});
