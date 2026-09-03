let vscodeModule: typeof import('vscode') | undefined;
try {
    vscodeModule = require('vscode');
} catch {
    vscodeModule = undefined;
}

export class Logger {
    private static outputChannel: any | undefined;

    public static initialize(channelName: string = 'GitHub Account Manager'): void {
        if (!this.outputChannel && vscodeModule && vscodeModule.window) {
            this.outputChannel = vscodeModule.window.createOutputChannel(channelName);
        }
    }

    public static info(message: string): void {
        this.log('INFO', message);
    }

    public static warn(message: string, error?: any): void {
        const errorDetails = error ? ` Details: ${error instanceof Error ? error.stack || error.message : String(error)}` : '';
        this.log('WARN', `${message}${errorDetails}`);
    }

    public static error(message: string, error?: any): void {
        const errorDetails = error ? ` Details: ${error instanceof Error ? error.stack || error.message : String(error)}` : '';
        this.log('ERROR', `${message}${errorDetails}`);
    }

    private static log(level: string, message: string): void {
        const sanitizedMessage = this.redactSecrets(message);
        const formatted = `[${new Date().toISOString()}] [${level}] ${sanitizedMessage}`;
        if (this.outputChannel) {
            this.outputChannel.appendLine(formatted);
        } else {
            console.error(formatted);
        }
    }

    /**
     * Redacts tokens, keys, and credentials from log outputs.
     */
    public static redactSecrets(text: string): string {
        if (!text) return text;
        return text
            // GitHub OAuth/PAT tokens (ghp_, gho_, ghr_, ghu_, ghs_)
            .replace(/gh[pousr]_[A-Za-z0-9_]{36,255}/g, '[REDACTED_GITHUB_TOKEN]')
            .replace(/github_pat_[A-Za-z0-9_]+/g, '[REDACTED_GITHUB_TOKEN]')
            // SSH Private Key blocks
            .replace(/-----BEGIN [A-Z]+ PRIVATE KEY-----[\s\S]*?-----END [A-Z]+ PRIVATE KEY-----/g, '[REDACTED_PRIVATE_KEY]')
            // Generic password/token URL credentials
            .replace(/https:\/\/[^:]+:([^@]+)@github\.com/g, 'https://[REDACTED_CREDENTIAL]@github.com');
    }

    public static showOutputChannel(): void {
        this.outputChannel?.show();
    }
}
