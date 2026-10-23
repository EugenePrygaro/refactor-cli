import { describe, expect, it } from 'vitest';
import { lintCode } from './linter';

describe('lintCode', () => {
    it('returns formatted React Hooks violations for TSX code', async () => {
        const messages = await lintCode(`
            import { useEffect, useState } from 'react';

            type Props = { value: string };

            function Example({ value }: Props) {
                if (value) useState(0);
                useEffect(() => {
                    console.log(value);
                }, []);
                return <div />;
            }
        `);

        expect(messages).toHaveLength(2);
        expect(messages[0]).toContain('[react-hooks/rules-of-hooks]');
        expect(messages[1]).toContain('[react-hooks/exhaustive-deps]');
        expect(messages.every((message) => /^\d+:\d+: error /.test(message))).toBe(true);
    });

    it('returns no messages for valid TSX code', async () => {
        const messages = await lintCode(`
            import { useEffect } from 'react';

            type Props = { value: string };

            function Example({ value }: Props) {
                useEffect(() => {
                    console.log(value);
                }, [value]);
                return <div />;
            }
        `);

        expect(messages).toEqual([]);
    });
});
