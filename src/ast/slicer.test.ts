import { describe, expect, it } from 'vitest';
import { maskJSX, restoreJSX, sliceContext } from './slicer';

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

describe('maskJSX and restoreJSX', () => {
    it('masks large returned JSX and restores its exact source formatting', () => {
        const rows = Array.from(
            { length: 100 },
            (_, index) => `
                        <tr key={${index}}>
                            <td><div className="cell">Row ${index}</div></td>
                            <td><div className="details">Details {this.state.items[${index}]}</div></td>
                        </tr>`,
        ).join('');
        const source = `
            class LegacyTable extends React.Component {
                render() {
                    return (
                        <div className="table-wrapper">
                            <table>
                                <tbody>${rows}
                                </tbody>
                            </table>
                        </div>
                    );
                }
            }
        `;

        const { maskedCode, jsxMap } = maskJSX(source);
        const placeholder = Object.keys(jsxMap)[0];
        const refactored = `function Table() { return <${placeholder} />; }`;

        expect(Object.keys(jsxMap)).toEqual(['JSX_MASK_0']);
        expect(maskedCode).toContain('<JSX_MASK_0 />');
        expect(maskedCode).not.toContain('Row 99');
        expect(maskedCode.length).toBeLessThan(source.length);
        expect(restoreJSX(refactored, jsxMap)).toBe(
            `function Table() { return ${jsxMap[placeholder].replaceAll('this.state.items', 'items')}; }`,
        );
    });

    it('collects JSX props, state, and class method dependencies and adapts this references', () => {
        const source = `
            class Legacy extends React.Component {
                handleClick() {}
                render() {
                    return (
                        <button title={this.props.title} onClick={this.handleClick}>
                            {this.state.counter}
                            {this.state.items.map((item) => <span>{item.name}</span>)}
                        </button>
                    );
                }
            }
        `;

        const { maskedCode, jsxMap, dependencyContract } = maskJSX(source);
        const restored = restoreJSX(
            'function Component() { return <JSX_MASK_0 />; }',
            jsxMap,
        );

        expect(maskedCode).toContain('<JSX_MASK_0 />');
        expect(dependencyContract).toEqual({
            requiredProps: ['title'],
            requiredState: ['counter', 'items'],
            requiredMethods: ['handleClick'],
            unresolvedAccesses: [],
        });
        expect(restored).toContain('title={title}');
        expect(restored).toContain('onClick={handleClick}');
        expect(restored).toContain('{counter}');
        expect(restored).toContain('{items.map');
        expect(restored).not.toContain('this.');
    });

    it('reports whole-object and computed this accesses without guessing replacements', () => {
        const { jsxMap, dependencyContract } = maskJSX(`
            function Component() {
                return <div>{this.state[key]}{this.props}</div>;
            }
        `);

        expect(dependencyContract).toEqual({
            requiredProps: [],
            requiredState: [],
            requiredMethods: [],
            unresolvedAccesses: [
                'this.props (whole object)',
                'this.state[dynamic]',
            ],
        });
        expect(
            restoreJSX('function Component() { return <JSX_MASK_0 />; }', jsxMap),
        ).toContain('{this.state[key]}{this.props}');
    });

    it('masks JSX fragments and restores placeholders after return structure changes', () => {
        const { maskedCode, jsxMap } = maskJSX(`
            function Legacy({ show }: { show: boolean }) {
                return show ? <div>Visible</div> : <>Hidden</>;
            }
        `);

        expect(maskedCode).toContain('<JSX_MASK_0 />');
        expect(maskedCode).toContain('<JSX_MASK_1 />');
        expect(
            restoreJSX(
                'function Component() { if (ready) return <JSX_MASK_0 />; return <JSX_MASK_1 />; }',
                jsxMap,
            ),
        ).toContain('if (ready) return <div>Visible</div>;');
    });

    it('rejects missing, duplicated, and unknown placeholders rather than losing JSX', () => {
        const { jsxMap } = maskJSX('function Component() { return <div>Keep me</div>; }');

        expect(() => restoreJSX('function Component() { return null; }', jsxMap))
            .toThrow('omitted JSX placeholder "JSX_MASK_0"');
        expect(() =>
            restoreJSX(
                'function Component() { return <><JSX_MASK_0 /><JSX_MASK_0 /></>; }',
                jsxMap,
            ),
        ).toThrow('duplicated JSX placeholder "JSX_MASK_0"');
        expect(() =>
            restoreJSX('function Component() { return <JSX_MASK_7 />; }', jsxMap),
        ).toThrow('Unexpected JSX placeholder "JSX_MASK_7"');
    });

    it('avoids collisions with placeholder-like source identifiers', () => {
        const { maskedCode, jsxMap } = maskJSX(`
            const JSX_MASK_0 = 'not a placeholder';
            function Component() { return <span>Value</span>; }
        `);

        expect(maskedCode).toContain('<JSX_MASK_1 />');
        expect(Object.keys(jsxMap)).toEqual(['JSX_MASK_1']);
    });

    it('leaves source unchanged when no returned JSX exists', () => {
        const source = 'const value: number = 1;';
        const result = maskJSX(source);

        expect(result).toEqual({
            maskedCode: source,
            jsxMap: {},
            dependencyContract: {
                requiredProps: [],
                requiredState: [],
                requiredMethods: [],
                unresolvedAccesses: [],
            },
        });
        expect(restoreJSX(source, result.jsxMap)).toBe(source);
    });
});
