import { ProfileManager } from './ProfileManager';
import { AccountProfile, RepositoryMapping } from '../models/AccountProfile';
import { RepositoryDetails } from './RepositoryDetector';
import * as path from 'path';
import { Logger } from '../utils/logger';

export class RepositoryMapper {
    private profileManager: ProfileManager;

    constructor(profileManager: ProfileManager) {
        this.profileManager = profileManager;
    }

    /**
     * Finds the matching AccountProfile for a given repository.
     * Evaluates:
     * 1. Direct path mappings (e.g. C:\Projects\Work)
     * 2. Remote URL / Organization pattern mappings (e.g. github.com/company/* or owner name)
     * 3. Owner matching by GitHub username
     */
    public resolveProfileForRepository(repo: RepositoryDetails): AccountProfile | undefined {
        const mappings = this.profileManager.getMappings();
        const normalizedRepoPath = path.normalize(repo.rootPath).toLowerCase();

        // 1. Check direct folder path mappings
        for (const mapping of mappings) {
            if (mapping.isPathPattern) {
                const normalizedPattern = path.normalize(mapping.pattern).toLowerCase();
                if (normalizedRepoPath.startsWith(normalizedPattern)) {
                    const profile = this.profileManager.getProfileById(mapping.profileId);
                    if (profile) {
                        Logger.info(`Mapped repo path '${repo.rootPath}' to profile '${profile.displayName}' via path pattern '${mapping.pattern}'`);
                        return profile;
                    }
                }
            }
        }

        // 2. Check Remote URL / Org patterns (e.g. "github.com/company/*" or "company")
        const fullRepoSpec = `${repo.hostname}/${repo.owner}/${repo.repoName}`.toLowerCase();
        for (const mapping of mappings) {
            if (!mapping.isPathPattern) {
                const pattern = mapping.pattern.toLowerCase().trim();
                if (
                    fullRepoSpec.includes(pattern) ||
                    repo.owner.toLowerCase() === pattern ||
                    pattern === `${repo.hostname}/${repo.owner}`.toLowerCase()
                ) {
                    const profile = this.profileManager.getProfileById(mapping.profileId);
                    if (profile) {
                        Logger.info(`Mapped repo remote '${repo.remoteUrl}' to profile '${profile.displayName}' via URL pattern '${mapping.pattern}'`);
                        return profile;
                    }
                }
            }
        }

        // 3. Fallback: Check if repository owner matches a profile's githubUsername directly
        const profiles = this.profileManager.getProfiles();
        const usernameMatch = profiles.find(p => p.githubUsername.toLowerCase() === repo.owner.toLowerCase());
        if (usernameMatch) {
            Logger.info(`Automatically matched repo owner '${repo.owner}' to profile '${usernameMatch.displayName}'`);
            return usernameMatch;
        }

        return undefined;
    }
}
