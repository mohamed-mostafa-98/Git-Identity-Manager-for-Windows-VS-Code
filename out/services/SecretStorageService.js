"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecretStorageService = void 0;
const logger_1 = require("../utils/logger");
class SecretStorageService {
    constructor(context) {
        this.secretStorage = context.secrets;
    }
    /**
     * Stores a secret token for a profile ID securely in OS-level vault.
     */
    async storeToken(profileId, token) {
        try {
            await this.secretStorage.store(`github_token_${profileId}`, token);
            logger_1.Logger.info(`Secret token securely stored for profile: ${profileId}`);
        }
        catch (error) {
            logger_1.Logger.error(`Failed to store token for profile: ${profileId}`, error);
            throw new Error(`Failed to save credential for profile ${profileId}`);
        }
    }
    /**
     * Retrieves a stored token for a profile ID.
     */
    async getToken(profileId) {
        try {
            return await this.secretStorage.get(`github_token_${profileId}`);
        }
        catch (error) {
            logger_1.Logger.error(`Failed to retrieve secret token for profile: ${profileId}`, error);
            return undefined;
        }
    }
    /**
     * Removes a stored token for a profile ID.
     */
    async deleteToken(profileId) {
        try {
            await this.secretStorage.delete(`github_token_${profileId}`);
            logger_1.Logger.info(`Secret token deleted for profile: ${profileId}`);
        }
        catch (error) {
            logger_1.Logger.error(`Failed to delete token for profile: ${profileId}`, error);
        }
    }
}
exports.SecretStorageService = SecretStorageService;
//# sourceMappingURL=SecretStorageService.js.map