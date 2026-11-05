import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

interface SourceManifest {
    sourceRoot: string;
    sourceFile: string;
    testFiles: string[];
}

interface DatasetManifest {
    components: { id: string; upstreamControl?: boolean }[];
}

export interface ReferenceTestResult {
    passed: boolean;
    output: string;
}

function getComponentModuleSpecifier(
    repositoryRoot: string,
    sourceFile: string,
): string {
    const sourceRoot = path.join(repositoryRoot, 'frontend', 'src');
    const componentDirectory = path.dirname(sourceFile);
    const relativeDirectory = path.relative(sourceRoot, componentDirectory);
    if (
        relativeDirectory === '..' ||
        relativeDirectory.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relativeDirectory)
    ) {
        throw new Error(
            `Cannot derive a frontend/src module alias for ${sourceFile}.`,
        );
    }

    return relativeDirectory.split(path.sep).join('/');
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findRepositoryRoot(sourceFile: string): string {
    let currentDirectory = path.dirname(sourceFile);
    while (true) {
        if (
            path.isAbsolute(currentDirectory) &&
            existsSync(path.join(currentDirectory, 'jest.config.js'))
        ) {
            return currentDirectory;
        }

        const parentDirectory = path.dirname(currentDirectory);
        if (parentDirectory === currentDirectory) {
            throw new Error(`Could not find jest.config.js above ${sourceFile}.`);
        }
        currentDirectory = parentDirectory;
    }
}

function runProcess(
    executable: string,
    args: string[],
    cwd: string,
): Promise<ReferenceTestResult> {
    return new Promise((resolve, reject) => {
        const child = spawn(executable, args, {
            cwd,
            windowsHide: true,
            env: process.env,
        });
        let output = '';

        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        child.stdout.on('data', (chunk: string) => {
            output += chunk;
        });
        child.stderr.on('data', (chunk: string) => {
            output += chunk;
        });
        child.once('error', reject);
        child.once('close', (code) => {
            resolve({
                passed: code === 0,
                output: output.trim(),
            });
        });
    });
}

