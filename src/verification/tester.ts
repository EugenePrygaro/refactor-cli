import { access, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Writable } from 'node:stream';
import type { Reporter } from 'vitest/node' with { 'resolution-mode': 'import' };

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

export async function runTests(
    generatedCode: string,
    generatedFilePath: string,
    testFilePath: string,
): Promise<string> {
    const generatedPath = path.resolve(generatedFilePath);
    const testPath = path.resolve(testFilePath);

    if (generatedPath === testPath) {
        throw new Error('The generated component and test file must be different paths.');
    }
    await access(testPath);
    await access(path.dirname(generatedPath));

    let generatedFileExists = true;
    try {
        await access(generatedPath);
    } catch (error) {
        if (
            !(error instanceof Error) ||
            !('code' in error) ||
            error.code !== 'ENOENT'
        ) {
            throw error;
        }
        generatedFileExists = false;
    }
    if (generatedFileExists) {
        throw new Error(`Refusing to overwrite existing generated file: ${generatedPath}`);
    }

    const failures: string[] = [];
    let runFailed = false;
    const reporter: Reporter = {
        onTestCaseResult(testCase) {
            const result = testCase.result();
            if (result.state === 'failed') {
                runFailed = true;
                for (const error of result.errors) {
                    failures.push(`${testCase.fullName}: ${error.stack ?? error.message}`);
                }
            }
        },
        onTestRunEnd(_testModules, unhandledErrors, reason) {
            if (reason !== 'passed' || unhandledErrors.length > 0) {
                runFailed = true;
            }
            failures.push(
                ...unhandledErrors.map((error) => error.stack ?? error.message),
            );
        },
    };
    const stdout = createOutputCapture();
    const stderr = createOutputCapture();
    const previousExitCode = process.exitCode;

    await writeFile(generatedPath, generatedCode, { flag: 'wx' });

    try {
        const { startVitest } = await import('vitest/node');
        await startVitest(
            [testPath],
            {
                run: true,
                watch: false,
                root: process.cwd(),
                reporters: ['default', reporter],
            },
            undefined,
            {
                stdout: stdout.stream,
                stderr: stderr.stream,
            },
        );

        runFailed ||= process.exitCode !== previousExitCode;
        if (!runFailed) {
            return '';
        }

        return (
            [
                stderr.getOutput().trim(),
                failures.join('\n\n').trim(),
            ]
                .filter(Boolean)
                .join('\n\n') || stdout.getOutput().trim()
        );
    } finally {
        process.exitCode = previousExitCode;
        await rm(generatedPath, { force: true });
    }
}
