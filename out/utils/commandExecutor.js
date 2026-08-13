"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandExecutor = void 0;
const child_process_1 = require("child_process");
const logger_1 = require("./logger");
class CommandExecutor {
    /**
     * Safely executes an executable with an array of arguments to prevent shell injection vulnerabilities.
     */
    static async execute(command, args, options = {}) {
        return new Promise((resolve) => {
            const execOptions = {
                windowsHide: true,
                maxBuffer: 10 * 1024 * 1024,
                ...options
            };
            (0, child_process_1.execFile)(command, args, execOptions, (error, stdout, stderr) => {
                const stdoutStr = (stdout || '').toString().trim();
                const stderrStr = (stderr || '').toString().trim();
                const exitCode = error ? (error.code && typeof error.code === 'number' ? error.code : 1) : 0;
                if (error && exitCode !== 0) {
                    logger_1.Logger.warn(`Command executed with code ${exitCode}: ${command} ${args.join(' ')}`);
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
exports.CommandExecutor = CommandExecutor;
//# sourceMappingURL=commandExecutor.js.map