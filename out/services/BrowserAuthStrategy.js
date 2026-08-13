"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserAuthStrategy = void 0;
const vscode = __importStar(require("vscode"));
const https = __importStar(require("https"));
const logger_1 = require("../utils/logger");
const commandExecutor_1 = require("../utils/commandExecutor");
class BrowserAuthStrategy {
    /**
     * Triggers GitHub OAuth login via browser.
     * Uses VS Code's authentication provider to open the browser, authenticate user, and acquire OAuth token.
     */
    async loginViaBrowser() {
        try {
            logger_1.Logger.info('Triggering GitHub Browser OAuth authentication session...');
            const session = await vscode.authentication.getSession('github', ['repo', 'user:email', 'read:user', 'workflow'], { createIfNone: true });
            if (!session) {
                logger_1.Logger.warn('Browser authentication cancelled or failed: No session returned.');
                return undefined;
            }
            logger_1.Logger.info(`Browser authentication successful for user session: ${session.account.label}`);
            // Fetch detailed user profile from GitHub API using acquired access token
            const userInfo = await this.fetchGitHubUserProfile(session.accessToken);
            if (userInfo) {
                return {
                    username: userInfo.username,
                    email: userInfo.email || `${userInfo.username}@users.noreply.github.com`,
                    displayName: userInfo.displayName || userInfo.username,
                    accessToken: session.accessToken
                };
            }
            // Fallback to session account label if API call fails
            return {
                username: session.account.label,
                email: `${session.account.label}@users.noreply.github.com`,
                displayName: session.account.label,
                accessToken: session.accessToken
            };
        }
        catch (error) {
            logger_1.Logger.error('Browser authentication error', error);
            vscode.window.showErrorMessage(`Browser login failed: ${error instanceof Error ? error.message : String(error)}`);
            return undefined;
        }
    }
    /**
     * Configures Git Credential Manager (GCM) for a browser-authenticated profile.
     */
    async configureBrowserAuth(repoPath, profile) {
        try {
            // Enable useHttpPath locally for this repo
            await commandExecutor_1.CommandExecutor.execute('git', ['config', '--local', 'credential.useHttpPath', 'true'], { cwd: repoPath });
            await commandExecutor_1.CommandExecutor.execute('git', ['config', '--local', 'credential.username', profile.githubUsername], { cwd: repoPath });
            logger_1.Logger.info(`Configured Browser Auth (GCM HttpPath) for ${profile.githubUsername} at ${repoPath}`);
            return true;
        }
        catch (error) {
            logger_1.Logger.error(`Error configuring Browser Auth for profile ${profile.githubUsername}`, error);
            return false;
        }
    }
    /**
     * Queries GitHub API (https://api.github.com/user) for authenticated user profile details.
     */
    async fetchGitHubUserProfile(token) {
        return new Promise((resolve) => {
            const options = {
                hostname: 'api.github.com',
                path: '/user',
                method: 'GET',
                headers: {
                    'User-Agent': 'VSCode-GitHub-Account-Manager',
                    'Authorization': `token ${token}`,
                    'Accept': 'application/json'
                }
            };
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        try {
                            const json = JSON.parse(data);
                            resolve({
                                username: json.login,
                                email: json.email || '',
                                displayName: json.name || json.login
                            });
                        }
                        catch (e) {
                            resolve(undefined);
                        }
                    }
                    else {
                        resolve(undefined);
                    }
                });
            });
            req.on('error', () => resolve(undefined));
            req.end();
        });
    }
}
exports.BrowserAuthStrategy = BrowserAuthStrategy;
//# sourceMappingURL=BrowserAuthStrategy.js.map