import 'dotenv/config';
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runTests } from '../src/verification/tester';

interface DatasetManifest {
    components: { id: string }[];
}

interface CoverageMetric {
    total: number;
    covered: number;
    skipped: number;
    pct: number;
}

interface FileCoverageSummary {
    statements: CoverageMetric;
    branches: CoverageMetric;
    lines: CoverageMetric;
}

type CoverageSummary = Record<string, FileCoverageSummary | { total: CoverageMetric }>;

async function pathExists(filePath: string): Promise<boolean> {
    try {
        await access(filePath);
        return true;
    } catch (error: unknown) {
        if (
            error instanceof Error &&
            'code' in error &&
            error.code === 'ENOENT'
        ) {
            return false;
        }
        throw error;
    }
}

async function main(): Promise<void> {
    const datasetRoot = path.resolve('dataset');
    const outputRoot = path.resolve('results/coverage');
    const manifest = JSON.parse(
        await readFile(path.join(datasetRoot, 'manifest.json'), 'utf8'),
    ) as DatasetManifest;
    const expectedIds = manifest.components.map(({ id }) => id).sort();
    const actualIds = (await readdir(datasetRoot, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory() && /^component-\d+$/.test(entry.name))
        .map((entry) => entry.name)
        .sort();
    if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) {
        throw new Error(
            `Dataset directories do not match manifest. Expected [${expectedIds.join(', ')}], found [${actualIds.join(', ')}].`,
        );
    }

    const temporaryCoverageRoot = await mkdtemp(
        path.join(os.tmpdir(), 'refactor-cli-contract-coverage-'),
    );
    await mkdir(outputRoot, { recursive: true });
    const rows = ['component,statements %,branches %,lines %'];
    const failed: string[] = [];

    try {
        for (const { id } of manifest.components) {
            const componentDirectory = path.join(datasetRoot, id);
            const sourcePath = path.join(componentDirectory, 'LegacyComponent.tsx');
            const generatedPath = path.join(componentDirectory, 'ModernComponent.tsx');
            const testPath = path.join(componentDirectory, 'LegacyComponent.test.tsx');
            if (await pathExists(generatedPath)) {
                throw new Error(
                    `Remove the existing generated file before running contract coverage: ${generatedPath}`,
                );
            }

            const coverageDirectory = path.join(temporaryCoverageRoot, id);
            const source = await readFile(sourcePath, 'utf8');
            const result = await runTests(
                source,
                generatedPath,
                testPath,
                { reportsDirectory: coverageDirectory, includeFile: sourcePath },
            );
            if (!result.passed) {
                failed.push(`${id}:\n${result.errorText}`);
                console.error(`FAIL ${id}`);
            } else {
                console.log(`PASS ${id}`);
            }

            const summaryPath = path.join(coverageDirectory, 'coverage-summary.json');
            const summary = JSON.parse(
                await readFile(summaryPath, 'utf8'),
            ) as CoverageSummary;
            const sourceKey = Object.keys(summary).find(
                (key) => path.resolve(key) === path.resolve(sourcePath),
            );
            const fileSummary = sourceKey ? summary[sourceKey] : undefined;
            if (!fileSummary || !('statements' in fileSummary)) {
                throw new Error(
                    `Coverage report did not include LegacyComponent.tsx for ${id}: ${sourcePath}`,
                );
            }
            rows.push(
                [
                    id,
                    formatPercent(fileSummary.statements.pct),
                    formatPercent(fileSummary.branches.pct),
                    formatPercent(fileSummary.lines.pct),
                ].join(','),
            );
        }

        const outputFile = path.join(outputRoot, 'contract-coverage.csv');
        await writeFile(outputFile, `${rows.join('\n')}\n`, 'utf8');
        console.log(`Contract coverage written to ${outputFile}`);

        if (failed.length > 0) {
            console.error(`\n${failed.join('\n\n')}`);
            process.exitCode = 1;
        }
    } finally {
        await rm(temporaryCoverageRoot, { recursive: true, force: true });
    }
}

function formatPercent(value: number): string {
    return Number.isFinite(value) ? value.toFixed(2) : '0.00';
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
