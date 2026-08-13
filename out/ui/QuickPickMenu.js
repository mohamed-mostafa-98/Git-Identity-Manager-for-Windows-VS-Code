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
exports.QuickPickMenu = void 0;
const vscode = __importStar(require("vscode"));
const AccountProfile_1 = require("../models/AccountProfile");
const BrowserAuthStrategy_1 = require("../services/BrowserAuthStrategy");
class QuickPickMenu {
    constructor(profileManager) {
        this.profileManager = profileManager;
        this.browserAuth = new BrowserAuthStrategy_1.BrowserAuthStrategy();
    }
    /**
     * Shows QuickPick menu for switching active account profile.
     */
    async showAccountSwitcher() {
        const profiles = this.profileManager.getProfiles();
        const activeId = this.profileManager.getActiveProfileId();
        if (profiles.length === 0) {
            const addChoice = await vscode.window.showInformationMessage('No GitHub Account Profiles configured yet.', 'Add Account Profile');
            if (addChoice === 'Add Account Profile') {
                vscode.commands.executeCommand('githubAccountManager.addAccount');
            }
            return undefined;
        }
        const items = profiles.map(p => ({
            label: `${p.id === activeId ? '$(check) ' : ''}${p.displayName}`,
            description: `@${p.githubUsername} (${p.authenticationMethod})`,
            detail: `Email: ${p.githubEmail}`,
            profileId: p.id
        }));
        items.push({
            label: '$(dashboard) Open Control Panel Dashboard...',
            description: 'Interactive UI for accounts, mappings, workspace identity & health',
            openDashboard: true
        });
        items.push({
            label: '$(add) Add New Account Profile...',
            description: 'Configure a new Personal, Work, or Client profile'
        });
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select GitHub Account Profile to activate',
            title: 'GitHub Account Switcher'
        });
        if (!selected)
            return undefined;
        if (selected.profileId) {
            return await this.profileManager.setActiveProfile(selected.profileId);
        }
        else if (selected.openDashboard) {
            vscode.commands.executeCommand('githubAccountManager.openDashboard');
            return undefined;
        }
        else {
            vscode.commands.executeCommand('githubAccountManager.addAccount');
            return undefined;
        }
    }
    /**
     * Guided wizard for adding a new account profile (Browser Login or Manual Setup).
     */
    async showAddAccountWizard() {
        const setupChoice = await vscode.window.showQuickPick([
            {
                label: '$(globe) Login via Browser (OAuth)',
                description: 'Open GitHub login in browser, authenticate, and auto-detect profile (Recommended)',
                isBrowser: true
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
        if (!setupChoice)
            return undefined;
        if (setupChoice.isBrowser) {
            return await this.addAccountViaBrowser();
        }
        else {
            return await this.addAccountManually();
        }
    }
    /**
     * Login through Browser OAuth flow.
     */
    async addAccountViaBrowser() {
        const userInfo = await this.browserAuth.loginViaBrowser();
        if (!userInfo)
            return undefined;
        const displayName = await vscode.window.showInputBox({
            title: 'Profile Name',
            prompt: `Authenticated as @${userInfo.username}. Enter a friendly profile name (e.g. Work, Personal, Client)`,
            value: userInfo.displayName || userInfo.username,
            validateInput: (val) => val.trim() ? null : 'Profile name cannot be empty.'
        });
        if (!displayName)
            return undefined;
        const newProfile = {
            id: `prof_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            displayName: displayName.trim(),
            githubUsername: userInfo.username,
            githubEmail: userInfo.email,
            authenticationMethod: AccountProfile_1.AuthenticationMethod.BROWSER_OAUTH,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        await this.profileManager.saveProfile(newProfile, userInfo.accessToken);
        await this.profileManager.setActiveProfile(newProfile.id);
        vscode.window.showInformationMessage(`✓ Authenticated via Browser! Profile '${newProfile.displayName}' (@${newProfile.githubUsername}) created.`);
        return newProfile;
    }
    /**
     * Manual setup wizard.
     */
    async addAccountManually() {
        // Step 1: Account Profile Name
        const displayName = await vscode.window.showInputBox({
            title: 'Add Account Profile (Step 1/4)',
            prompt: 'Enter a friendly display name for this account profile (e.g. Work, Personal, Client)',
            placeHolder: 'Work',
            validateInput: (value) => value.trim() ? null : 'Display name cannot be empty.'
        });
        if (!displayName)
            return undefined;
        // Step 2: GitHub Username
        const githubUsername = await vscode.window.showInputBox({
            title: 'Add Account Profile (Step 2/4)',
            prompt: 'Enter your GitHub Username for this account',
            placeHolder: 'mohammed-work',
            validateInput: (value) => value.trim() ? null : 'GitHub username cannot be empty.'
        });
        if (!githubUsername)
            return undefined;
        // Step 3: GitHub Email
        const githubEmail = await vscode.window.showInputBox({
            title: 'Add Account Profile (Step 3/4)',
            prompt: 'Enter the commit email address associated with this account',
            placeHolder: 'work@company.com',
            validateInput: (value) => value.includes('@') ? null : 'Please enter a valid email address.'
        });
        if (!githubEmail)
            return undefined;
        // Step 4: Authentication Method
        const authChoice = await vscode.window.showQuickPick([
            { label: 'Browser OAuth', description: 'Authenticate via Browser OAuth login', method: AccountProfile_1.AuthenticationMethod.BROWSER_OAUTH },
            { label: 'SSH', description: 'OpenSSH Host Aliasing (~/.ssh/config) (Recommended for multi-key SSH)', method: AccountProfile_1.AuthenticationMethod.SSH },
            { label: 'HTTPS', description: 'Git Credential Manager (credential.useHttpPath) (Recommended for Windows Vault)', method: AccountProfile_1.AuthenticationMethod.HTTPS },
            { label: 'GitHub CLI', description: 'Integrate with gh auth login / gh auth switch', method: AccountProfile_1.AuthenticationMethod.GITHUB_CLI }
        ], {
            title: 'Add Account Profile (Step 4/4)',
            placeHolder: 'Select Authentication Strategy'
        });
        if (!authChoice)
            return undefined;
        let sshAlias = undefined;
        let sshKeyPath = undefined;
        if (authChoice.method === AccountProfile_1.AuthenticationMethod.SSH) {
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
        const newProfile = {
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
        await this.profileManager.setActiveProfile(newProfile.id);
        vscode.window.showInformationMessage(`✓ Account profile '${newProfile.displayName}' added successfully!`);
        return newProfile;
    }
}
exports.QuickPickMenu = QuickPickMenu;
//# sourceMappingURL=QuickPickMenu.js.map