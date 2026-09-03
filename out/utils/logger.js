"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
let vscodeModule;
try {
    vscodeModule = require('vscode');
}
catch {
    vscodeModule = undefined;
}
class Logger {
    static initialize(channelName = 'GitHub Account Manager') {
        if (!this.outputChannel && vscodeModule && vscodeModule.window) {
            this.outputChannel = vscodeModule.window.createOutputChannel(channelName);
        }
    }
    static info(message) {
        this.log('INFO', message);
    }
    static warn(message, error) {
        const errorDetails = error ? ` Details: ${error instanceof Error ? error.stack || error.message : String(error)}` : '';
        this.log('WARN', `${message}${errorDetails}`);
    }
    static error(message, error) {
        const errorDetails = error ? ` Details: ${error instanceof Error ? error.stack || error.message : String(error)}` : '';
        this.log('ERROR', `${message}${errorDetails}`);
    }
    static log(level, message) {
        const sanitizedMessage = this.redactSecrets(message);
        const formatted = `[${new Date().toISOString()}] [${level}] ${sanitizedMessage}`;
        if (this.outputChannel) {
            this.outputChannel.appendLine(formatted);
        }
        else {
            console.error(formatted);
        }
    }
    /**
     * Redacts tokens, keys, and credentials from log outputs.
     */
    static redactSecrets(text) {
        if (!text)
            return text;
        return text
            // GitHub OAuth/PAT tokens (ghp_, gho_, ghr_, ghu_, ghs_)
            .replace(/gh[pousr]_[A-Za-z0-9_]{36,255}/g, '[REDACTED_GITHUB_TOKEN]')
            .replace(/github_pat_[A-Za-z0-9_]+/g, '[REDACTED_GITHUB_TOKEN]')
            // SSH Private Key blocks
            .replace(/-----BEGIN [A-Z]+ PRIVATE KEY-----[\s\S]*?-----END [A-Z]+ PRIVATE KEY-----/g, '[REDACTED_PRIVATE_KEY]')
            // Generic password/token URL credentials
            .replace(/https:\/\/[^:]+:([^@]+)@github\.com/g, 'https://[REDACTED_CREDENTIAL]@github.com');
    }
    static showOutputChannel() {
        this.outputChannel?.show();
    }
}
exports.Logger = Logger;
//# sourceMappingURL=logger.js.map