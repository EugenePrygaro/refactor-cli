import { describe, expect, it } from 'vitest';
import { calculateReactMetrics } from './reactMetrics';

describe('calculateReactMetrics', () => {
    it('counts classes, this expressions, built-in hook calls, and custom hooks', () => {
        const metrics = calculateReactMetrics(`
            class Legacy extends React.Component {
                render() {
                    return this.props.value;
                }
            }

            function Component() {
                useState(0);
                React.useEffect(() => {}, []);
                useLayoutEffect(() => {}, []);
                useCallback(() => {}, []);
                useMemo(() => 1, []);
                useRef(null);
                useContext(Context);
                useReducer(reducer, 0);
                useFeatureFlag();
                useWorkspace().refresh();
                return null;
            }
        `);

        expect(metrics).toEqual({
            classDeclarations: 1,
            thisExpressions: 1,
            useStateCalls: 1,
            useEffectCalls: 1,
            useLayoutEffectCalls: 1,
            useCallbackCalls: 1,
            useMemoCalls: 1,
            useRefCalls: 1,
            useContextCalls: 1,
            useReducerCalls: 1,
            customHookCalls: 2,
        });
    });
});
