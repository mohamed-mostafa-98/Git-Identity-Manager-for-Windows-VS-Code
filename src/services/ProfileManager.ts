import * as vscode from 'vscode';
import { AccountProfile, RepositoryMapping, AuthenticationMethod } from '../models/AccountProfile';
import { SecretStorageService } from './SecretStorageService';
import { Logger } from '../utils/logger';
import { BrowserAuthStrategy } from './BrowserAuthStrategy';

export class ProfileManager {
    private static readonly PROFILES_KEY = 'github_account_profiles_v1';
    private static readonly MAPPINGS_KEY = 'github_repository_mappings_v1';
    private static readonly ACTIVE_PROFILE_KEY = 'github_active_profile_id_v1';

    private globalState: vscode.Memento;
    private secretService: SecretStorageService;

    constructor(context: vscode.ExtensionContext, secretService: SecretStorageService) {
        this.globalState = context.globalState;
        this.secretService = secretService;
    }

    /**
     * Gets all saved account profiles metadata.
     */
    public getProfiles(): AccountProfile[] {
        return this.globalState.get<AccountProfile[]>(ProfileManager.PROFILES_KEY, []);
    }

    /**
     * Finds a profile by ID.
     */
    public getProfileById(id: string): AccountProfile | undefined {
        return this.getProfiles().find(p => p.id === id);
    }

    /**
     * Finds a profile by GitHub username.
     */
    public getProfileByUsername(username: string): AccountProfile | undefined {
        return this.getProfiles().find(p => p.githubUsername.toLowerCase() === username.toLowerCase());
    }

    /**
     * Adds or updates an account profile.
     */
    public async saveProfile(profile: AccountProfile, token?: string): Promise<void> {
        if (typeof profile.displayName !== 'string' || !profile.displayName.trim() ||
            typeof profile.githubEmail !== 'string' || !profile.githubEmail.includes('@') ||
            typeof profile.githubUsername !== 'string' || !/^[A-Za-z0-9-]+$/.test(profile.githubUsername) ||
            typeof profile.id !== 'string' || !/^[A-Za-z0-9_-]+$/.test(profile.id) ||
            !Object.values(AuthenticationMethod).includes(profile.authenticationMethod)) {
            throw new Error('Enter a valid profile name, GitHub username, email and authentication method.');
        }
        if ([profile.displayName, profile.githubEmail, profile.sshProfileHostAlias, profile.sshKeyPath].some(value =>
            value !== undefined && (typeof value !== 'string' || /[\r\n\0]/.test(value)))) {
            throw new Error('Profile fields cannot contain line breaks or control characters.');
        }
        const duplicate = this.getProfiles().find(p => p.id !== profile.id && p.githubUsername.toLowerCase() === profile.githubUsername.toLowerCase());
        if (duplicate) throw new Error(`GitHub account @${profile.githubUsername} is already saved as '${duplicate.displayName}'.`);
        if (token !== undefined) {
            const user = await new BrowserAuthStrategy().fetchGitHubUserProfile(token);
            if (!user || user.username.toLowerCase() !== profile.githubUsername.toLowerCase()) {
                throw new Error('Token verification failed. Check the connection, token validity and selected GitHub account.');
            }
            await this.secretService.storeToken(profile.id, token);
        }
        const profiles = this.getProfiles();
        const existingIndex = profiles.findIndex(p => p.id === profile.id);

        if (existingIndex >= 0) {
            profiles[existingIndex] = {
                ...profile,
                updatedAt: new Date().toISOString()
            };
        } else {
            profiles.push({
                ...profile,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        }

        await this.globalState.update(ProfileManager.PROFILES_KEY, profiles);
        Logger.info(`Saved account profile: ${profile.displayName} (@${profile.githubUsername})`);

    }

    /**
     * Removes a profile by ID along with associated secret tokens.
     */
    public async removeProfile(id: string): Promise<void> {
        let profiles = this.getProfiles();
        const target = profiles.find(p => p.id === id);
        if (!target) return;

        profiles = profiles.filter(p => p.id !== id);
        await this.globalState.update(ProfileManager.PROFILES_KEY, profiles);
        await this.secretService.deleteToken(id);

        // Remove mapping entries pointing to deleted profile
        let mappings = this.getMappings();
        mappings = mappings.filter(m => m.profileId !== id);
        await this.globalState.update(ProfileManager.MAPPINGS_KEY, mappings);

        if (this.getActiveProfileId() === id) {
            await this.globalState.update(ProfileManager.ACTIVE_PROFILE_KEY, undefined);
        }

        Logger.info(`Removed profile ${target.displayName}`);
    }

    /**
     * Gets current active profile ID.
     */
    public getActiveProfileId(): string | undefined {
        return this.globalState.get<string>(ProfileManager.ACTIVE_PROFILE_KEY);
    }

    /**
     * Gets current active AccountProfile object.
     */
    public getActiveProfile(): AccountProfile | undefined {
        const id = this.getActiveProfileId();
        return id ? this.getProfileById(id) : undefined;
    }

    /**
     * Sets the active profile ID and updates lastUsedAt.
     */
    public async setActiveProfile(id: string): Promise<AccountProfile | undefined> {
        const profile = this.getProfileById(id);
        if (!profile) {
            throw new Error(`Profile with ID '${id}' not found.`);
        }

        await this.globalState.update(ProfileManager.ACTIVE_PROFILE_KEY, id);
        profile.lastUsedAt = new Date().toISOString();
        await this.saveProfile(profile);

        Logger.info(`Active account profile switched to: ${profile.displayName} (@${profile.githubUsername})`);
        return profile;
    }

    /**
     * Repository mappings CRUD
     */
    public getMappings(): RepositoryMapping[] {
        return this.globalState.get<RepositoryMapping[]>(ProfileManager.MAPPINGS_KEY, []);
    }

    public async saveMapping(profileId: string, pattern: string, isPathPattern: boolean): Promise<RepositoryMapping> {
        if (!this.getProfileById(profileId) || typeof pattern !== 'string' || !pattern.trim() || typeof isPathPattern !== 'boolean') {
            throw new Error('Select an existing account and enter a repository path or pattern.');
        }
        pattern = pattern.trim();
        const mappings = this.getMappings();
        const existingIndex = mappings.findIndex(m => m.isPathPattern === isPathPattern && m.pattern.toLowerCase() === pattern.toLowerCase());

        const newMapping: RepositoryMapping = {
            id: `map_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            profileId,
            pattern,
            isPathPattern,
            createdAt: new Date().toISOString()
        };

        if (existingIndex >= 0) {
            mappings[existingIndex] = newMapping;
        } else {
            mappings.push(newMapping);
        }

        await this.globalState.update(ProfileManager.MAPPINGS_KEY, mappings);
        Logger.info(`Mapped pattern '${pattern}' to profile ID '${profileId}'`);
        return newMapping;
    }

    public async removeMapping(id: string): Promise<void> {
        let mappings = this.getMappings();
        mappings = mappings.filter(m => m.id !== id);
        await this.globalState.update(ProfileManager.MAPPINGS_KEY, mappings);
        Logger.info(`Removed mapping ID '${id}'`);
    }
}
