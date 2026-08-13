import { CommandExecutor } from '../utils/commandExecutor';
import { Logger } from '../utils/logger';

export interface GitHubCliStatus {
    isInstalled: boolean;
    version?: string;
    activeUser?: string;
    loggedInUsers: string[];
}

export class GitHubCliStrategy {
    /**
     * Checks if GitHub CLI is installed and gets its auth state.
     */
    public async checkStatus(): Promise<GitHubCliStatus> {
        try {
            const versionRes = await CommandExecutor.execute('gh', ['--version']);
            if (versionRes.exitCode !== 0) {
                return { isInstalled: false, loggedInUsers: [] };
            }

            const versionLine = versionRes.stdout.split('\n')[0];

            const statusRes = await CommandExecutor.execute('gh', ['auth', 'status']);
            const output = statusRes.stdout + '\n' + statusRes.stderr;

            const loggedInUsers: string[] = [];
            let activeUser: string | undefined = undefined;

            // Parse logged in accounts from gh auth status
            const userMatches = output.matchAll(/Logged in to github\.com account ([A-Za-z0-9-]+)/g);
            for (const match of userMatches) {
                if (match[1]) {
                    loggedInUsers.push(match[1]);
                }
            }

            const activeMatch = output.match(/Active account: ([A-Za-z0-9-]+)/);
            if (activeMatch) {
                activeUser = activeMatch[1];
            } else if (loggedInUsers.length > 0) {
                activeUser = loggedInUsers[0];
            }

            return {
                isInstalled: true,
                version: versionLine,
                activeUser,
                loggedInUsers
            };
        } catch (error) {
            return { isInstalled: false, loggedInUsers: [] };
        }
    }

    /**
     * Switches active GitHub CLI account user.
     */
    public async switchAccount(username: string): Promise<boolean> {
        try {
            const res = await CommandExecutor.execute('gh', ['auth', 'switch', '--user', username]);
            if (res.exitCode === 0) {
                Logger.info(`GitHub CLI active user switched to: ${username}`);
                return true;
            } else {
                Logger.warn(`GitHub CLI switch failed for ${username}: ${res.stderr}`);
                return false;
            }
        } catch (error) {
            Logger.error(`Error switching GitHub CLI account to ${username}`, error);
            return false;
        }
    }
}
