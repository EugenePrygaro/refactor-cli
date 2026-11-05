import 'dotenv/config';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Command, Option } from 'commander';
import type { LLMProvider } from './llm/LLMProvider';
import { createProvider, type ProviderName } from './llm/ProviderFactory';
import { calculateMetrics, type CodeMetrics } from './metrics/calculator';
import {
    type FailureStage,
    PipelineError,
    RefactorPipeline,
} from './pipeline/RefactorPipeline';
import { CsvReporter } from './reporting/CsvReporter';

export interface CliOptions {
    dataset: string;
    provider: ProviderName;
    model?: string;
    out: string;
    runId?: string;
    components?: string[];
}

export interface ComponentJob {
    name: string;
    sourcePath: string;
    generatedPath: string;
    testPath: string;
    outputPath: string;
}

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function sourceFileName(files: string[], componentName: string): string {
    const sourceFiles = files.filter(
        (file) =>
            /\.(?:tsx|ts)$/i.test(file) &&
            !/\.(?:test|spec)\.(?:tsx|ts)$/i.test(file) &&
            !/\.d\.ts$/i.test(file),
    );
    const legacyFiles = sourceFiles.filter((file) => /^Legacy.+\.tsx?$/i.test(file));
    const candidates = legacyFiles.length > 0 ? legacyFiles : sourceFiles;

    if (candidates.length !== 1) {
        throw new Error(
            `${componentName} must contain exactly one source component file (found ${candidates.length}).`,
        );
    }
    return candidates[0];
}

