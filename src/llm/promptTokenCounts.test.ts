import { describe, expect, it } from 'vitest';
import {
    calculateEta,
    countPromptTokens,
    serializePromptTokenCsv,
} from './promptTokenCounts';

describe('prompt token savings', () => {
    it('calculates eta as the relative token reduction', () => {
        expect(calculateEta(60, 100)).toBeCloseTo(0.4);
        expect(calculateEta(100, 100)).toBe(0);
        expect(calculateEta(0, 0)).toBeNull();
    });

    it('counts both prompt variants with a fake counter and serializes the result to CSV', async () => {
        const seenPrompts: string[] = [];
        const row = await countPromptTokens(
            'component-01',
            'fake-model',
            'sliced prompt',
            'full prompt',
            {
                count(prompt) {
                    seenPrompts.push(prompt);
                    return prompt === 'sliced prompt' ? 60 : 100;
                },
            },
        );

        expect(seenPrompts).toEqual(['sliced prompt', 'full prompt']);
        expect(row).toEqual({
            component: 'component-01',
            model: 'fake-model',
            tokensSliced: 60,
            tokensFull: 100,
            eta: 0.4,
        });
        expect(serializePromptTokenCsv([row])).toBe(
            'component,model,tokens_sliced,tokens_full,eta\ncomponent-01,fake-model,60,100,0.4\n',
        );
    });
});
