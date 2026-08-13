import * as vscode from 'vscode';
import * as https from 'https';
import { AccountProfile, AuthenticationMethod } from '../models/AccountProfile';
import { Logger } from '../utils/logger';
import { CommandExecutor } from '../utils/commandExecutor';

export interface GitHubUserInfo {
    username: string;
    email: string;
    displayName: string;
    accessToken: string;
}

export class BrowserAuthStrategy {
    /**
     * Triggers GitHub OAuth login via browser.
     * Uses VS Code's authentication provider to open the browser, authenticate user, and acquire OAuth token.
     */
    public async loginViaBrowser(): Promise<GitHubUserInfo | undefined> {
        try {
            Logger.info('Triggering GitHub Browser OAuth authentication session...');

            const session = await vscode.authentication.getSession(
                'github',
                ['repo', 'user:email', 'read:user', 'workflow'],
                { createIfNone: true }
            );

            if (!session) {
                Logger.warn('Browser authentication cancelled or failed: No session returned.');
                return undefined;
            }

            Logger.info(`Browser authentication successful for user session: ${session.account.label}`);

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
        } catch (error) {
            Logger.error('Browser authentication error', error);
            vscode.window.showErrorMessage(`Browser login failed: ${error instanceof Error ? error.message : String(error)}`);
            return undefined;
        }
    }

    /**
     * Configures Git Credential Manager (GCM) for a browser-authenticated profile.
     */
    public async configureBrowserAuth(repoPath: string, profile: AccountProfile): Promise<boolean> {
        try {
            // Enable useHttpPath locally for this repo
            await CommandExecutor.execute('git', ['config', '--local', 'credential.useHttpPath', 'true'], { cwd: repoPath });
            await CommandExecutor.execute('git', ['config', '--local', 'credential.username', profile.githubUsername], { cwd: repoPath });

            Logger.info(`Configured Browser Auth (GCM HttpPath) for ${profile.githubUsername} at ${repoPath}`);
            return true;
        } catch (error) {
            Logger.error(`Error configuring Browser Auth for profile ${profile.githubUsername}`, error);
            return false;
        }
    }

    /**
     * Queries GitHub API (https://api.github.com/user) for authenticated user profile details.
     */
    private async fetchGitHubUserProfile(token: string): Promise<{ username: string; email: string; displayName: string } | undefined> {
        return new Promise((resolve) => {
            const options: https.RequestOptions = {
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
                        } catch (e) {
                            resolve(undefined);
                        }
                    } else {
                        resolve(undefined);
                    }
                });
            });

            req.on('error', () => resolve(undefined));
            req.end();
        });
    }
}
