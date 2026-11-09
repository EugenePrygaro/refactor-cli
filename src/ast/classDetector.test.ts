import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isClassComponent } from './classDetector';

describe('isClassComponent', () => {
    it.each([
        ['Component declaration', 'class Example extends Component { render() { return null; } }'],
        ['PureComponent declaration', 'class Example extends PureComponent { render() { return null; } }'],
        ['React.Component declaration', 'class Example extends React.Component { render() { return null; } }'],
        ['React.PureComponent declaration', 'class Example extends React.PureComponent { render() { return null; } }'],
        [
            'class expression',
            'const Example = class extends React.Component { render() { return null; } };',
        ],
        [
            'TypeScript render method',
            'abstract class Example extends React.Component { render(): JSX.Element { return null; } }',
        ],
        [
            'public render arrow property',
            'class Example extends React.Component { public render = (): JSX.Element => <div />; }',
        ],
        [
            'render function property',
            'class Example extends React.Component { render = function () { return <div />; }; }',
        ],
        [
            'private render function property',
            'class Example extends React.Component { #render = () => <div />; }',
        ],
    ])('detects %s', (_description, source) => {
        expect(isClassComponent(source)).toBe(true);
    });

    it.each([
        ['plain class', 'class Example { render() { return null; } }'],
        ['missing render', 'class Example extends React.Component { mount() {} }'],
        ['non-React superclass', 'class Example extends Other.Component { render() { return null; } }'],
        ['function component', 'function Example() { return <div />; }'],
    ])('rejects %s', (_description, source) => {
        expect(isClassComponent(source)).toBe(false);
    });

    it('classifies exactly components 44 through 50 as non-class in the dataset', async () => {
        const datasetPath = path.resolve(process.cwd(), 'dataset');
        const componentDirectories = await readdir(datasetPath, {
            withFileTypes: true,
        });
        const nonClassComponents: string[] = [];

        for (const directory of componentDirectories.filter(
            (entry) => entry.isDirectory() && /^component-/i.test(entry.name),
        )) {
            const sourcePath = path.join(
                datasetPath,
                directory.name,
                'LegacyComponent.tsx',
            );
            const sourceCode = await readFile(sourcePath, 'utf8');
            if (!isClassComponent(sourceCode)) {
                nonClassComponents.push(directory.name);
            }
        }

        expect(nonClassComponents.sort()).toEqual([
            'component-44',
            'component-45',
            'component-46',
            'component-47',
            'component-48',
            'component-49',
            'component-50',
        ]);
    });
});
