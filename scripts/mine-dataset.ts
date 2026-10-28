import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse } from '@babel/parser';

const DEFAULT_LIMIT = 70;
const IGNORED_DIRECTORIES = new Set([
    '.git',
    '.next',
    '.turbo',
    'build',
    'coverage',
    'dist',
    'node_modules',
]);
const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx']);

export interface MineDatasetOptions {
    sourceDir: string;
    targetDir: string;
    limit?: number;
}

interface ImportedModule {
    namedExports: Set<string>;
    hasDefaultExport: boolean;
    defaultMembers: Set<string>;
}

export function createIsolatedVitestTest(sourceCode: string): string {
    const ast = parse(sourceCode, {
        sourceType: 'unambiguous',
        plugins: ['typescript', 'jsx', 'decorators-legacy'],
    });
    const importedModules = new Map<string, ImportedModule>();

    for (const node of ast.program.body) {
        if (node.type !== 'ImportDeclaration' || node.importKind === 'type') {
            continue;
        }

        const modulePath = node.source.value;
        const importedModule = importedModules.get(modulePath) ?? {
            namedExports: new Set<string>(),
            hasDefaultExport: false,
            defaultMembers: new Set<string>(),
        };

        for (const specifier of node.specifiers) {
            if (
                specifier.type === 'ImportSpecifier' &&
                specifier.importKind === 'type'
            ) {
                continue;
            }

            if (specifier.type === 'ImportDefaultSpecifier') {
                importedModule.hasDefaultExport = true;
                const aliasPattern = escapeRegExp(specifier.local.name);
                const memberPattern = new RegExp(
                    `\\b${aliasPattern}\\.([A-Za-z_$][\\w$]*)`,
                    'g',
                );
                for (const match of sourceCode.matchAll(memberPattern)) {
                    importedModule.defaultMembers.add(match[1]);
                }
            } else if (specifier.type === 'ImportSpecifier') {
                importedModule.namedExports.add(
                    specifier.imported.type === 'Identifier'
                        ? specifier.imported.name
                        : specifier.imported.value,
                );
            } else if (specifier.type === 'ImportNamespaceSpecifier') {
                const aliasPattern = escapeRegExp(specifier.local.name);
                const memberPattern = new RegExp(
                    `\\b${aliasPattern}\\.([A-Za-z_$][\\w$]*)`,
                    'g',
                );
                for (const match of sourceCode.matchAll(memberPattern)) {
                    importedModule.namedExports.add(match[1]);
                }
            }
        }

        importedModules.set(modulePath, importedModule);
    }

    const mockDeclarations = [...importedModules.entries()]
        .map(([modulePath, importedModule]) => {
            const mockedExports: string[] = [];
            if (importedModule.hasDefaultExport) {
                const defaultMembers = [...importedModule.defaultMembers]
                    .map((name) => `${JSON.stringify(name)}: vi.fn(() => vi.fn())`)
                    .join(', ');
                mockedExports.push(
                    `default: Object.assign(vi.fn(() => vi.fn()), { ${defaultMembers} })`,
                );
            }
            for (const name of importedModule.namedExports) {
                mockedExports.push(
                    `${JSON.stringify(name)}: vi.fn(() => vi.fn())`,
                );
            }
            return [
                `vi.mock(${JSON.stringify(modulePath)}, () => ({`,
                ...mockedExports.map((mockedExport) => `  ${mockedExport},`),
                '}));',
            ].join('\n');
        })
        .join('\n\n');

    return [
        "import { describe, expect, it, vi } from 'vitest';",
        '',
        mockDeclarations,
        '',
        "import * as ModernComponent from './ModernComponent';",
        '',
        "describe('ModernComponent', () => {",
        "    it('loads with isolated dependency mocks', () => {",
        '        expect(Object.keys(ModernComponent).length).toBeGreaterThan(0);',
        '    });',
        '});',
        '',
    ].join('\n');
}

function isPathInside(candidatePath: string, parentPath: string): boolean {
    const relativePath = path.relative(parentPath, candidatePath);
    return (
        relativePath === '' ||
        (relativePath !== '..' &&
            !relativePath.startsWith(`..${path.sep}`) &&
            !path.isAbsolute(relativePath))
    );
}

function isTestFile(fileName: string): boolean {
    return /\.(?:test|spec)\.(?:[cm]?[jt]sx?)$/i.test(fileName);
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findTestFile(
    componentDirectory: string,
    sourceBaseName: string,
): string | undefined {
    const testDirectory = path.join(componentDirectory, '__tests__');
    const candidateDirectories = [componentDirectory, testDirectory];

    for (const directory of candidateDirectories) {
        if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
            continue;
        }

        const matches = fs
            .readdirSync(directory, { withFileTypes: true })
            .filter((entry) => entry.isFile())
            .map((entry) => entry.name)
            .filter((name) =>
                new RegExp(
                    `^${escapeRegExp(sourceBaseName)}(?:\\.[\\w-]+)?\\.(?:test|spec)\\.(?:[cm]?[jt]sx?)$`,
                    'i',
                ).test(name),
            );

        if (matches.length > 1) {
            throw new Error(
                `Multiple test files found for ${sourceBaseName} in ${directory}.`,
            );
        }
        if (matches.length === 1) {
            return path.join(directory, matches[0]);
        }
    }

    return undefined;
}

