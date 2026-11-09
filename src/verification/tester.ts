import { access, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Writable } from 'node:stream';
import type { Reporter } from 'vitest/node' with { 'resolution-mode': 'import' };

export interface TestRunResult {
    passed: boolean;
    testsTotal: number;
    testsPassed: number;
    legacyPassed: boolean;
    generatedPassed: boolean;
    errorText: string;
    infrastructureError?: boolean;
}

export interface TestCoverageOptions {
    reportsDirectory: string;
    includeFile: string;
}

interface TestCaseOutcome {
    name: string;
    passed: boolean;
    errorText: string;
}

function createOutputCapture(): { stream: Writable; getOutput: () => string } {
    let output = '';
    const stream = new Writable({
        write(chunk: Buffer | string, _encoding, callback) {
            output += chunk.toString();
            callback();
        },
    });

    return { stream, getOutput: () => output };
}

function errorText(error: unknown): string {
    return error instanceof Error ? error.stack ?? error.message : String(error);
}

function failureResult(message: string): TestRunResult {
    return {
        passed: false,
        testsTotal: 0,
        testsPassed: 0,
        legacyPassed: true,
        generatedPassed: false,
        errorText: message,
        infrastructureError: true,
    };
}

export async function runTests(
    generatedCode: string,
    generatedFilePath: string,
    testFilePath: string,
    coverage?: TestCoverageOptions,
): Promise<TestRunResult> {
    const generatedPath = path.resolve(generatedFilePath);
    const testPath = path.resolve(testFilePath);
    const caseOutcomes: TestCaseOutcome[] = [];
    let generatedFileCreated = false;
    const previousExitCode = process.exitCode;
    let runFailed = false;
    let infrastructureError = false;
    const unhandledErrors: string[] = [];
    const reporter: Reporter = {
        onTestCaseResult(testCase) {
            const result = testCase.result();
            const errors = (result.errors ?? []).map(
                (error) => error.stack ?? error.message,
            );
            caseOutcomes.push({
                name: testCase.fullName,
                passed: result.state === 'passed',
                errorText: errors.join('\n\n'),
            });
            if (result.state === 'failed') {
                runFailed = true;
            }
        },
        onTestRunEnd(_testModules, errors, reason) {
            if (reason !== 'passed' || errors.length > 0) {
                runFailed = true;
            }
            unhandledErrors.push(...errors.map((error) => errorText(error)));
            if (errors.length > 0 || (reason !== 'passed' && caseOutcomes.length === 0)) {
                infrastructureError = true;
            }
        },
    };
    const stdout = createOutputCapture();
    const stderr = createOutputCapture();

    try {
        if (generatedPath === testPath) {
            return failureResult(
                'The generated component and test file must be different paths.',
            );
        }
        await access(testPath);
        await access(path.dirname(generatedPath));

        try {
            await access(generatedPath);
            return failureResult(`Refusing to overwrite existing generated file: ${generatedPath}`);
        } catch (error: unknown) {
            if (
                !(error instanceof Error) ||
                !('code' in error) ||
                error.code !== 'ENOENT'
            ) {
                throw error;
            }
        }

        await writeFile(generatedPath, generatedCode, { flag: 'wx' });
        generatedFileCreated = true;

        const { startVitest } = await import('vitest/node');
        await startVitest(
            'test',
            [testPath],
            {
                run: true,
                watch: false,
                root: process.cwd(),
                reporters: ['default', reporter],
                ...(coverage
                    ? {
                          coverage: {
                              enabled: true,
                              provider: 'v8',
                              reportsDirectory: coverage.reportsDirectory,
                              reporter: ['json-summary'],
                              include: [
                                  path
                                      .relative(process.cwd(), coverage.includeFile)
                                      .split(path.sep)
                                      .join('/'),
                              ],
                          },
                      }
                    : {}),
            },
            undefined,
            {
                stdout: stdout.stream,
                stderr: stderr.stream,
            },
        );

        runFailed ||= process.exitCode !== previousExitCode;
        const namedLegacyCases = caseOutcomes.filter((testCase) =>
            /satisfies the shared legacy behavior/i.test(testCase.name),
        );
        const namedGeneratedCases = caseOutcomes.filter((testCase) =>
            /satisfies the shared generated behavior/i.test(testCase.name),
        );
        const legacyPassed = namedLegacyCases.every((testCase) => testCase.passed);
        const testsPassed = caseOutcomes.filter((testCase) => testCase.passed).length;
        const failureMessages = [
            ...caseOutcomes
                .filter((testCase) => !testCase.passed && testCase.errorText)
                .map((testCase) => `${testCase.name}: ${testCase.errorText}`),
            ...unhandledErrors,
        ];
        const capturedOutput = [stderr.getOutput().trim(), stdout.getOutput().trim()]
            .filter(Boolean)
            .join('\n\n');
        const errorOutput = [...failureMessages, capturedOutput]
            .filter(Boolean)
            .join('\n\n');
        const passed = !runFailed && !infrastructureError;

        return {
            passed,
            testsTotal: caseOutcomes.length,
            testsPassed,
            legacyPassed,
            generatedPassed: namedGeneratedCases.length > 0
                ? namedGeneratedCases.every((testCase) => testCase.passed)
                : !runFailed,
            errorText: passed ? '' : errorOutput,
            infrastructureError,
        };
    } catch (error: unknown) {
        return failureResult(
            [errorText(error), stderr.getOutput().trim(), stdout.getOutput().trim()]
                .filter(Boolean)
                .join('\n\n'),
        );
    } finally {
        process.exitCode = previousExitCode;
        if (generatedFileCreated) {
            await rm(generatedPath, { force: true });
        }
    }
}
