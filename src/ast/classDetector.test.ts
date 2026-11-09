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
});
