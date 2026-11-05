import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { runTests } from '../src/verification/tester';

interface DatasetManifest {
    components: { id: string }[];
}

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
    const failed: string[] = [];

    for (const { id } of manifest.components) {
        const componentDirectory = path.join(datasetRoot, id);
        const sourcePath = path.join(componentDirectory, 'LegacyComponent.tsx');
        const generatedPath = path.join(componentDirectory, 'ModernComponent.tsx');
        const testPath = path.join(componentDirectory, 'LegacyComponent.test.tsx');

        if (await pathExists(generatedPath)) {
            throw new Error(
                `Remove the existing generated file before running contracts: ${generatedPath}`,
            );
        }

        const source = await readFile(sourcePath, 'utf8');
        const errors = await runTests(source, generatedPath, testPath);
        if (errors) {
            failed.push(`${id}:\n${errors}`);
            console.error(`FAIL ${id}`);
        } else {
            console.log(`PASS ${id}`);
        }
    }

    if (failed.length > 0) {
        console.error(`\n${failed.join('\n\n')}`);
        process.exitCode = 1;
    }
}

main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
});
