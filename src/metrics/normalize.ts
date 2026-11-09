import { transformSync } from '@babel/core';
import transformOptionalChaining from '@babel/plugin-transform-optional-chaining';
import transformTypeScript from '@babel/plugin-transform-typescript';
import prettier from 'prettier';
import { metricsPrettierConfig } from './metricsPrettierConfig';

export async function normalizeForMetrics(code: string): Promise<string> {
    const result = transformSync(code, {
        filename: 'Component.tsx',
        configFile: false,
        babelrc: false,
        parserOpts: {
            plugins: ['jsx'],
        },
        plugins: [
            [
                transformTypeScript,
                {
                    allExtensions: true,
                    isTSX: true,
                },
            ],
            transformOptionalChaining,
        ],
    });

    if (typeof result?.code !== 'string') {
        throw new Error('Babel did not produce normalized JavaScript for metrics.');
    }

    return prettier.format(result.code, metricsPrettierConfig);
}
