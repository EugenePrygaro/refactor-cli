import { describe, expect, it } from 'vitest';
import { calculateMetrics } from './calculator';

describe('calculateMetrics', () => {
    it('returns cyclomatic complexity, maintainability index, and logical SLOC', () => {
        const metrics = calculateMetrics(`
            function example(value) {
                if (value) {
                    return true;
                }
                return false;
            }
        `);

        expect(metrics.cyclomaticComplexity).toBe(3);
        expect(metrics.maintainabilityIndex).toBeGreaterThan(0);
        expect(metrics.sloc).toBe(4);
    });

    it('throws for source that cannot be parsed', () => {
        expect(() => calculateMetrics('const answer = ;')).toThrow();
    });
});
