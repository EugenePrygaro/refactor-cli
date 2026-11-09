import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Command, Option } from 'commander';
import { isClassComponent } from './ast/classDetector';
import type { LLMProvider } from './llm/LLMProvider';
import { createProvider, type ProviderName } from './llm/ProviderFactory';
import { calculateMetrics, type CodeMetrics } from './metrics/calculator';
import { AttemptCsvReporter } from './reporting/AttemptCsvReporter';
import {
    type FailureStage,
    type AttemptRecord,
    DEFAULT_MAX_ATTEMPTS,
    PipelineError,
    RefactorPipeline,
} from './pipeline/RefactorPipeline';
import { CsvReporter } from './reporting/CsvReporter';

export interface CliOptions {
    dataset: string;
    provider: ProviderName;
    model?: string;
    seed?: number;
    out: string;
    runId?: string;
    components?: string[];
    classOnly?: boolean;
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

function getGitCommitHash(): string | null {
    try {
        return execFileSync('git', ['rev-parse', 'HEAD'], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();
    } catch {
        return null;
    }
}

function parseSeed(value: string): number {
    const seed = Number(value);
    if (!Number.isSafeInteger(seed)) {
        throw new Error('Seed must be a safe integer.');
    }
    return seed;
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
    const provider =
        providerOverride ?? createProvider(options.provider, options.model, options.seed);
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
    const modelVersion = provider.getModelVersion
        ? await provider.getModelVersion()
        : null;
    await writeFile(
        path.join(outputPath, 'run.json'),
        `${JSON.stringify(
            {
                runId,
                timestamp: new Date().toISOString(),
                gitCommit: getGitCommitHash(),
                provider: provider.providerName,
                model: provider.modelName,
                modelVersion,
                seed: options.seed ?? null,
                temperature: 0.1,
                maxAttempts: DEFAULT_MAX_ATTEMPTS,
                ollamaNumCtx:
                    provider.providerName === 'ollama'
                        ? Number(process.env.OLLAMA_NUM_CTX) || 32_768
                        : null,
            },
            null,
            2,
        )}\n`,
        'utf8',
    );
    const pipeline = new RefactorPipeline(provider);
    const reporter = new CsvReporter(path.join(outputPath, 'report.csv'));
    const attemptReporter = new AttemptCsvReporter(
        path.join(outputPath, 'attempts.csv'),
    );
    let succeeded = 0;
    const failures: string[] = [];
    let fatalRunError: string | undefined;

    for (const job of jobs) {
        console.log(`Refactoring ${job.name}...`);
        const startedAt = performance.now();
        let beforeMetrics: CodeMetrics | undefined;
        let afterMetrics: CodeMetrics | undefined;
        let beforeMetricsError: string | undefined;
        let afterMetricsError: string | undefined;
        let attempts = 0;
        let retries = 0;
        let status: 'Success' | 'Fail' | 'Invalid' | 'Excluded' = 'Fail';
        let isClassComponentResult: boolean | null = null;
        let failureReason: string | undefined;
        let failureStage: FailureStage = 'None';
        let attemptRecords: AttemptRecord[] = [];
        let promptTokens = 0;
        let completionTokens = 0;
        let totalTokens = 0;

        try {
            const sourceCode = await readFile(job.sourcePath, 'utf8');
            isClassComponentResult = isClassComponent(sourceCode);
            const metricsResult = await calculateMetrics(sourceCode);
            if (metricsResult.ok) {
                beforeMetrics = metricsResult.metrics;
            } else {
                beforeMetricsError = metricsResult.error;
            }
        } catch (error: unknown) {
            beforeMetricsError = getErrorMessage(error);
        }

        if (options.classOnly && isClassComponentResult === false) {
            status = 'Excluded';
            console.log(`Excluded ${job.name}: not a React class component.`);
        } else {
            try {
                const result = await pipeline.runWithAttempts(
                    job.sourcePath,
                    job.generatedPath,
                    job.testPath,
                );
                attempts = result.attemptCount;
                attemptRecords = result.attempts;
                retries = result.retries;
                promptTokens = result.usage.promptTokens;
                completionTokens = result.usage.completionTokens;
                totalTokens = result.usage.totalTokens;
                failureStage = result.failureStage;
                await mkdir(path.dirname(job.outputPath), { recursive: true });
                await writeFile(job.outputPath, result.generatedCode, 'utf8');
                succeeded++;
                status = 'Success';
                console.log(`Output written to ${job.outputPath}`);
                try {
                    const metricsResult = await calculateMetrics(result.generatedCode);
                    if (metricsResult.ok) {
                        afterMetrics = metricsResult.metrics;
                    } else {
                        afterMetricsError = metricsResult.error;
                    }
                } catch (error: unknown) {
                    afterMetricsError = getErrorMessage(error);
                }
            } catch (error: unknown) {
                const message = `${job.name}: ${getErrorMessage(error)}`;
                failures.push(message);
                failureReason = getErrorMessage(error);
                if (error instanceof PipelineError) {
                    attempts = error.attemptCount;
                    attemptRecords = error.attempts;
                    retries = error.retries;
                    promptTokens = error.usage.promptTokens;
                    completionTokens = error.usage.completionTokens;
                    totalTokens = error.usage.totalTokens;
                    failureStage = error.failureStage;
                    status = error.componentStatus;
                    if (error.fatal) {
                        fatalRunError = getErrorMessage(error);
                    }
                }
            }
        }

        await reporter.appendResult({
            runId,
            provider: provider.providerName,
            model: provider.modelName,
            component: job.name,
            isClassComponent: isClassComponentResult,
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
            beforeMetricsError,
            afterMetricsError,
            attemptRecords,
            failureReason,
        });
        await attemptReporter.appendAttempts(
            job.name,
            provider.modelName,
            attemptRecords,
        );

        if (failureReason) {
            console.error(`${job.name}: ${failureReason}`);
        }
        if (fatalRunError) {
            break;
        }
    }

    console.log(`Completed: ${succeeded}/${jobs.length} components succeeded.`);
    console.log(`CSV report written to ${path.join(outputPath, 'report.csv')}`);
    if (fatalRunError) {
        throw new Error(fatalRunError);
    }
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
    .option('--seed <seed>', 'Random seed for providers that support it', parseSeed)
    .option('--class-only', 'Refactor only React class components')
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
