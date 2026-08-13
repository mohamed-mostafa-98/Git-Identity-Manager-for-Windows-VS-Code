import { CommandExecutor } from '../utils/commandExecutor';
import { AccountProfile } from '../models/AccountProfile';
import { Logger } from '../utils/logger';

export interface GitIdentity {
    name: string;
    email: string;
}

export class GitIdentityManager {
    /**
     * Gets local git identity for a repository root path.
     */
    public async getLocalIdentity(repoPath: string): Promise<GitIdentity | undefined> {
        try {
            const nameRes = await CommandExecutor.execute('git', ['config', '--local', 'user.name'], { cwd: repoPath });
            const emailRes = await CommandExecutor.execute('git', ['config', '--local', 'user.email'], { cwd: repoPath });

            if (nameRes.stdout && emailRes.stdout) {
                return {
                    name: nameRes.stdout,
                    email: emailRes.stdout
                };
            }
            return undefined;
        } catch (error) {
            Logger.error(`Error reading local git identity at ${repoPath}`, error);
            return undefined;
        }
    }

    /**
     * Configures local user.name and user.email for a repository without affecting global git config.
     */
    public async setLocalIdentity(repoPath: string, profile: AccountProfile): Promise<boolean> {
        try {
            const nameRes = await CommandExecutor.execute('git', ['config', '--local', 'user.name', profile.displayName], { cwd: repoPath });
            const emailRes = await CommandExecutor.execute('git', ['config', '--local', 'user.email', profile.githubEmail], { cwd: repoPath });

            if (nameRes.exitCode === 0 && emailRes.exitCode === 0) {
                Logger.info(`Updated repository local Git identity at ${repoPath}: ${profile.displayName} <${profile.githubEmail}>`);
                return true;
            } else {
                Logger.error(`Failed to set git config at ${repoPath}: ${nameRes.stderr} ${emailRes.stderr}`);
                return false;
            }
        } catch (error) {
            Logger.error(`Failed to update git identity for profile ${profile.displayName}`, error);
            return false;
        }
    }

    /**
     * Validates if local repo identity matches target profile identity.
     */
    public async isIdentityMatching(repoPath: string, profile: AccountProfile): Promise<boolean> {
        const local = await this.getLocalIdentity(repoPath);
        if (!local) return false;
        return (
            local.email.toLowerCase() === profile.githubEmail.toLowerCase()
        );
    }
}