function findLegacyComponents(
    directory: string,
    targetDir: string,
    onMatch: (sourcePath: string, testPath: string, fileName: string) => void,
    limit: number,
    matchCount: { value: number },
): void {
    if (matchCount.value >= limit) {
        return;
    }

    const entries = fs
        .readdirSync(directory, { withFileTypes: true })
        .sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
        if (matchCount.value >= limit) {
            break;
        }

        const fullPath = path.join(directory, entry.name);
        if (entry.isSymbolicLink()) {
            continue;
        }

        if (entry.isDirectory()) {
            if (
                IGNORED_DIRECTORIES.has(entry.name) ||
                isPathInside(fullPath, targetDir)
            ) {
                continue;
            }
            findLegacyComponents(fullPath, targetDir, onMatch, limit, matchCount);
            continue;
        }

        if (
            !entry.isFile() ||
            !SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()) ||
            isTestFile(entry.name) ||
            /\.d\.[jt]sx?$/i.test(entry.name)
        ) {
            continue;
        }

        const content = fs.readFileSync(fullPath, 'utf8');
        if (
            !/\bextends\s+(?:(?:[A-Za-z_$][\w$]*)\.)?(?:Component|PureComponent)\b/.test(
                content,
            )
        ) {
            continue;
        }

        const sourceBaseName = path.basename(entry.name, path.extname(entry.name));
        const testPath = findTestFile(directory, sourceBaseName);
        if (!testPath) {
            continue;
        }

        onMatch(fullPath, testPath, entry.name);
        matchCount.value++;
    }
}

export function mineDataset({
    sourceDir,
    targetDir,
    limit = DEFAULT_LIMIT,
}: MineDatasetOptions): number {
    const resolvedSourceDir = path.resolve(sourceDir);
    const resolvedTargetDir = path.resolve(targetDir);

    if (!Number.isInteger(limit) || limit < 1) {
        throw new RangeError('The component limit must be a positive integer.');
    }
    if (!fs.existsSync(resolvedSourceDir)) {
        throw new Error(`Source repository does not exist: ${resolvedSourceDir}`);
    }
    if (!fs.statSync(resolvedSourceDir).isDirectory()) {
        throw new Error(`Source repository is not a directory: ${resolvedSourceDir}`);
    }
    if (resolvedSourceDir === resolvedTargetDir) {
        throw new Error('The dataset output directory must differ from the source repository.');
    }

    fs.mkdirSync(resolvedTargetDir, { recursive: true });
    const matchCount = { value: 0 };
    let destinationIndex = 1;

    findLegacyComponents(
        resolvedSourceDir,
        resolvedTargetDir,
        (sourcePath, _testPath, fileName) => {
            let destinationDirectory: string;
            do {
                destinationDirectory = path.join(
                    resolvedTargetDir,
                    `component-${String(destinationIndex).padStart(2, '0')}`,
                );
                destinationIndex++;
            } while (fs.existsSync(destinationDirectory));

            fs.mkdirSync(destinationDirectory, { recursive: true });
            fs.copyFileSync(
                sourcePath,
                path.join(destinationDirectory, 'LegacyComponent.tsx'),
            );
            fs.writeFileSync(
                path.join(destinationDirectory, 'LegacyComponent.test.tsx'),
                createIsolatedVitestTest(fs.readFileSync(sourcePath, 'utf8')),
                'utf8',
            );
            console.log(`[${matchCount.value + 1}/${limit}] Mined ${fileName}`);
        },
        limit,
        matchCount,
    );

    return matchCount.value;
}

function main(args: string[]): number {
    const [sourceDir, targetDir, limitArgument] = args;
    if (!sourceDir || !targetDir || args.length > 3) {
        throw new Error(
            'Usage: npm run mine:dataset -- <repository-path> <dataset-path> [limit]',
        );
    }

    const limit =
        limitArgument === undefined ? DEFAULT_LIMIT : Number(limitArgument);
    const count = mineDataset({ sourceDir, targetDir, limit });
    console.log(`Done. Mined ${count} component/test pair(s).`);
    if (count === 0) {
        console.warn('No React class components with matching tests were found.');
    }
    return count;
}

if (require.main === module) {
    try {
        main(process.argv.slice(2));
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Dataset mining failed: ${message}`);
        process.exitCode = 1;
    }
}
