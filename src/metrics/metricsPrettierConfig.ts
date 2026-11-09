import type { Options } from 'prettier';

export const metricsPrettierConfig: Options = {
    parser: 'babel',
    arrowParens: 'always',
    bracketSameLine: false,
    endOfLine: 'lf',
    printWidth: 80,
    semi: true,
    singleQuote: true,
    tabWidth: 2,
    trailingComma: 'all',
    useTabs: false,
};
