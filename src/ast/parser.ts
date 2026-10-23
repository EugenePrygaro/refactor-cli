import { parse } from '@babel/parser';
import type { File } from '@babel/types';

export function parseSource(sourceCode: string): File {
    return parse(sourceCode, {
        sourceType: 'unambiguous',
        plugins: ['typescript', 'jsx'],
    });
}
