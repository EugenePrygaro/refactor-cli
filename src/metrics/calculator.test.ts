import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { calculateMetrics, calculateMiClassic } from './calculator';
import { normalizeForMetrics } from './normalize';

describe('calculateMetrics', () => {
    it('returns normalized aggregate and per-function metrics', async () => {
        const result = await calculateMetrics(`
            function example(value: boolean): boolean {
                if (value) {
                    return true;
                }
                return false;
            }
        `);

        expect(result.ok).toBe(true);
        if (!result.ok) {
            throw new Error(result.error);
        }

        expect(result.metrics.cyclomaticComplexity).toBeGreaterThan(0);
        expect(result.metrics.miEscomplex).toBeGreaterThan(0);
        expect(result.metrics.sloc).toBeGreaterThan(0);
        expect(result.metrics.physicalSloc).toBeGreaterThan(0);
        expect(result.metrics.functionCount).toBe(1);
        expect(result.metrics.cyclomaticAvg).toBe(2);
        expect(result.metrics.cyclomaticMax).toBe(2);
        expect(result.metrics.halsteadEffort).toBeGreaterThan(0);
        expect(result.metrics.halsteadVolume).toBeGreaterThan(0);
        expect(result.metrics.miClassicNormalized).toBeGreaterThanOrEqual(0);
    });

    it('returns an error result instead of throwing for invalid source', async () => {
        await expect(calculateMetrics('const answer = ;')).resolves.toMatchObject({
            ok: false,
            error: expect.any(String),
        });
    });

    it('computes the Coleman-Oman MI from hand-computed per-function averages', () => {
        const mi = calculateMiClassic(100, 4, 10);
        const expected = 171 - 5.2 * Math.log(100) - 0.23 * 4 - 16.2 * Math.log(10);

        expect(mi).toBeCloseTo(expected, 12);
        expect(mi).toBeCloseTo(108.8312365, 6);
        expect(calculateMiClassic(0, 0, 0)).toBe(171);
    });

    it('produces equal metrics for equivalent code with different formatting', async () => {
        const compact = `
            export function calculate(value:number){if(value>0){return value+1;}else{return 0;}}
        `;
        const formatted = `
            export function calculate(value: number) {
                if (value > 0) {
                    return value + 1;
                } else {
                    return 0;
                }
            }
        `;

        const [compactMetrics, formattedMetrics] = await Promise.all([
            calculateMetrics(compact),
            calculateMetrics(formatted),
        ]);

        expect(compactMetrics.ok).toBe(true);
        expect(formattedMetrics.ok).toBe(true);
        if (compactMetrics.ok && formattedMetrics.ok) {
            expect(compactMetrics.metrics).toEqual(formattedMetrics.metrics);
        }
    });

    it('normalizes every legacy dataset component, including component-32', async () => {
        const datasetRoot = path.resolve(process.cwd(), 'dataset');
        const componentDirectories = readdirSync(datasetRoot, {
            withFileTypes: true,
        })
            .filter(
                (entry) =>
                    entry.isDirectory() && /^component-\d+$/.test(entry.name),
            )
            .map(({ name }) => name)
            .sort();

        expect(componentDirectories).toContain('component-32');

        for (const componentId of componentDirectories) {
            const source = readFileSync(
                path.join(datasetRoot, componentId, 'LegacyComponent.tsx'),
                'utf8',
            );
            const result = await calculateMetrics(source);
            expect(
                result,
                `${componentId} should be measurable: ${result.ok ? '' : result.error}`,
            ).toMatchObject({ ok: true });
        }
    }, 60_000);

    it('keeps JSX while removing TypeScript-only syntax during normalization', async () => {
        const normalized = await normalizeForMetrics(`
            type Props = { label: string };
            const Component = ({ label }: Props) => <div>{label}</div>;
        `);

        expect(normalized).toContain('<div>');
        expect(normalized).not.toContain('type Props');
        expect(normalized).not.toContain(': Props');
    });
});
