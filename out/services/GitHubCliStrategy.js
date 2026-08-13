"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubCliStrategy = void 0;
const commandExecutor_1 = require("../utils/commandExecutor");
const logger_1 = require("../utils/logger");
class GitHubCliStrategy {
    /**
     * Checks if GitHub CLI is installed and gets its auth state.
     */
    async checkStatus() {
        try {
            const versionRes = await commandExecutor_1.CommandExecutor.execute('gh', ['--version']);
            if (versionRes.exitCode !== 0) {
                return { isInstalled: false, loggedInUsers: [] };
            }
            const versionLine = versionRes.stdout.split('\n')[0];
            const statusRes = await commandExecutor_1.CommandExecutor.execute('gh', ['auth', 'status']);
            const output = statusRes.stdout + '\n' + statusRes.stderr;
            const loggedInUsers = [];
            let activeUser = undefined;
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
            }
            else if (loggedInUsers.length > 0) {
                activeUser = loggedInUsers[0];
            }
            return {
                isInstalled: true,
                version: versionLine,
                activeUser,
                loggedInUsers
            };
        }
        catch (error) {
            return { isInstalled: false, loggedInUsers: [] };
        }
    }
    /**
     * Switches active GitHub CLI account user.
     */
    async switchAccount(username) {
        try {
            const res = await commandExecutor_1.CommandExecutor.execute('gh', ['auth', 'switch', '--user', username]);
            if (res.exitCode === 0) {
                logger_1.Logger.info(`GitHub CLI active user switched to: ${username}`);
                return true;
            }
            else {
                logger_1.Logger.warn(`GitHub CLI switch failed for ${username}: ${res.stderr}`);
                return false;
            }
        }
        catch (error) {
            logger_1.Logger.error(`Error switching GitHub CLI account to ${username}`, error);
            return false;
        }
    }
}
exports.GitHubCliStrategy = GitHubCliStrategy;
//# sourceMappingURL=GitHubCliStrategy.js.map