export async function runReferenceTests(
    componentDirectory: string,
    candidatePath?: string,
): Promise<ReferenceTestResult> {
    const manifestPath = path.join(componentDirectory, 'source-manifest.json');
    const manifest = JSON.parse(
        await readFile(manifestPath, 'utf8'),
    ) as SourceManifest;
    const sourceFile = path.resolve(manifest.sourceRoot, manifest.sourceFile);
    const repositoryRoot = findRepositoryRoot(sourceFile);
    const componentModuleSpecifier = getComponentModuleSpecifier(
        repositoryRoot,
        sourceFile,
    );
    const jestEntry = path.join(repositoryRoot, 'node_modules', 'jest', 'bin', 'jest.js');

    try {
        await readFile(jestEntry, 'utf8');
    } catch (error: unknown) {
        if (
            error instanceof Error &&
            'code' in error &&
            error.code === 'ENOENT'
        ) {
            throw new Error(
                `Jest is not installed in ${repositoryRoot}. Install the source repository dependencies before running its reference tests.`,
            );
        }
        throw error;
    }

    const testPaths = manifest.testFiles.map((testFile) =>
        path.resolve(manifest.sourceRoot, testFile),
    );
    const selectedCandidate = candidatePath
        ? path.resolve(candidatePath)
        : sourceFile;
    const temporaryDirectory = await mkdtemp(
        path.join(os.tmpdir(), 'refactor-reference-tests-'),
    );
    let temporaryCandidate: string | undefined;
    const temporaryTests: string[] = [];

    try {
        if (candidatePath) {
            temporaryCandidate = path.join(
                path.dirname(sourceFile),
                `.Visualization.candidate-${process.pid}-${Date.now()}${path.extname(sourceFile)}`,
            );
            await writeFile(
                temporaryCandidate,
                await readFile(selectedCandidate, 'utf8'),
                { flag: 'wx' },
            );
        }

        const mappedTestPaths: string[] = [];
        for (const testPath of testPaths) {
            const testCode = await readFile(testPath, 'utf8');
            if (!candidatePath || !/from\s+(['"])\.\1/.test(testCode)) {
                mappedTestPaths.push(testPath);
                continue;
            }

            const temporaryTest = path.join(
                path.dirname(testPath),
                `.candidate-${process.pid}-${Date.now()}-${path.basename(testPath)}`,
            );
            await writeFile(
                temporaryTest,
                testCode.replace(
                    /from\s+(['"])\.\1/g,
                    `from '${componentModuleSpecifier}'`,
                ),
                { flag: 'wx' },
            );
            temporaryTests.push(temporaryTest);
            mappedTestPaths.push(temporaryTest);
        }

        const configPath = path.join(temporaryDirectory, 'jest.config.cjs');
        const sourceConfigPath = path.join(repositoryRoot, 'jest.config.js');
        const configContents = [
            `const config = require(${JSON.stringify(sourceConfigPath)});`,
            `const core = config.projects.find((project) => project.displayName === 'core');`,
            `if (!core) throw new Error('Metabase Jest core project was not found.');`,
            `module.exports = {`,
            `  ...core,`,
            `  rootDir: ${JSON.stringify(repositoryRoot)},`,
            `  moduleNameMapper: {`,
            ...(temporaryCandidate
                ? [
                      `    '^${escapeRegExp(componentModuleSpecifier)}$': ${JSON.stringify(temporaryCandidate)},`,
                  ]
                : []),
            `    ...core.moduleNameMapper,`,
            `  },`,
            `};`,
            '',
        ].join('\n');
        await writeFile(configPath, configContents, 'utf8');

        return await runProcess(
            process.execPath,
            [
                jestEntry,
                '--config',
                configPath,
                '--runInBand',
                '--runTestsByPath',
                ...mappedTestPaths,
            ],
            repositoryRoot,
        );
    } finally {
        await Promise.all([
            rm(temporaryDirectory, { recursive: true, force: true }),
            ...(temporaryCandidate
                ? [rm(temporaryCandidate, { force: true })]
                : []),
            ...temporaryTests.map((testPath) => rm(testPath, { force: true })),
        ]);
    }
}

async function main(args: string[]): Promise<void> {
    if (args.length === 1 && (args[0] === '--help' || args[0] === '-h')) {
        console.log(
            [
                'Run the source repository Jest suites referenced by a dataset component.',
                '',
                'Usage: npm run test:reference -- <component-directory> [candidate-component-file]',
                '',
                'Omit the candidate path to run the original source component as a baseline.',
                'Provide a candidate path to run the same suites against generated code.',
            ].join('\n'),
        );
        return;
    }

    const [componentDirectory, candidatePath, ...extraArgs] = args;
    if (!componentDirectory || extraArgs.length > 0) {
        throw new Error(
            'Usage: npm run test:reference -- <component-directory> [candidate-component-file]',
        );
    }

    const datasetManifest = JSON.parse(
        await readFile(path.resolve('dataset/manifest.json'), 'utf8'),
    ) as DatasetManifest;
    const componentId = path.basename(path.resolve(componentDirectory));
    if (
        !datasetManifest.components.some(
            (component) =>
                component.id === componentId && component.upstreamControl,
        )
    ) {
        throw new Error(
            `Upstream reference tests are reserved for the selected control components: ${datasetManifest.components.filter((component) => component.upstreamControl).map((component) => component.id).join(', ')}.`,
        );
    }

    const result = await runReferenceTests(componentDirectory, candidatePath);
    if (result.output) {
        console.log(result.output);
    }
    if (!result.passed) {
        process.exitCode = 1;
    }
}

if (require.main === module) {
    main(process.argv.slice(2)).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Reference tests failed to run: ${message}`);
        process.exitCode = 1;
    });
}
