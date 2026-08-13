import * as vscode from 'vscode';
import { Logger } from '../utils/logger';

export class SecretStorageService {
    private secretStorage: vscode.SecretStorage;

    constructor(context: vscode.ExtensionContext) {
        this.secretStorage = context.secrets;
    }

    /**
     * Stores a secret token for a profile ID securely in OS-level vault.
     */
    public async storeToken(profileId: string, token: string): Promise<void> {
        try {
            await this.secretStorage.store(`github_token_${profileId}`, token);
            Logger.info(`Secret token securely stored for profile: ${profileId}`);
        } catch (error) {
            Logger.error(`Failed to store token for profile: ${profileId}`, error);
            throw new Error(`Failed to save credential for profile ${profileId}`);
        }
    }

    /**
     * Retrieves a stored token for a profile ID.
     */
    public async getToken(profileId: string): Promise<string | undefined> {
        try {
            return await this.secretStorage.get(`github_token_${profileId}`);
        } catch (error) {
            Logger.error(`Failed to retrieve secret token for profile: ${profileId}`, error);
            return undefined;
        }
    }

    /**
     * Removes a stored token for a profile ID.
     */
    public async deleteToken(profileId: string): Promise<void> {
        try {
            await this.secretStorage.delete(`github_token_${profileId}`);
            Logger.info(`Secret token deleted for profile: ${profileId}`);
        } catch (error) {
            Logger.error(`Failed to delete token for profile: ${profileId}`, error);
        }
    }
}
