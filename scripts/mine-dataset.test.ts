import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createIsolatedVitestTest, mineDataset } from './mine-dataset';

const temporaryDirectories: string[] = [];

afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(
        temporaryDirectories.splice(0).map((directory) =>
            rm(directory, { recursive: true, force: true }),
        ),
    );
});

describe('mineDataset', () => {
    it('generates an isolated Vitest test for the generated component and mocks imports', () => {
        const testCode = createIsolatedVitestTest(`
            import React, { useState } from 'react';
            import { Modal } from '../../ui';
            import type { Props } from './types';
            export function LegacyComponent() {
                const [open] = useState(false);
                return <Modal open={open} />;
            }
        `);

        expect(testCode).toContain("from 'vitest'");
        expect(testCode).toContain("vi.mock(\"../../ui\"");
        expect(testCode).toContain("from './ModernComponent'");
        expect(testCode).not.toContain("from './LegacyComponent'");
        expect(testCode).not.toContain('jest.');
    });

    it('copies matching component and test files while skipping the output folder', async () => {
        const root = await mkdtemp(path.join(os.tmpdir(), 'dataset-miner-'));
        temporaryDirectories.push(root);
        const sourceDir = path.join(root, 'repository');
        const targetDir = path.join(sourceDir, 'dataset');
        await mkdir(targetDir, { recursive: true });
        await writeFile(
            path.join(sourceDir, 'Counter.tsx'),
            'export class Counter extends React.Component {}',
        );
        await writeFile(
            path.join(sourceDir, 'Counter.unit.spec.tsx'),
            'import { it } from "vitest";',
        );
        await writeFile(
            path.join(targetDir, 'LegacyExisting.tsx'),
            'export class Existing extends React.Component {}',
        );
        await writeFile(
            path.join(targetDir, 'LegacyExisting.test.tsx'),
            'import { it } from "vitest";',
        );

        vi.spyOn(console, 'log').mockImplementation(() => undefined);

        const copiedCount = mineDataset({ sourceDir, targetDir });

        expect(copiedCount).toBe(1);
        await expect(
            readFile(path.join(targetDir, 'component-01', 'LegacyComponent.tsx'), 'utf8'),
        ).resolves.toContain('React.Component');
        await expect(
            readFile(
                path.join(targetDir, 'component-01', 'LegacyComponent.test.tsx'),
                'utf8',
            ),
        ).resolves.toContain('vitest');
    });

    it('does not overwrite existing numbered components on repeated runs', async () => {
        const root = await mkdtemp(path.join(os.tmpdir(), 'dataset-miner-'));
        temporaryDirectories.push(root);
        const sourceDir = path.join(root, 'repository');
        const targetDir = path.join(root, 'dataset');
        const existingComponent = path.join(targetDir, 'component-01');
        await mkdir(sourceDir, { recursive: true });
        await mkdir(existingComponent, { recursive: true });
        await writeFile(path.join(existingComponent, 'keep.txt'), 'existing');
        await writeFile(
            path.join(sourceDir, 'Counter.tsx'),
            'export class Counter extends React.Component {}',
        );
        await writeFile(
            path.join(sourceDir, 'Counter.test.tsx'),
            'import { it } from "vitest";',
        );

        vi.spyOn(console, 'log').mockImplementation(() => undefined);

        expect(mineDataset({ sourceDir, targetDir })).toBe(1);
        await expect(readFile(path.join(existingComponent, 'keep.txt'), 'utf8')).resolves.toBe(
            'existing',
        );
        await expect(
            readFile(path.join(targetDir, 'component-02', 'LegacyComponent.tsx'), 'utf8'),
        ).resolves.toContain('React.Component');
    });

    it('rejects invalid limits and missing source directories', () => {
        expect(() => mineDataset({ sourceDir: '.', targetDir: './dataset', limit: 0 })).toThrow(
            'positive integer',
        );
        expect(() =>
            mineDataset({ sourceDir: './missing-miner-source', targetDir: './dataset' }),
        ).toThrow('does not exist');
    });
});
