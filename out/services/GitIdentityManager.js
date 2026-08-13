"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitIdentityManager = void 0;
const commandExecutor_1 = require("../utils/commandExecutor");
const logger_1 = require("../utils/logger");
class GitIdentityManager {
    /**
     * Gets local git identity for a repository root path.
     */
    async getLocalIdentity(repoPath) {
        try {
            const nameRes = await commandExecutor_1.CommandExecutor.execute('git', ['config', '--local', 'user.name'], { cwd: repoPath });
            const emailRes = await commandExecutor_1.CommandExecutor.execute('git', ['config', '--local', 'user.email'], { cwd: repoPath });
            if (nameRes.stdout && emailRes.stdout) {
                return {
                    name: nameRes.stdout,
                    email: emailRes.stdout
                };
            }
            return undefined;
        }
        catch (error) {
            logger_1.Logger.error(`Error reading local git identity at ${repoPath}`, error);
            return undefined;
        }
    }
    /**
     * Configures local user.name and user.email for a repository without affecting global git config.
     */
    async setLocalIdentity(repoPath, profile) {
        try {
            const nameRes = await commandExecutor_1.CommandExecutor.execute('git', ['config', '--local', 'user.name', profile.displayName], { cwd: repoPath });
            const emailRes = await commandExecutor_1.CommandExecutor.execute('git', ['config', '--local', 'user.email', profile.githubEmail], { cwd: repoPath });
            if (nameRes.exitCode === 0 && emailRes.exitCode === 0) {
                logger_1.Logger.info(`Updated repository local Git identity at ${repoPath}: ${profile.displayName} <${profile.githubEmail}>`);
                return true;
            }
            else {
                logger_1.Logger.error(`Failed to set git config at ${repoPath}: ${nameRes.stderr} ${emailRes.stderr}`);
                return false;
            }
        }
        catch (error) {
            logger_1.Logger.error(`Failed to update git identity for profile ${profile.displayName}`, error);
            return false;
        }
    }
    /**
     * Validates if local repo identity matches target profile identity.
     */
    async isIdentityMatching(repoPath, profile) {
        const local = await this.getLocalIdentity(repoPath);
        if (!local)
            return false;
        return (local.email.toLowerCase() === profile.githubEmail.toLowerCase());
    }
}
exports.GitIdentityManager = GitIdentityManager;
//# sourceMappingURL=GitIdentityManager.js.map