function testFileName(
    files: string[],
    generatedBaseName: string,
    sourceBaseName: string,
): string {
    const testFiles = files.filter((file) => /\.(?:test|spec)\.(?:tsx|ts)$/i.test(file));
    const generatedTests = testFiles.filter((file) =>
        new RegExp(
            `^${escapeRegExp(generatedBaseName)}\\.(?:test|spec)\\.(?:tsx|ts)$`,
            'i',
        ).test(file),
    );
    if (generatedTests.length === 1) {
        return generatedTests[0];
    }

    const sourceTests = testFiles.filter((file) =>
        new RegExp(`^${escapeRegExp(sourceBaseName)}\\.(?:test|spec)\\.(?:tsx|ts)$`, 'i').test(file),
    );
    const candidates = generatedTests.length > 1
        ? generatedTests
        : sourceTests.length > 0
            ? sourceTests
            : testFiles;

    if (candidates.length !== 1) {
        throw new Error(
            `${generatedBaseName} needs exactly one matching test file (found ${candidates.length}).`,
        );
    }
    return candidates[0];
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function parseComponentIds(value: string): string[] {
    const componentIds = value.split(',').map((componentId) => componentId.trim());
    if (
        componentIds.length === 0 ||
        componentIds.some((componentId) => !/^component-\d+$/i.test(componentId))
    ) {
        throw new Error(
            'Components must be comma-separated component IDs, such as component-06,component-51.',
        );
    }
    return componentIds;
}

export async function discoverComponentJobs(
    datasetPath: string,
    outputPath: string,
    selectedComponents?: string[],
): Promise<ComponentJob[]> {
    const entries = await readdir(datasetPath, { withFileTypes: true });
    const componentDirectories = entries
        .filter((entry) => entry.isDirectory() && /^component-/i.test(entry.name))
        .sort((left, right) => left.name.localeCompare(right.name));
    const selectedIds = selectedComponents
        ? new Set(parseComponentIds(selectedComponents.join(',')))
        : undefined;
    if (selectedIds) {
        const availableIds = new Set(componentDirectories.map(({ name }) => name));
        const unknownIds = [...selectedIds].filter((id) => !availableIds.has(id));
        if (unknownIds.length > 0) {
            throw new Error(
                `Unknown component ID(s): ${unknownIds.join(', ')}. Available IDs: ${[...availableIds].join(', ')}.`,
            );
        }
    }
    const jobs: ComponentJob[] = [];

    for (const directory of componentDirectories.filter(
        ({ name }) => !selectedIds || selectedIds.has(name),
    )) {
        const componentPath = path.join(datasetPath, directory.name);
        const files = await readdir(componentPath);
        const sourceName = sourceFileName(files, directory.name);
        const sourceBaseName = path.basename(sourceName, path.extname(sourceName));
        const generatedBaseName = /^Legacy/i.test(sourceBaseName)
            ? sourceBaseName.replace(/^Legacy/i, 'Modern')
            : `Modern${sourceBaseName}`;
        const extension = path.extname(sourceName);
        const generatedName = `${generatedBaseName}${extension}`;
        const testName = testFileName(files, generatedBaseName, sourceBaseName);

        jobs.push({
            name: directory.name,
            sourcePath: path.join(componentPath, sourceName),
            generatedPath: path.join(componentPath, generatedName),
            testPath: path.join(componentPath, testName),
            outputPath: path.join(outputPath, directory.name, generatedName),
        });
    }

    if (jobs.length === 0) {
        throw new Error(`No component-* directories found in ${datasetPath}.`);
    }

    return jobs;
}

export async function runCli(
    options: CliOptions,
    providerOverride?: LLMProvider,
): Promise<void> {
    const datasetPath = path.resolve(options.dataset);
    const provider = providerOverride ?? createProvider(options.provider, options.model);
    const runId = createRunId(options.runId, provider.providerName, provider.modelName);
    const outputRoot = path.resolve(options.out);
    const outputPath = path.join(outputRoot, runId);
    const jobs = await discoverComponentJobs(
        datasetPath,
        outputPath,
        options.components,
    );
    await mkdir(outputRoot, { recursive: true });
    await mkdir(outputPath);
    const pipeline = new RefactorPipeline(provider);
    const reporter = new CsvReporter(path.join(outputPath, 'report.csv'));
    let succeeded = 0;
    const failures: string[] = [];

    for (const job of jobs) {
        console.log(`Refactoring ${job.name}...`);
        const startedAt = performance.now();
        let beforeMetrics: CodeMetrics | undefined;
        let afterMetrics: CodeMetrics | undefined;
        let attempts = 0;
        let retries = 0;
        let status: 'Success' | 'Fail' = 'Fail';
        let failureReason: string | undefined;
        let failureStage: FailureStage = 'None';
        let promptTokens = 0;
        let completionTokens = 0;
        let totalTokens = 0;

        try {
            const sourceCode = await readFile(job.sourcePath, 'utf8');
            beforeMetrics = calculateMetrics(sourceCode);
            const result = await pipeline.runWithAttempts(
                job.sourcePath,
                job.generatedPath,
                job.testPath,
            );
            attempts = result.attempts;
            retries = result.retries;
            promptTokens = result.usage.promptTokens;
            completionTokens = result.usage.completionTokens;
            totalTokens = result.usage.totalTokens;
            failureStage = result.failureStage;
            afterMetrics = calculateMetrics(result.generatedCode);
            await mkdir(path.dirname(job.outputPath), { recursive: true });
            await writeFile(job.outputPath, result.generatedCode, 'utf8');
            succeeded++;
            status = 'Success';
            console.log(`Output written to ${job.outputPath}`);
        } catch (error: unknown) {
            const message = `${job.name}: ${getErrorMessage(error)}`;
            failures.push(message);
            failureReason = getErrorMessage(error);
            if (error instanceof PipelineError) {
                attempts = error.attempts;
                retries = error.retries;
                promptTokens = error.usage.promptTokens;
                completionTokens = error.usage.completionTokens;
                totalTokens = error.usage.totalTokens;
                failureStage = error.failureStage;
            }
        }

        await reporter.appendResult({
            runId,
            provider: provider.providerName,
            model: provider.modelName,
            component: job.name,
            durationMs: Math.round(performance.now() - startedAt),
            attempts,
            retries,
            status,
            promptTokens,
            completionTokens,
            totalTokens,
            failureStage,
            beforeMetrics,
            afterMetrics,
            failureReason,
        });

        if (failureReason) {
            console.error(`${job.name}: ${failureReason}`);
        }
    }

    console.log(`Completed: ${succeeded}/${jobs.length} components succeeded.`);
    console.log(`CSV report written to ${path.join(outputPath, 'report.csv')}`);
    if (failures.length > 0) {
        throw new Error(`${failures.length} component(s) failed.`);
    }
}

const program = new Command();
program
    .name('refactor-cli')
    .description('Refactor components in a dataset directory.')
    .option('-d, --dataset <path>', 'Dataset directory to scan', './dataset')
    .addOption(
        new Option('-p, --provider <provider>', 'LLM provider to use')
            .choices(['gemini', 'openai', 'ollama'])
            .default(process.env.ACTIVE_LLM ?? 'gemini'),
    )
    .option('-m, --model <model>', 'Model ID (overrides the provider-specific environment variable)')
    .option('-o, --out <path>', 'Output root directory', './results')
    .option(
        '--components <ids>',
        'Comma-separated component IDs to run (e.g. component-06,component-51)',
        parseComponentIds,
    )
    .option('--run-id <id>', 'Run identifier (must be unique within the output directory)')
    .action(async (options: CliOptions) => {
        await runCli(options);
    });

if (require.main === module) {
    program.parseAsync(process.argv).catch((error: unknown) => {
        console.error(`Refactoring failed: ${getErrorMessage(error)}`);
        process.exitCode = 1;
    });
}

export function createRunId(
    requestedRunId: string | undefined,
    providerName: string,
    modelName: string,
): string {
    if (requestedRunId !== undefined) {
        if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(requestedRunId)) {
            throw new Error('Run ID may contain only letters, numbers, dots, underscores, and hyphens.');
        }
        return requestedRunId;
    }

    const slug = (value: string) =>
        value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `${slug(providerName)}-${slug(modelName)}-${timestamp}-${randomUUID().slice(0, 8)}`;
}
