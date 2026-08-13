"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfileManager = void 0;
const logger_1 = require("../utils/logger");
class ProfileManager {
    constructor(context, secretService) {
        this.globalState = context.globalState;
        this.secretService = secretService;
    }
    /**
     * Gets all saved account profiles metadata.
     */
    getProfiles() {
        return this.globalState.get(ProfileManager.PROFILES_KEY, []);
    }
    /**
     * Finds a profile by ID.
     */
    getProfileById(id) {
        return this.getProfiles().find(p => p.id === id);
    }
    /**
     * Finds a profile by GitHub username.
     */
    getProfileByUsername(username) {
        return this.getProfiles().find(p => p.githubUsername.toLowerCase() === username.toLowerCase());
    }
    /**
     * Adds or updates an account profile.
     */
    async saveProfile(profile, token) {
        const profiles = this.getProfiles();
        const existingIndex = profiles.findIndex(p => p.id === profile.id);
        if (existingIndex >= 0) {
            profiles[existingIndex] = {
                ...profile,
                updatedAt: new Date().toISOString()
            };
        }
        else {
            profiles.push({
                ...profile,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        }
        await this.globalState.update(ProfileManager.PROFILES_KEY, profiles);
        logger_1.Logger.info(`Saved account profile: ${profile.displayName} (@${profile.githubUsername})`);
        if (token) {
            await this.secretService.storeToken(profile.id, token);
        }
    }
    /**
     * Removes a profile by ID along with associated secret tokens.
     */
    async removeProfile(id) {
        let profiles = this.getProfiles();
        const target = profiles.find(p => p.id === id);
        if (!target)
            return;
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
        logger_1.Logger.info(`Removed profile ${target.displayName}`);
    }
    /**
     * Gets current active profile ID.
     */
    getActiveProfileId() {
        return this.globalState.get(ProfileManager.ACTIVE_PROFILE_KEY);
    }
    /**
     * Gets current active AccountProfile object.
     */
    getActiveProfile() {
        const id = this.getActiveProfileId();
        return id ? this.getProfileById(id) : undefined;
    }
    /**
     * Sets the active profile ID and updates lastUsedAt.
     */
    async setActiveProfile(id) {
        const profile = this.getProfileById(id);
        if (!profile) {
            throw new Error(`Profile with ID '${id}' not found.`);
        }
        await this.globalState.update(ProfileManager.ACTIVE_PROFILE_KEY, id);
        profile.lastUsedAt = new Date().toISOString();
        await this.saveProfile(profile);
        logger_1.Logger.info(`Active account profile switched to: ${profile.displayName} (@${profile.githubUsername})`);
        return profile;
    }
    /**
     * Repository mappings CRUD
     */
    getMappings() {
        return this.globalState.get(ProfileManager.MAPPINGS_KEY, []);
    }
    async saveMapping(profileId, pattern, isPathPattern) {
        const mappings = this.getMappings();
        const existingIndex = mappings.findIndex(m => m.pattern.toLowerCase() === pattern.toLowerCase());
        const newMapping = {
            id: `map_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            profileId,
            pattern,
            isPathPattern,
            createdAt: new Date().toISOString()
        };
        if (existingIndex >= 0) {
            mappings[existingIndex] = newMapping;
        }
        else {
            mappings.push(newMapping);
        }
        await this.globalState.update(ProfileManager.MAPPINGS_KEY, mappings);
        logger_1.Logger.info(`Mapped pattern '${pattern}' to profile ID '${profileId}'`);
        return newMapping;
    }
    async removeMapping(id) {
        let mappings = this.getMappings();
        mappings = mappings.filter(m => m.id !== id);
        await this.globalState.update(ProfileManager.MAPPINGS_KEY, mappings);
        logger_1.Logger.info(`Removed mapping ID '${id}'`);
    }
}
exports.ProfileManager = ProfileManager;
ProfileManager.PROFILES_KEY = 'github_account_profiles_v1';
ProfileManager.MAPPINGS_KEY = 'github_repository_mappings_v1';
ProfileManager.ACTIVE_PROFILE_KEY = 'github_active_profile_id_v1';
//# sourceMappingURL=ProfileManager.js.map