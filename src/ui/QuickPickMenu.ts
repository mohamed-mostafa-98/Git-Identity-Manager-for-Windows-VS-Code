import * as vscode from 'vscode';
import { ProfileManager } from '../services/ProfileManager';
import { AccountProfile, AuthenticationMethod } from '../models/AccountProfile';
import { BrowserAuthStrategy } from '../services/BrowserAuthStrategy';
import { Logger } from '../utils/logger';
import { isValidToken } from '../utils/token';

export class QuickPickMenu {
    private browserAuth: BrowserAuthStrategy;

    constructor(private profileManager: ProfileManager) {
        this.browserAuth = new BrowserAuthStrategy();
    }

    /**
     * Shows QuickPick menu for switching active account profile.
     */
    public async showAccountSwitcher(): Promise<AccountProfile | undefined> {
        const profiles = this.profileManager.getProfiles();
        const activeId = this.profileManager.getActiveProfileId();

        if (profiles.length === 0) {
            const addChoice = await vscode.window.showInformationMessage(
                'No GitHub Account Profiles configured yet.',
                'Add Account Profile'
            );
            if (addChoice === 'Add Account Profile') {
                vscode.commands.executeCommand('githubAccountManager.addAccount');
            }
            return undefined;
        }

        const items: (vscode.QuickPickItem & { profileId?: string })[] = profiles.map(p => ({
            label: `${p.id === activeId ? '$(check) ' : ''}${p.displayName}`,
            description: `@${p.githubUsername} (${p.authenticationMethod})`,
            detail: `Email: ${p.githubEmail}`,
            profileId: p.id
        }));

        items.push({
            label: '$(dashboard) Open Control Panel Dashboard...',
            description: 'Interactive UI for accounts, mappings, workspace identity & health',
            openDashboard: true
        } as any);

        items.push({
            label: '$(add) Add New Account Profile...',
            description: 'Configure a new Personal, Work, or Client profile'
        });

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select GitHub Account Profile to activate',
            title: 'GitHub Account Switcher'
        });

        if (!selected) return undefined;

        if (selected.profileId) {
            return this.profileManager.getProfileById(selected.profileId);
        } else if ((selected as any).openDashboard) {
            vscode.commands.executeCommand('githubAccountManager.openDashboard');
            return undefined;
        } else {
            vscode.commands.executeCommand('githubAccountManager.addAccount');
            return undefined;
        }
    }

    /**
     * Guided wizard for adding a new account profile (Browser Login or Manual Setup).
     */
    public async showAddAccountWizard(): Promise<AccountProfile | undefined> {
        const setupChoice = await vscode.window.showQuickPick([
            {
                label: '$(globe) Login via Browser (OAuth)',
                description: 'Open GitHub login in browser, authenticate, and auto-detect profile (Recommended)',
                isBrowser: true
            },
            {
                label: '$(key) Personal Access Token',
                description: 'Save a GitHub token securely for repeated Git operations',
                isBrowser: false,
                isToken: true
            },
            {
                label: '$(settings-gear) Manual Profile Setup',
                description: 'Manually configure username, email, and SSH/HTTPS auth details',
                isBrowser: false
            }
        ], {
            title: 'Add Account Profile',
            placeHolder: 'Select how you want to authenticate your GitHub account'
        });

        if (!setupChoice) return undefined;

        if ('isToken' in setupChoice && setupChoice.isToken) {
            return this.addAccountViaToken();
        } else if (setupChoice.isBrowser) {
            return await this.addAccountViaBrowser();
        } else {
            return await this.addAccountManually();
        }
    }

    public async saveToken(profileId?: string): Promise<AccountProfile | undefined> {
        const profiles = this.profileManager.getProfiles().filter(p =>
            p.authenticationMethod === AuthenticationMethod.HTTPS || p.authenticationMethod === AuthenticationMethod.BROWSER_OAUTH);
        const selected = profileId ? profiles.find(p => p.id === profileId) :
            (await vscode.window.showQuickPick(profiles.map(profile => ({
                label: profile.displayName, description: `@${profile.githubUsername}`, profile
            })), { title: 'Account to update token for' }))?.profile;
        if (!selected) {
            if (!profiles.length) vscode.window.showInformationMessage('Add an HTTPS account first using GitHub: Add Account Profile.');
            return undefined;
        }
        const token = await this.promptToken();
        if (!token) return undefined;
        await this.profileManager.saveProfile(selected, token);
        vscode.window.showInformationMessage(`Token saved securely for @${selected.githubUsername}.`);
        return selected;
    }

    private async promptToken(): Promise<string | undefined> {
        const token = await vscode.window.showInputBox({
            title: 'GitHub Personal Access Token', password: true, ignoreFocusOut: true,
            prompt: 'Paste a token belonging to this account with access to your repositories. Stored in secure credential storage.',
            validateInput: value => isValidToken(value.trim()) ? null : 'Enter a token without spaces or line breaks.'
        });
        return token?.trim() || undefined;
    }

    private async addAccountViaToken(): Promise<AccountProfile | undefined> {
        const token = await this.promptToken();
        if (!token) return undefined;
        const user = await this.browserAuth.fetchGitHubUserProfile(token);
        if (!user) throw new Error('Could not verify the token. Check its validity and your connection.');
        const displayName = await vscode.window.showInputBox({
            title: `Profile for @${user.username}`, prompt: 'Name this account (Personal, Work, Client)',
            value: user.displayName || user.username
        });
        if (!displayName?.trim()) return undefined;
        const email = await vscode.window.showInputBox({
            title: 'Git commit email', value: user.email || `${user.username}@users.noreply.github.com`,
            validateInput: value => value.includes('@') ? null : 'Enter your Git commit email.'
        });
        if (!email) return undefined;
        const profile: AccountProfile = {
            id: `prof_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            displayName: displayName.trim(), githubUsername: user.username, githubEmail: email.trim(),
            authenticationMethod: AuthenticationMethod.HTTPS,
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
        };
        await this.profileManager.saveProfile(profile, token);
        return profile;
    }

    /**
     * Login through Browser OAuth flow.
     */
    public async addAccountViaBrowser(): Promise<AccountProfile | undefined> {
        const userInfo = await this.browserAuth.loginViaBrowser();
        if (!userInfo) return undefined;

        const displayName = await vscode.window.showInputBox({
            title: 'Profile Name',
            prompt: `Authenticated as @${userInfo.username}. Enter a friendly profile name (e.g. Work, Personal, Client)`,
            value: userInfo.displayName || userInfo.username,
            validateInput: (val) => val.trim() ? null : 'Profile name cannot be empty.'
        });

        if (!displayName) return undefined;

        const existing = this.profileManager.getProfileByUsername(userInfo.username);
        const newProfile: AccountProfile = {
            id: existing?.id || `prof_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            displayName: displayName.trim(),
            githubUsername: userInfo.username,
            githubEmail: userInfo.email,
            authenticationMethod: AuthenticationMethod.BROWSER_OAUTH,
            createdAt: existing?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await this.profileManager.saveProfile(newProfile, userInfo.accessToken);

        vscode.window.showInformationMessage(`✓ Authenticated via Browser! Profile '${newProfile.displayName}' (@${newProfile.githubUsername}) created.`);
        return newProfile;
    }

    /** Replaces OAuth for one existing profile without changing its ID or mappings. */
    public async reauthenticate(profileId: string): Promise<AccountProfile | undefined> {
        const profile = this.profileManager.getProfileById(profileId);
        if (!profile || profile.authenticationMethod !== AuthenticationMethod.BROWSER_OAUTH) {
            throw new Error('Choose an existing browser-login account.');
        }
        const user = await this.browserAuth.loginViaBrowser();
        if (!user) return undefined;
        let githubUsername = profile.githubUsername;
        if (user.username.toLowerCase() !== profile.githubUsername.toLowerCase()) {
            const other = this.profileManager.getProfileByUsername(user.username);
            if (other && other.id !== profile.id) {
                throw new Error(`Signed in as @${user.username}, which already belongs to '${other.displayName}'. Sign out of that GitHub browser session and retry @${profile.githubUsername}, or use the existing profile.`);
            }
            const choice = await vscode.window.showWarningMessage(
                `This profile says @${profile.githubUsername}, but GitHub verified @${user.username}. Update this profile to the verified username? Its project mappings will be preserved.`,
                { modal: true }, 'Update Profile'
            );
            if (choice !== 'Update Profile') return undefined;
            githubUsername = user.username;
        }
        const updated = { ...profile, githubUsername, githubEmail: user.email || profile.githubEmail, updatedAt: new Date().toISOString() };
        await this.profileManager.saveProfile(updated, user.accessToken);
        vscode.window.showInformationMessage(`Reauthenticated '${profile.displayName}' as @${githubUsername}. Project mappings were preserved.`);
        return updated;
    }

    /**
     * Manual setup wizard.
     */
    private async addAccountManually(): Promise<AccountProfile | undefined> {
        // Step 1: Account Profile Name
        const displayName = await vscode.window.showInputBox({
            title: 'Add Account Profile (Step 1/4)',
            prompt: 'Enter a friendly display name for this account profile (e.g. Work, Personal, Client)',
            placeHolder: 'Work',
            validateInput: (value) => value.trim() ? null : 'Display name cannot be empty.'
        });

        if (!displayName) return undefined;

        // Step 2: GitHub Username
        const githubUsername = await vscode.window.showInputBox({
            title: 'Add Account Profile (Step 2/4)',
            prompt: 'Enter your GitHub Username for this account',
            placeHolder: 'mohammed-work',
            validateInput: (value) => value.trim() ? null : 'GitHub username cannot be empty.'
        });

        if (!githubUsername) return undefined;

        // Step 3: GitHub Email
        const githubEmail = await vscode.window.showInputBox({
            title: 'Add Account Profile (Step 3/4)',
            prompt: 'Enter the commit email address associated with this account',
            placeHolder: 'work@company.com',
            validateInput: (value) => value.includes('@') ? null : 'Please enter a valid email address.'
        });

        if (!githubEmail) return undefined;

        // Step 4: Authentication Method
        const authChoice = await vscode.window.showQuickPick([
            { label: 'Browser OAuth', description: 'Authenticate via Browser OAuth login', method: AuthenticationMethod.BROWSER_OAUTH },
            { label: 'SSH', description: 'OpenSSH Host Aliasing (~/.ssh/config) (Recommended for multi-key SSH)', method: AuthenticationMethod.SSH },
            { label: 'HTTPS', description: 'Git Credential Manager (credential.useHttpPath) (Recommended for Windows Vault)', method: AuthenticationMethod.HTTPS },
            { label: 'GitHub CLI', description: 'Integrate with gh auth login / gh auth switch', method: AuthenticationMethod.GITHUB_CLI }
        ], {
            title: 'Add Account Profile (Step 4/4)',
            placeHolder: 'Select Authentication Strategy'
        });

        if (!authChoice) return undefined;

        let sshAlias: string | undefined = undefined;
        let sshKeyPath: string | undefined = undefined;

        if (authChoice.method === AuthenticationMethod.SSH) {
            sshAlias = await vscode.window.showInputBox({
                title: 'SSH Configuration',
                prompt: 'Enter OpenSSH Host Alias (or press Enter to use default)',
                value: `github.com-${githubUsername.toLowerCase()}`
            });

            sshKeyPath = await vscode.window.showInputBox({
                title: 'SSH Key Location',
                prompt: 'Enter SSH Private Key path (or press Enter for default location)',
                placeHolder: `~/.ssh/id_ed25519_${githubUsername.toLowerCase()}`
            });
        }

        const newProfile: AccountProfile = {
            id: `prof_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            displayName: displayName.trim(),
            githubUsername: githubUsername.trim(),
            githubEmail: githubEmail.trim(),
            authenticationMethod: authChoice.method,
            sshProfileHostAlias: sshAlias,
            sshKeyPath,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await this.profileManager.saveProfile(newProfile);

        vscode.window.showInformationMessage(`✓ Account profile '${newProfile.displayName}' added successfully!`);
        return newProfile;
    }
}
