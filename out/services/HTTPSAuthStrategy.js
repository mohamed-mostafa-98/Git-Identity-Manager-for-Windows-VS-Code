"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HTTPSAuthStrategy = void 0;
const commandExecutor_1 = require("../utils/commandExecutor");
const logger_1 = require("../utils/logger");
class HTTPSAuthStrategy {
    /**
     * Configures Git Credential Manager (GCM) for HTTPS authentication.
     * Enforces credential.useHttpPath = true to isolate credentials in Windows Credential Vault by path/username.
     */
    async configureHTTPSAuth(repoPath, profile) {
        try {
            // Enable useHttpPath locally for this repo so GCM includes full path in target lookup
            const httpPathRes = await commandExecutor_1.CommandExecutor.execute('git', ['config', '--local', 'credential.useHttpPath', 'true'], { cwd: repoPath });
            if (httpPathRes.exitCode !== 0) {
                logger_1.Logger.warn(`Failed to set credential.useHttpPath=true at ${repoPath}: ${httpPathRes.stderr}`);
            }
            // Set target username hint for credential helper
            const usernameRes = await commandExecutor_1.CommandExecutor.execute('git', ['config', '--local', 'credential.username', profile.githubUsername], { cwd: repoPath });
            if (usernameRes.exitCode !== 0) {
                logger_1.Logger.warn(`Failed to set credential.username=${profile.githubUsername} at ${repoPath}: ${usernameRes.stderr}`);
            }
            logger_1.Logger.info(`Configured HTTPS GCM authentication for profile ${profile.githubUsername} at ${repoPath}`);
            return true;
        }
        catch (error) {
            logger_1.Logger.error(`Error configuring HTTPS authentication for ${profile.githubUsername}`, error);
            return false;
        }
    }
}
exports.HTTPSAuthStrategy = HTTPSAuthStrategy;
//# sourceMappingURL=HTTPSAuthStrategy.js.map