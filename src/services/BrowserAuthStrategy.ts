import * as https from 'https';
import { Logger } from '../utils/logger';
import { isValidToken } from '../utils/token';

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
        const vscode: typeof import('vscode') = require('vscode');
        try {
            Logger.info('Triggering GitHub Browser OAuth authentication session...');

            const session = await vscode.authentication.getSession(
                'github',
                ['repo', 'user:email', 'read:user', 'workflow'],
                {
                    clearSessionPreference: true,
                    forceNewSession: { detail: 'Choose the GitHub account you want to add or reauthenticate.' }
                }
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

            throw new Error('Could not verify the GitHub account. Check your connection and try again.');
        } catch (error) {
            Logger.error('Browser authentication error', error);
            vscode.window.showErrorMessage(`Browser login failed: ${error instanceof Error ? error.message : String(error)}`);
            return undefined;
        }
    }

    /**
     * Queries GitHub API (https://api.github.com/user) for authenticated user profile details.
     */
    public async fetchGitHubUserProfile(token: string): Promise<{ username: string; email: string; displayName: string } | undefined> {
        if (!isValidToken(token)) return undefined;
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
                            if (typeof json.login !== 'string' || !/^[A-Za-z0-9-]+$/.test(json.login)) {
                                resolve(undefined);
                                return;
                            }
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
            req.setTimeout(15000, () => req.destroy(new Error('GitHub request timed out')));
            req.end();
        });
    }
}
