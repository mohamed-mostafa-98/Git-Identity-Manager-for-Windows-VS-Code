import * as vscode from 'vscode';
import { ProfileManager } from './ProfileManager';
import { RepositoryDetector, RepositoryDetails } from './RepositoryDetector';
import { RepositoryMapper } from './RepositoryMapper';
import { AccountProfile, PushGuardMode } from '../models/AccountProfile';
import { Logger } from '../utils/logger';

export class PushGuardService {
    private profileManager: ProfileManager;
    private repoDetector: RepositoryDetector;
    private repoMapper: RepositoryMapper;

    constructor(
        profileManager: ProfileManager,
        repoDetector: RepositoryDetector,
        repoMapper: RepositoryMapper,
        private applyProfile: (profileId: string) => Promise<void>
    ) {
        this.profileManager = profileManager;
        this.repoDetector = repoDetector;
        this.repoMapper = repoMapper;
    }

    /**
     * Inspects current workspace repository and active account profile.
     * Triggers warning if active account profile does not match expected profile for repository.
     * @returns true if safe to proceed, false if push should be blocked/cancelled.
     */
    public async validatePushSafety(repoPath: string): Promise<boolean> {
        const config = vscode.workspace.getConfiguration('githubAccountManager');
        const mode = config.get<PushGuardMode>('pushGuardMode', PushGuardMode.Warn);

        if (mode === PushGuardMode.Disabled) {
            return true;
        }

        const repoDetails = await this.repoDetector.detectRepository(repoPath);
        if (!repoDetails) return true; // Non-git workspace, allow

        const expectedProfile = this.repoMapper.resolveProfileForRepository(repoDetails);
        if (!expectedProfile) return true; // No profile mapping configured

        const activeProfile = this.profileManager.getActiveProfile();

        if (!activeProfile || activeProfile.id !== expectedProfile.id) {
            const activeName = activeProfile ? activeProfile.displayName : 'None';
            const expectedName = expectedProfile.displayName;

            Logger.warn(`Push Guard Mismatch! Active: ${activeName}, Expected: ${expectedName} for repo ${repoDetails.owner}/${repoDetails.repoName}`);

            const message = `⚠ GitHub Account Mismatch detected!\n\n` +
                `Repository (${repoDetails.owner}/${repoDetails.repoName}) expects account profile '${expectedName}', ` +
                `but current active profile is '${activeName}'.`;

            if (mode === PushGuardMode.Strict) {
                const choice = await vscode.window.showErrorMessage(
                    message,
                    { modal: true },
                    `Switch to ${expectedName}`,
                    'Cancel Push'
                );

                if (choice === `Switch to ${expectedName}`) {
                    await this.applyProfile(expectedProfile.id);
                    return true;
                }
                return false; // Block push
            } else {
                // Mode === Warn
                const choice = await vscode.window.showWarningMessage(
                    message,
                    `Switch to ${expectedName}`,
                    'Continue Anyway',
                    'Cancel Push'
                );

                if (choice === `Switch to ${expectedName}`) {
                    await this.applyProfile(expectedProfile.id);
                    return true;
                } else if (choice === 'Continue Anyway') {
                    return true;
                }
                return false;
            }
        }

        return true;
    }
}
