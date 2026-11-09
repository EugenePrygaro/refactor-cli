import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LLMProvider, RefactoringContext } from '../llm/LLMProvider';
import { PipelineError, RefactorPipeline, type VerificationStep } from './RefactorPipeline';

const temporaryDirectories: string[] = [];

afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(
        temporaryDirectories.splice(0).map((directory) =>
            rm(directory, { recursive: true, force: true }),
        ),
    );
});

describe('RefactorPipeline', () => {
    it('retries transient model errors with exponential backoff and reports retry counts', async () => {
        const directory = await mkdtemp(path.join(process.cwd(), '.pipeline-test-'));
        temporaryDirectories.push(directory);
        const sourcePath = path.join(directory, 'Source.tsx');
        await writeFile(sourcePath, 'export const value = 1;');
        const delays: number[] = [];
        let calls = 0;
        const llm: LLMProvider = {
            name: 'test',
            providerName: 'openai',
            modelName: 'test-model',
            async refactorComponent() {
                calls++;
                if (calls < 3) {
                    throw Object.assign(new Error('temporarily unavailable'), {
                        status: 503,
                    });
                }
                return {
                    generatedCode: 'export const value = 1;',
                    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
                };
            },
        };
        const verificationStep: VerificationStep = {
            name: 'Test',
            async verify() {
                return [];
            },
        };

        const result = await new RefactorPipeline(llm, 3, [verificationStep], {
            maxRetries: 3,
            baseDelayMs: 50,
            sleep: async (milliseconds) => {
                delays.push(milliseconds);
            },
        }).runWithAttempts(sourcePath, '', '');

        expect(result).toMatchObject({ attemptCount: 1, retries: 2 });
        expect(result.attempts).toHaveLength(1);
        expect(result.attempts[0].apiRetries).toBe(2);
        expect(calls).toBe(3);
        expect(delays).toEqual([50, 100]);
    });

    it('does not retry non-transient model errors', async () => {
        const directory = await mkdtemp(path.join(process.cwd(), '.pipeline-test-'));
        temporaryDirectories.push(directory);
        const sourcePath = path.join(directory, 'Source.tsx');
        await writeFile(sourcePath, 'export const value = 1;');
        let calls = 0;
        const llm: LLMProvider = {
            name: 'test',
            providerName: 'openai',
            modelName: 'test-model',
            async refactorComponent() {
                calls++;
                throw Object.assign(new Error('unauthorized'), { status: 401 });
            },
        };

        await expect(
            new RefactorPipeline(llm, 3, [{
                name: 'Test',
                async verify() {
                    return [];
                },
            }], {
                maxRetries: 3,
                baseDelayMs: 0,
                sleep: async () => undefined,
            }).runWithAttempts(sourcePath, '', ''),
        ).rejects.toMatchObject<Partial<PipelineError>>({ retries: 0 });
        expect(calls).toBe(1);
    });

    it('returns the successful attempt count', async () => {
        const directory = await mkdtemp(path.join(process.cwd(), '.pipeline-test-'));
        temporaryDirectories.push(directory);

        const sourcePath = path.join(directory, 'Source.tsx');
        await writeFile(sourcePath, 'export const value = 1;');
        let verifications = 0;
        const verificationStep: VerificationStep = {
            name: 'Test',
            async verify() {
                verifications++;
                return verifications === 1 ? ['retry'] : [];
            },
        };
        const llm: LLMProvider = {
            name: 'test',
            providerName: 'openai',
            modelName: 'test-model',
            async refactorComponent() {
                return {
                    generatedCode: 'export const value = 1;',
                    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
                };
            },
        };

        const result = await new RefactorPipeline(llm, 3, [verificationStep])
            .runWithAttempts(sourcePath, '', '');

        expect(result).toEqual({
            generatedCode: 'export const value = 1;',
            attempts: expect.arrayContaining([
                expect.objectContaining({
                    attempt: 1,
                    failureStage: 'Test',
                    stageResults: expect.objectContaining({ test: 'fail' }),
                }),
                expect.objectContaining({
                    attempt: 2,
                    failureStage: 'None',
                    stageResults: expect.objectContaining({ test: 'pass' }),
                }),
            ]),
            attemptCount: 2,
            retries: 0,
            usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
            failureStage: 'None',
        });
    });

    it('includes the attempt count in failures', async () => {
        const directory = await mkdtemp(path.join(process.cwd(), '.pipeline-test-'));
        temporaryDirectories.push(directory);

        const sourcePath = path.join(directory, 'Source.tsx');
        await writeFile(sourcePath, 'export const value = 1;');
        const verificationStep: VerificationStep = {
            name: 'Test',
            async verify() {
                return ['invalid'];
            },
        };
        const llm: LLMProvider = {
            name: 'test',
            providerName: 'openai',
            modelName: 'test-model',
            async refactorComponent() {
                return {
                    generatedCode: 'export const value = 1;',
                    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
                };
            },
        };

        await expect(
            new RefactorPipeline(llm, 2, [verificationStep]).runWithAttempts(
                sourcePath,
                '',
                '',
            ),
        ).rejects.toMatchObject<Partial<PipelineError>>({
            attemptCount: 2,
            retries: 0,
            usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
            failureStage: 'Test',
        });
    });

    it('stops at the first failed check and sends its error to the next LLM attempt', async () => {
        const directory = await mkdtemp(path.join(process.cwd(), '.pipeline-test-'));
        temporaryDirectories.push(directory);

        const sourcePath = path.join(directory, 'LegacyComponent.tsx');
        const generatedFilePath = path.join(directory, 'GeneratedComponent.tsx');
        const testFilePath = path.join(directory, 'GeneratedComponent.test.tsx');
        await writeFile(sourcePath, 'export const original = true;');
        await writeFile(
            testFilePath,
            `
                import { expect, it } from 'vitest';
                import { answer } from './GeneratedComponent';

                it('returns the expected value', () => {
                    expect(answer).toBe(42);
                });
            `,
        );

        const generatedResponses = [
            'export const answer = ;',
            `
                import { useState } from 'react';

                export function Component() {
                    if (true) useState(0);
                    return null;
                }
            `,
            'export const answer = 0;',
            'export const answer = 42;',
        ];
        const contexts: RefactoringContext[] = [];
        const llm: LLMProvider = {
            name: 'test',
            providerName: 'openai',
            modelName: 'test-model',
            async refactorComponent(context) {
                contexts.push({ ...context });
                const response = generatedResponses.shift();
                if (response === undefined) {
                    throw new Error('No generated response remains.');
                }
                return {
                    generatedCode: response,
                    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
                };
            },
        };

        const result = await new RefactorPipeline(llm, 4).run(
            sourcePath,
            generatedFilePath,
            testFilePath,
        );

        expect(result).toBe('export const answer = 42;');
        expect(contexts).toHaveLength(4);
        expect(contexts[0].errorMessage).toBeUndefined();
        expect(contexts[1].errorMessage).toContain('Syntax verification failed');
        expect(contexts[2].errorMessage).toContain('Linter verification failed');
        expect(contexts[3].errorMessage).toContain('Unit Tests verification failed');
    }, 30_000);

    it('sends masked JSX to the LLM and verifies the restored JSX', async () => {
        const directory = await mkdtemp(path.join(process.cwd(), '.pipeline-test-'));
        temporaryDirectories.push(directory);
        const sourcePath = path.join(directory, 'LegacyComponent.tsx');
        const source = `
            class LegacyComponent extends React.Component {
                render() {
                    return (
                        <section>
                            <strong>{this.props.title}</strong>
                        </section>
                    );
                }
            }
        `;
        await writeFile(sourcePath, source);
        const contexts: RefactoringContext[] = [];
        const verifiedCode: string[] = [];
        const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
        const llm: LLMProvider = {
            name: 'test',
            providerName: 'openai',
            modelName: 'test-model',
            async refactorComponent(context) {
                contexts.push({ ...context });
                return {
                    generatedCode: 'function Component() { return <JSX_MASK_0 />; }',
                    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
                };
            },
        };
        const verificationStep: VerificationStep = {
            name: 'Test',
            async verify(code) {
                verifiedCode.push(code);
                return [];
            },
        };

        const result = await new RefactorPipeline(llm, 1, [verificationStep])
            .runWithAttempts(sourcePath, '', '');

        expect(contexts[0].originalCode).toContain('<JSX_MASK_0 />');
        expect(contexts[0].originalCode).not.toContain('this.props.title');
        expect(contexts[0].dependencyContract).toEqual({
            requiredProps: ['title'],
            requiredState: [],
            requiredMethods: [],
            unresolvedAccesses: [],
        });
        expect(verifiedCode[0]).toContain('<strong>{title}</strong>');
        expect(result.generatedCode).toBe(verifiedCode[0]);
        expect(result.generatedCode).not.toContain('JSX_MASK_0');
        expect(log).toHaveBeenCalledWith(expect.stringContaining('[AST slicer]'));
    });

    it('retries when the LLM omits a JSX placeholder', async () => {
        const directory = await mkdtemp(path.join(process.cwd(), '.pipeline-test-'));
        temporaryDirectories.push(directory);
        const sourcePath = path.join(directory, 'LegacyComponent.tsx');
        await writeFile(
            sourcePath,
            'class LegacyComponent extends React.Component { render() { return <div>Keep me</div>; } }',
        );
        const contexts: RefactoringContext[] = [];
        let calls = 0;
        const llm: LLMProvider = {
            name: 'test',
            providerName: 'openai',
            modelName: 'test-model',
            async refactorComponent(context) {
                contexts.push({ ...context });
                calls++;
                return {
                    generatedCode: calls === 1
                        ? 'function Component() { return null; }'
                        : 'function Component() { return <JSX_MASK_0 />; }',
                    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
                };
            },
        };
        const verificationStep: VerificationStep = {
            name: 'Test',
            async verify() {
                return [];
            },
        };

        const result = await new RefactorPipeline(llm, 2, [verificationStep])
            .runWithAttempts(sourcePath, '', '');

        expect(result.attemptCount).toBe(2);
        expect(contexts[1].errorMessage).toContain('JSX restoration failed');
        expect(contexts[1].errorMessage).toContain('omitted JSX placeholder');
        expect(result.generatedCode).toContain('<div>Keep me</div>');
    });

    it('records non-transient generation errors and continues to another attempt', async () => {
        const directory = await mkdtemp(path.join(process.cwd(), '.pipeline-test-'));
        temporaryDirectories.push(directory);
        const sourcePath = path.join(directory, 'Source.tsx');
        await writeFile(sourcePath, 'export const value = 1;');
        const contexts: RefactoringContext[] = [];
        let calls = 0;
        const llm: LLMProvider = {
            name: 'test',
            providerName: 'openai',
            modelName: 'test-model',
            async refactorComponent(context) {
                contexts.push({ ...context });
                calls++;
                if (calls === 1) {
                    throw Object.assign(new Error('HTTP 400 context too long'), {
                        status: 400,
                    });
                }
                return {
                    generatedCode: 'export const value = 1;',
                    usage: { promptTokens: 2, completionTokens: 1, totalTokens: 3 },
                };
            },
        };

        const result = await new RefactorPipeline(llm, 2, [{
            name: 'Syntax',
            async verify() {
                return [];
            },
        }]).runWithAttempts(sourcePath, '', '');

        expect(result.attemptCount).toBe(2);
        expect(result.attempts[0]).toMatchObject({
            stageReached: 'Generation',
            failureStage: 'Generation',
            errorCategory: 'generation_error',
            tokens: { prompt: null, completion: null, total: null },
            stageResults: {
                restoration: 'skipped',
                syntax: 'skipped',
                linter: 'skipped',
                test: 'skipped',
            },
        });
        expect(contexts[1].errorMessage).toContain('HTTP 400 context too long');
    });

    it('classifies empty responses as format attempts and caps feedback with head and tail', async () => {
        const directory = await mkdtemp(path.join(process.cwd(), '.pipeline-test-'));
        temporaryDirectories.push(directory);
        const sourcePath = path.join(directory, 'Source.tsx');
        await writeFile(sourcePath, 'export const value = 1;');
        const contexts: RefactoringContext[] = [];
        let calls = 0;
        const longError = `${'HEAD '.repeat(60)}${'TAIL '.repeat(60)}`;
        const llm: LLMProvider = {
            name: 'test',
            providerName: 'openai',
            modelName: 'test-model',
            async refactorComponent(context) {
                contexts.push({ ...context });
                calls++;
                if (calls === 1) {
                    return {
                        generatedCode: '',
                        rawResponseLength: 0,
                        usage: { promptTokens: 2, completionTokens: 0, totalTokens: 2 },
                    };
                }
                return {
                    generatedCode: 'export const value = 1;',
                    usage: { promptTokens: 2, completionTokens: 1, totalTokens: 3 },
                };
            },
        };
        let verificationCalls = 0;
        const verification: VerificationStep = {
            name: 'Test',
            async verify() {
                verificationCalls++;
                return verificationCalls === 1 ? [longError] : [];
            },
        };
        const result = await new RefactorPipeline(
            llm,
            3,
            [verification],
            {
                maxRetries: 0,
                baseDelayMs: 0,
                sleep: async () => undefined,
            },
            100,
        ).runWithAttempts(sourcePath, '', '');

        expect(result.attempts[0]).toMatchObject({
            failureStage: 'Format',
            errorCategory: 'format',
            rawResponseLength: 0,
        });
        expect(result.attempts[1]).toMatchObject({
            failureStage: 'Test',
            errorCategory: 'other',
            errorMessageFullLength: expect.any(Number),
        });
        expect(result.attempts[1].errorMessage.length).toBeLessThanOrEqual(2_000);
        expect(contexts[2].errorMessage).toContain('…truncated…');
        expect(contexts[2].errorMessage?.length).toBeLessThanOrEqual(100);
        expect(contexts[2].errorMessage).toContain('HEAD');
        expect(contexts[2].errorMessage).toContain('TAIL');
    });

    it('aborts on fatal authentication errors and preserves the failed attempt record', async () => {
        const directory = await mkdtemp(path.join(process.cwd(), '.pipeline-test-'));
        temporaryDirectories.push(directory);
        const sourcePath = path.join(directory, 'Source.tsx');
        await writeFile(sourcePath, 'export const value = 1;');
        let calls = 0;
        const llm: LLMProvider = {
            name: 'test',
            providerName: 'openai',
            modelName: 'test-model',
            async refactorComponent() {
                calls++;
                throw Object.assign(new Error('invalid API key'), { status: 401 });
            },
        };

        await expect(
            new RefactorPipeline(llm).runWithAttempts(sourcePath, '', ''),
        ).rejects.toMatchObject({
            fatal: true,
            failureStage: 'Generation',
            attempts: [
                expect.objectContaining({
                    errorCategory: 'generation_error',
                    failureStage: 'Generation',
                }),
            ],
        });
        expect(calls).toBe(1);
    });

    it('aborts on a model-not-found 404 configuration error', async () => {
        const directory = await mkdtemp(path.join(process.cwd(), '.pipeline-test-'));
        temporaryDirectories.push(directory);
        const sourcePath = path.join(directory, 'Source.tsx');
        await writeFile(sourcePath, 'export const value = 1;');
        const llm: LLMProvider = {
            name: 'test',
            providerName: 'openai',
            modelName: 'missing-model',
            async refactorComponent() {
                throw Object.assign(new Error('The requested model was not found.'), {
                    status: 404,
                });
            },
        };

        await expect(
            new RefactorPipeline(llm).runWithAttempts(sourcePath, '', ''),
        ).rejects.toMatchObject({
            fatal: true,
            message: expect.stringContaining('Fatal LLM configuration error'),
            failureStage: 'Generation',
        });
    });

    it('stops with Invalid status when the legacy behavioral contract fails', async () => {
        const directory = await mkdtemp(path.join(process.cwd(), '.pipeline-test-'));
        temporaryDirectories.push(directory);
        const sourcePath = path.join(directory, 'Source.tsx');
        await writeFile(sourcePath, 'export const value = 1;');
        const llm: LLMProvider = {
            name: 'test',
            providerName: 'openai',
            modelName: 'test-model',
            async refactorComponent() {
                return {
                    generatedCode: 'export const value = 1;',
                    usage: { promptTokens: 2, completionTokens: 1, totalTokens: 3 },
                };
            },
        };
        const tests: VerificationStep = {
            name: 'Unit Tests',
            async verify() {
                return {
                    errors: ['legacy contract assertion failed'],
                    testResult: {
                        passed: false,
                        testsTotal: 2,
                        testsPassed: 1,
                        legacyPassed: false,
                        generatedPassed: true,
                        errorText: 'legacy contract assertion failed',
                    },
                };
            },
        };

        await expect(
            new RefactorPipeline(llm, 3, [tests]).runWithAttempts(
                sourcePath,
                '',
                '',
            ),
        ).rejects.toMatchObject({
            componentStatus: 'Invalid',
            failureStage: 'Infrastructure',
            attemptCount: 1,
            attempts: [
                expect.objectContaining({
                    errorCategory: 'legacy_contract_failed',
                    legacyPassed: false,
                    generatedPassed: true,
                    testsPassed: 1,
                    testsTotal: 2,
                }),
            ],
        });
    });

    it('records a crashed verification tool as infrastructure and retries', async () => {
        const directory = await mkdtemp(path.join(process.cwd(), '.pipeline-test-'));
        temporaryDirectories.push(directory);
        const sourcePath = path.join(directory, 'Source.tsx');
        await writeFile(sourcePath, 'export const value = 1;');
        let calls = 0;
        const llm: LLMProvider = {
            name: 'test',
            providerName: 'openai',
            modelName: 'test-model',
            async refactorComponent() {
                calls++;
                return {
                    generatedCode: 'export const value = 1;',
                    usage: { promptTokens: 2, completionTokens: 1, totalTokens: 3 },
                };
            },
        };
        const verifier: VerificationStep = {
            name: 'Unit Tests',
            async verify() {
                if (calls === 1) {
                    throw new Error('Vitest runner crashed');
                }
                return [];
            },
        };

        const result = await new RefactorPipeline(llm, 2, [verifier])
            .runWithAttempts(sourcePath, '', '');

        expect(result.attempts[0]).toMatchObject({
            failureStage: 'Infrastructure',
            errorCategory: 'infrastructure',
            stageResults: { test: 'fail' },
        });
        expect(result.attempts[1].failureStage).toBe('None');
    });
});
