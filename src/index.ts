import 'dotenv/config';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Command, Option } from 'commander';
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
    model: ProviderName;
    out: string;
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

export async function discoverComponentJobs(
    datasetPath: string,
    outputPath: string,
): Promise<ComponentJob[]> {
    const entries = await readdir(datasetPath, { withFileTypes: true });
    const componentDirectories = entries
        .filter((entry) => entry.isDirectory() && /^component-/i.test(entry.name))
        .sort((left, right) => left.name.localeCompare(right.name));
    const jobs: ComponentJob[] = [];

    for (const directory of componentDirectories) {
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

export async function runCli(options: CliOptions): Promise<void> {
    const datasetPath = path.resolve(options.dataset);
    const outputPath = path.resolve(options.out);
    const jobs = await discoverComponentJobs(datasetPath, outputPath);
    const provider = createProvider(options.model);
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
                promptTokens = error.usage.promptTokens;
                completionTokens = error.usage.completionTokens;
                totalTokens = error.usage.totalTokens;
                failureStage = error.failureStage;
            }
        }

        await reporter.appendResult({
            component: job.name,
            durationMs: Math.round(performance.now() - startedAt),
            attempts,
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
    .description('Refactor every component in a dataset directory.')
    .option('-d, --dataset <path>', 'Dataset directory to scan', './dataset')
    .addOption(
        new Option('-m, --model <model>', 'LLM provider to use')
            .choices(['gemini', 'openai', 'ollama'])
            .default(process.env.ACTIVE_LLM ?? 'gemini'),
    )
    .option('-o, --out <path>', 'Output directory', './results')
    .action(async (options: CliOptions) => {
        await runCli(options);
    });

if (require.main === module) {
    program.parseAsync(process.argv).catch((error: unknown) => {
        console.error(`Refactoring failed: ${getErrorMessage(error)}`);
        process.exitCode = 1;
    });
}
