import { describe, expect, it } from 'vitest';
import { sliceContext } from './slicer';

describe('sliceContext', () => {
    it('separates imports from cleaned component code', () => {
        const context = sliceContext(`
            import React from 'react';
            import type { Props } from './types';

            export class Counter extends React.Component<Props> {
                render() {
                    return null;
                }
            }
        `);

        expect(context.imports).toEqual([
            "import React from 'react';",
            "import type { Props } from './types';",
        ]);
        expect(context.originalCode).toContain('export class Counter');
        expect(context.originalCode).not.toContain('import');
    });

    it('preserves source directives and rejects invalid syntax', () => {
        expect(sliceContext('"use strict"; const value = 1;').originalCode).toBe(
            '"use strict";\n\nconst value = 1;',
        );
        expect(() => sliceContext('const value = ;')).toThrow(SyntaxError);
    });
});
