import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import type { ImportDeclaration, ImportSpecifier } from '@babel/types';
import type { Plugin } from 'vite';

interface ImportDescriptor {
    exportName: string;
    localName: string;
    isComponent: boolean;
    isNamespace: boolean;
}

interface VirtualModule {
    importer: string;
    modulePath: string;
}

function isComponentImport(source: string, localName: string): boolean {
    return hasJsxUsage(source, localName) || localName === 'LoadingView';
}

const VIRTUAL_PREFIX = '\0dataset-boundary:';
const RUNTIME_MODULE = path
    .resolve('dataset/support/boundary-mocks.tsx')
    .split(path.sep)
    .join('/');

function findImport(
    importer: string,
    modulePath: string,
): ImportDeclaration | undefined {
    const source = readFileSync(importer, 'utf8');
    const ast = parse(source, {
        sourceType: 'unambiguous',
        plugins: ['typescript', 'jsx', 'decorators-legacy'],
    });
    return ast.program.body.find(
        (node): node is ImportDeclaration =>
            node.type === 'ImportDeclaration' &&
            node.source.value === modulePath &&
            node.importKind !== 'type',
    );
}

function hasJsxUsage(source: string, localName: string): boolean {
    return new RegExp(
        `<${localName}(?:<[^>]+>)?(?:\\.[A-Za-z_$][\\w$]*)*(?:\\s|/|>)`,
    ).test(source);
}

function describeImports(
    importer: string,
    modulePath: string,
): ImportDescriptor[] {
    const source = readFileSync(importer, 'utf8');
    const declaration = findImport(importer, modulePath);
    if (!declaration) {
        return [];
    }

    return declaration.specifiers
        .filter((specifier) => {
            if (specifier.type === 'ImportSpecifier') {
                return specifier.importKind !== 'type';
            }
            return true;
        })
        .map((specifier) => {
            if (specifier.type === 'ImportDefaultSpecifier') {
                return {
                    exportName: 'default',
                    localName: specifier.local.name,
                    isComponent: isComponentImport(source, specifier.local.name),
                    isNamespace: false,
                };
            }

            if (specifier.type === 'ImportNamespaceSpecifier') {
                return {
                    exportName: '*',
                    localName: specifier.local.name,
                    isComponent: false,
                    isNamespace: true,
                };
            }

            const namedSpecifier = specifier as ImportSpecifier;
            const exportName =
                namedSpecifier.imported.type === 'Identifier'
                    ? namedSpecifier.imported.name
                    : namedSpecifier.imported.value;

            return {
                exportName,
                localName: namedSpecifier.local.name,
                isComponent: isComponentImport(
                    source,
                    namedSpecifier.local.name,
                ),
                isNamespace: false,
            };
        })
        .flatMap((descriptor) => {
            if (!descriptor.isNamespace) {
                return [descriptor];
            }
            const memberPattern = new RegExp(
                `\\b${descriptor.localName}\\.([A-Za-z_$][\\w$]*)`,
                'g',
            );
            const members = [...source.matchAll(memberPattern)].map(
                (match) => match[1],
            );
            return [
                descriptor,
                ...[...new Set(members)].map((exportName) => ({
                    exportName,
                    localName: exportName,
                    isComponent: false,
                    isNamespace: false,
                })),
            ];
        });
}

function isDatasetComponent(importer: string): boolean {
    return /[\\/]dataset[\\/]component-\d+[\\/](?:LegacyComponent|ModernComponent)\.tsx$/.test(
        importer,
    );
}

export function datasetBoundaryPlugin(): Plugin {
    return {
        name: 'dataset-dependency-boundaries',
        enforce: 'pre',
        resolveId(source, importer) {
            if (
                !importer ||
                [
                    'react',
                    'react-dom',
                    'react-dom/server',
                    'react/jsx-runtime',
                    'react/jsx-dev-runtime',
                ].includes(source)
            ) {
                return null;
            }

            const normalizedImporter = path.resolve(importer.split('?')[0]);
            if (!isDatasetComponent(normalizedImporter)) {
                return null;
            }

            const id =
                VIRTUAL_PREFIX +
                Buffer.from(
                    JSON.stringify({
                        importer: normalizedImporter,
                        modulePath: source,
                    } satisfies VirtualModule),
                ).toString('base64url');
            return id;
        },
        load(id) {
            if (!id.startsWith(VIRTUAL_PREFIX)) {
                return null;
            }

            const virtualModule = JSON.parse(
                Buffer.from(
                    id.slice(VIRTUAL_PREFIX.length),
                    'base64url',
                ).toString('utf8'),
            ) as VirtualModule;

            const imports = describeImports(
                virtualModule.importer,
                virtualModule.modulePath,
            );
            const exportNames = [
                ...new Set(imports.map((item) => item.exportName)),
            ].filter((name) => name !== '*');
            const source = [
                `import { createDatasetBoundaryModule } from ${JSON.stringify(RUNTIME_MODULE)};`,
                `const mocks = createDatasetBoundaryModule(${JSON.stringify(virtualModule.modulePath)}, ${JSON.stringify(imports)});`,
                ...(exportNames.includes('default')
                    ? ['export default mocks.default;']
                    : []),
                ...exportNames
                    .filter((name) => name !== 'default')
                    .map((name, index) => {
                        const localName = `__datasetExport${index}`;
                        return [
                            `const ${localName} = mocks[${JSON.stringify(name)}];`,
                            `export { ${localName} as ${name} };`,
                        ].join('\n');
                    }),
                '',
            ].join('\n');

            return source;
        },
    };
}
