import { execFile, ExecFileOptions } from 'child_process';
import { Logger } from './logger';

export interface CommandResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}

export class CommandExecutor {
    /**
     * Safely executes an executable with an array of arguments to prevent shell injection vulnerabilities.
     */
    public static async execute(
        command: string,
        args: string[],
        options: ExecFileOptions = {}
    ): Promise<CommandResult> {
        return new Promise((resolve) => {
            const execOptions: ExecFileOptions = {
                windowsHide: true,
                maxBuffer: 10 * 1024 * 1024, // 10MB
                ...options
            };

            execFile(command, args, execOptions, (error, stdout, stderr) => {
                const stdoutStr = (stdout || '').toString().trim();
                const stderrStr = (stderr || '').toString().trim();
                const exitCode = error ? (error.code && typeof error.code === 'number' ? error.code : 1) : 0;

                if (error && exitCode !== 0) {
                    Logger.warn(`Command executed with code ${exitCode}: ${command} ${args.join(' ')}`);
                }

                resolve({
                    stdout: stdoutStr,
                    stderr: stderrStr,
                    exitCode
                });
            });
        });
    }
}
