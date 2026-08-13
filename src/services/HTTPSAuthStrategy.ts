import { CommandExecutor } from '../utils/commandExecutor';
import { AccountProfile } from '../models/AccountProfile';
import { Logger } from '../utils/logger';

export class HTTPSAuthStrategy {
    /**
     * Configures Git Credential Manager (GCM) for HTTPS authentication.
     * Enforces credential.useHttpPath = true to isolate credentials in Windows Credential Vault by path/username.
     */
    public async configureHTTPSAuth(repoPath: string, profile: AccountProfile): Promise<boolean> {
        try {
            // Enable useHttpPath locally for this repo so GCM includes full path in target lookup
            const httpPathRes = await CommandExecutor.execute('git', ['config', '--local', 'credential.useHttpPath', 'true'], { cwd: repoPath });
            if (httpPathRes.exitCode !== 0) {
                Logger.warn(`Failed to set credential.useHttpPath=true at ${repoPath}: ${httpPathRes.stderr}`);
            }

            // Set target username hint for credential helper
            const usernameRes = await CommandExecutor.execute('git', ['config', '--local', 'credential.username', profile.githubUsername], { cwd: repoPath });
            if (usernameRes.exitCode !== 0) {
                Logger.warn(`Failed to set credential.username=${profile.githubUsername} at ${repoPath}: ${usernameRes.stderr}`);
            }

            Logger.info(`Configured HTTPS GCM authentication for profile ${profile.githubUsername} at ${repoPath}`);
            return true;
        } catch (error) {
            Logger.error(`Error configuring HTTPS authentication for ${profile.githubUsername}`, error);
            return false;
        }
    }
}
