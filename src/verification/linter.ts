import { ESLint } from 'eslint';
import reactHooks from 'eslint-plugin-react-hooks';

const eslint = import('@babel/eslint-parser').then(
    ({ default: babelParser }) =>
        new ESLint({
            overrideConfigFile: true,
            overrideConfig: [
                {
                    files: ['**/*.tsx'],
                    languageOptions: {
                        ecmaVersion: 'latest',
                        sourceType: 'module',
                        parser: babelParser,
                        parserOptions: {
                            requireConfigFile: false,
                            babelOptions: {
                                parserOpts: {
                                    plugins: ['typescript', 'jsx'],
                                },
                            },
                        },
                    },
                    plugins: {
                        'react-hooks': {
                            rules: reactHooks.rules,
                        },
                    },
                    rules: {
                        'react-hooks/rules-of-hooks': 'error',
                        'react-hooks/exhaustive-deps': 'error',
                    },
                },
            ],
        }),
);

export async function lintCode(code: string): Promise<string[]> {
    const linter = await eslint;
    const results = await linter.lintText(code, {
        filePath: 'GeneratedComponent.tsx',
    });

    return results.flatMap((result) =>
        result.messages.map(({ line, column, ruleId, message, severity }) => {
            const location = line === undefined ? 'unknown location' : `${line}:${column ?? 1}`;
            const rule = ruleId === null ? '' : ` [${ruleId}]`;
            const level = severity === 2 ? 'error' : 'warning';

            return `${location}: ${level}${rule}: ${message}`;
        }),
    );
}
