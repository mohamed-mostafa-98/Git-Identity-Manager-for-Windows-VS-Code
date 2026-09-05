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
exports.deactivate = exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const ProfileManager_1 = require("./services/ProfileManager");
const SecretStorageService_1 = require("./services/SecretStorageService");
const RepositoryDetector_1 = require("./services/RepositoryDetector");
const RepositoryMapper_1 = require("./services/RepositoryMapper");
const GitIdentityManager_1 = require("./services/GitIdentityManager");
const HTTPSAuthStrategy_1 = require("./services/HTTPSAuthStrategy");
const SSHAuthStrategy_1 = require("./services/SSHAuthStrategy");
const GitHubCliStrategy_1 = require("./services/GitHubCliStrategy");
const PushGuardService_1 = require("./services/PushGuardService");
const DiagnosticsService_1 = require("./services/DiagnosticsService");
const StatusBarController_1 = require("./ui/StatusBarController");
const AccountTreeDataProvider_1 = require("./ui/AccountTreeDataProvider");
const QuickPickMenu_1 = require("./ui/QuickPickMenu");
const DashboardWebview_1 = require("./ui/DashboardWebview");
const logger_1 = require("./utils/logger");
const AccountProfile_1 = require("./models/AccountProfile");
const TokenHealthService_1 = require("./services/TokenHealthService");
const DesktopBridge_1 = require("./services/DesktopBridge");
let statusBarController;
async function activate(context) {
    logger_1.Logger.initialize('GitHub Account Manager');
    logger_1.Logger.info('Initializing GitHub Account & Git Identity Manager extension...');
    // Core Services
    const secretService = new SecretStorageService_1.SecretStorageService(context);
    const profileManager = new ProfileManager_1.ProfileManager(context, secretService);
    const repoDetector = new RepositoryDetector_1.RepositoryDetector();
    const repoMapper = new RepositoryMapper_1.RepositoryMapper(profileManager);
    const gitIdentityManager = new GitIdentityManager_1.GitIdentityManager();
    const httpsAuthStrategy = new HTTPSAuthStrategy_1.HTTPSAuthStrategy();
    const sshAuthStrategy = new SSHAuthStrategy_1.SSHAuthStrategy();
    const ghCliStrategy = new GitHubCliStrategy_1.GitHubCliStrategy();
    const diagnosticsService = new DiagnosticsService_1.DiagnosticsService(profileManager, repoDetector, ghCliStrategy);
    // UI Controllers & Tree Views
    statusBarController = new StatusBarController_1.StatusBarController(profileManager);
    context.subscriptions.push(statusBarController);
    const quickPickMenu = new QuickPickMenu_1.QuickPickMenu(profileManager);
    const profilesTreeProvider = new AccountTreeDataProvider_1.AccountProfilesTreeProvider(profileManager);
    const mappingsTreeProvider = new AccountTreeDataProvider_1.RepoMappingsTreeProvider(profileManager);
    vscode.window.registerTreeDataProvider('githubAccountProfilesTree', profilesTreeProvider);
    vscode.window.registerTreeDataProvider('githubRepoMappingsTree', mappingsTreeProvider);
    const refreshUI = () => {
        statusBarController?.update();
        profilesTreeProvider.refresh();
        mappingsTreeProvider.refresh();
        DashboardWebview_1.DashboardWebview.refresh();
    };
    /**
     * Automatic account profile application for open workspace repository.
     */
    const applyWorkspaceProfile = async (profileId) => {
        if (!vscode.workspace.isTrusted)
            throw new Error('Trust this workspace before applying account credentials.');
        if (!vscode.workspace.workspaceFolders?.length) {
            if (profileId)
                await profileManager.setActiveProfile(profileId);
            refreshUI();
            return;
        }
        const rootFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
        const repo = await repoDetector.detectRepository(rootFolder);
        if (!repo) {
            throw new Error('Open a Git repository with a remote before assigning an account.');
        }
        const mappedProfile = profileId ? profileManager.getProfileById(profileId) : repoMapper.resolveProfileForRepository(repo);
        if (profileId && !mappedProfile)
            throw new Error('The selected account no longer exists.');
        if (mappedProfile) {
            // Apply Authentication Strategy
            let authenticated = false;
            if (mappedProfile.authenticationMethod === AccountProfile_1.AuthenticationMethod.BROWSER_OAUTH || mappedProfile.authenticationMethod === AccountProfile_1.AuthenticationMethod.HTTPS) {
                const token = await secretService.getToken(mappedProfile.id);
                authenticated = await httpsAuthStrategy.configureHTTPSAuth(repo.rootPath, mappedProfile, repo.remoteUrl, token);
            }
            else if (mappedProfile.authenticationMethod === AccountProfile_1.AuthenticationMethod.SSH) {
                const hostAlias = await sshAuthStrategy.ensureSSHHostAlias(mappedProfile);
                authenticated = await sshAuthStrategy.bindRepoRemoteToHostAlias(repo.rootPath, hostAlias);
            }
            else if (mappedProfile.authenticationMethod === AccountProfile_1.AuthenticationMethod.GITHUB_CLI) {
                authenticated = await ghCliStrategy.switchAccount(mappedProfile.githubUsername);
            }
            if (!authenticated)
                throw new Error('Authentication setup failed. The account assignment was not changed.');
            if (!await gitIdentityManager.setLocalIdentity(repo.rootPath, mappedProfile)) {
                throw new Error('Authentication was configured, but Git identity could not be updated. Retry before committing.');
            }
            if (profileId)
                await profileManager.saveMapping(mappedProfile.id, repo.rootPath, true);
            await profileManager.setActiveProfile(mappedProfile.id);
            refreshUI();
        }
    };
    // ponytail: serialize changes in this window; use per-repository queues for multi-root support.
    let syncQueue = Promise.resolve();
    const syncWorkspaceProfile = (profileId) => {
        const result = syncQueue.then(() => applyWorkspaceProfile(profileId));
        syncQueue = result.catch(() => { });
        return result;
    };
    const showFailure = (error) => {
        const message = error instanceof Error ? error.message : 'Account operation failed. Please retry.';
        vscode.window.showErrorMessage(message);
    };
    const autoSync = async () => {
        if (!vscode.workspace.isTrusted || !vscode.workspace.getConfiguration('githubAccountManager').get('autoSwitchOnWorkspaceOpen', true))
            return;
        try {
            await syncWorkspaceProfile();
        }
        catch (error) {
            showFailure(error);
        }
    };
    const pushGuardService = new PushGuardService_1.PushGuardService(profileManager, repoDetector, repoMapper, syncWorkspaceProfile);
    // Run workspace sync on activation
    void autoSync();
    // Listen to workspace folder changes
    context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(() => autoSync()));
    // Register Commands
    context.subscriptions.push(vscode.commands.registerCommand('githubAccountManager.openDashboard', () => {
        DashboardWebview_1.DashboardWebview.createOrShow(context.extensionUri, profileManager, repoDetector, repoMapper, gitIdentityManager, diagnosticsService, syncWorkspaceProfile);
    }), vscode.commands.registerCommand('githubAccountManager.removeMapping', async (item) => {
        const targetId = item?.mapping?.id;
        if (!targetId)
            return;
        const confirm = await vscode.window.showWarningMessage(`Remove mapping rule '${item.mapping.pattern}'?`, { modal: true }, 'Remove');
        if (confirm === 'Remove') {
            await profileManager.removeMapping(targetId);
            await syncWorkspaceProfile();
            refreshUI();
            vscode.window.showInformationMessage(`Removed repository mapping rule.`);
        }
    }), vscode.commands.registerCommand('githubAccountManager.switchAccount', async (item) => {
        try {
            const switched = item?.profile ? profileManager.getProfileById(item.profile.id) : await quickPickMenu.showAccountSwitcher();
            if (switched) {
                await syncWorkspaceProfile(switched.id);
                refreshUI();
                vscode.window.showInformationMessage(`Active GitHub Account: ${switched.displayName} (@${switched.githubUsername})`);
            }
        }
        catch (error) {
            showFailure(error);
        }
    }), vscode.commands.registerCommand('githubAccountManager.addAccount', async () => {
        try {
            const added = await quickPickMenu.showAddAccountWizard();
            if (added) {
                refreshUI();
                vscode.window.showInformationMessage('Account saved. Use GitHub: Map Project to Account to assign a repository.');
            }
        }
        catch (error) {
            showFailure(error);
        }
    }), vscode.commands.registerCommand('githubAccountManager.saveToken', async (profileId) => {
        try {
            if (!vscode.workspace.isTrusted)
                throw new Error('Trust this workspace before saving authentication.');
            const saved = await quickPickMenu.saveToken(profileId);
            const folder = vscode.workspace.workspaceFolders?.[0];
            const repository = saved && folder ? await repoDetector.detectRepository(folder.uri.fsPath) : undefined;
            if (repository && repoMapper.resolveProfileForRepository(repository)?.id === saved?.id)
                await syncWorkspaceProfile();
        }
        catch (error) {
            showFailure(error);
        }
    }), vscode.commands.registerCommand('githubAccountManager.reauthenticate', async (profileId) => {
        try {
            if (!profileId) {
                const selected = await vscode.window.showQuickPick(profileManager.getProfiles()
                    .filter(profile => profile.authenticationMethod === AccountProfile_1.AuthenticationMethod.BROWSER_OAUTH)
                    .map(profile => ({ label: profile.displayName, description: `@${profile.githubUsername}`, id: profile.id })), { title: 'Reauthenticate Browser Account', placeHolder: 'Choose the saved account to repair' });
                profileId = selected?.id;
            }
            if (!profileId)
                return;
            const saved = await quickPickMenu.reauthenticate(profileId);
            const folder = vscode.workspace.workspaceFolders?.[0];
            const repository = saved && folder ? await repoDetector.detectRepository(folder.uri.fsPath) : undefined;
            if (repository && repoMapper.resolveProfileForRepository(repository)?.id === saved?.id)
                await syncWorkspaceProfile();
            refreshUI();
        }
        catch (error) {
            showFailure(error);
        }
    }), vscode.commands.registerCommand('githubAccountManager.removeAccount', async (item) => {
        const targetId = item?.profile?.id || profileManager.getActiveProfileId();
        if (!targetId)
            return;
        const profile = profileManager.getProfileById(targetId);
        if (!profile)
            return;
        const confirm = await vscode.window.showWarningMessage(`Are you sure you want to remove account profile '${profile.displayName}'?`, { modal: true }, 'Remove');
        if (confirm === 'Remove') {
            await profileManager.removeProfile(targetId);
            refreshUI();
            vscode.window.showInformationMessage(`Removed account profile: ${profile.displayName}`);
        }
    }), vscode.commands.registerCommand('githubAccountManager.currentAccount', () => {
        const active = profileManager.getActiveProfile();
        if (active) {
            vscode.window.showInformationMessage(`Active Account: ${active.displayName} (@${active.githubUsername}) | Email: ${active.githubEmail}`);
        }
        else {
            vscode.window.showWarningMessage('No active GitHub account profile selected.');
        }
    }), vscode.commands.registerCommand('githubAccountManager.mapProject', async () => {
        const profiles = profileManager.getProfiles();
        if (profiles.length === 0) {
            vscode.window.showWarningMessage('Please add an account profile before mapping projects.');
            return;
        }
        const profileItems = profiles.map(p => ({
            label: p.displayName,
            description: `@${p.githubUsername}`,
            id: p.id
        }));
        const selectedProfile = await vscode.window.showQuickPick(profileItems, {
            title: 'Select Account Profile for Project Mapping'
        });
        if (!selectedProfile)
            return;
        const patternType = await vscode.window.showQuickPick([
            { label: 'Current Workspace Folder', isPath: true },
            { label: 'Remote Organization / Owner Pattern', isPath: false }
        ], { title: 'Mapping Type' });
        if (!patternType)
            return;
        let pattern = undefined;
        if (patternType.isPath) {
            if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                pattern = vscode.workspace.workspaceFolders[0].uri.fsPath;
            }
            else {
                pattern = await vscode.window.showInputBox({ prompt: 'Enter folder path to map' });
            }
        }
        else {
            pattern = await vscode.window.showInputBox({
                prompt: 'Enter Remote Organization or Repo pattern (e.g. "company" or "github.com/company/*")',
                placeHolder: 'company'
            });
        }
        if (pattern) {
            await profileManager.saveMapping(selectedProfile.id, pattern, patternType.isPath);
            await syncWorkspaceProfile();
            refreshUI();
            vscode.window.showInformationMessage(`✓ Mapped '${pattern}' to profile '${selectedProfile.label}'`);
        }
    }), vscode.commands.registerCommand('githubAccountManager.repositoryStatus', async () => {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            vscode.window.showInformationMessage('No active workspace open.');
            return;
        }
        const repoPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        const repo = await repoDetector.detectRepository(repoPath);
        if (!repo) {
            vscode.window.showInformationMessage('Workspace is not a Git repository or has no remote origin.');
            return;
        }
        const mapped = repoMapper.resolveProfileForRepository(repo);
        const active = profileManager.getActiveProfile();
        const localIdentity = await gitIdentityManager.getLocalIdentity(repo.rootPath);
        const msg = `Repository: ${repo.owner}/${repo.repoName}\n` +
            `Remote: ${repo.remoteUrl}\n` +
            `Mapped Profile: ${mapped ? mapped.displayName : 'None'}\n` +
            `Active Profile: ${active ? active.displayName : 'None'}\n` +
            `Git Identity: ${localIdentity ? `${localIdentity.name} <${localIdentity.email}>` : 'Not set'}`;
        vscode.window.showInformationMessage(msg, { modal: true }, 'OK');
    }), vscode.commands.registerCommand('githubAccountManager.diagnostics', async () => {
        const report = await diagnosticsService.generateReport();
        const doc = await vscode.workspace.openTextDocument({
            content: report,
            language: 'markdown'
        });
        await vscode.window.showTextDocument(doc);
    }), vscode.commands.registerCommand('githubAccountManager.validateAuthentication', async (target) => {
        const id = typeof target === 'string' ? target : target?.profile?.id;
        const folder = vscode.workspace.workspaceFolders?.[0];
        const repository = folder ? await repoDetector.detectRepository(folder.uri.fsPath) : undefined;
        const active = id ? profileManager.getProfileById(id) : (repository && repoMapper.resolveProfileForRepository(repository)) || profileManager.getActiveProfile();
        if (!active) {
            vscode.window.showWarningMessage('No active profile selected.');
            return;
        }
        try {
            const lines = [AccountProfile_1.AuthenticationMethod.HTTPS, AccountProfile_1.AuthenticationMethod.BROWSER_OAUTH].includes(active.authenticationMethod)
                ? await new TokenHealthService_1.TokenHealthService().check(active, await secretService.getToken(active.id), repository)
                : [`This profile uses ${active.authenticationMethod}. Saved-token checks do not verify SSH keys or GitHub CLI credentials.`];
            await vscode.window.showInformationMessage(`Authentication Health: ${active.displayName}\n\n${lines.join('\n\n')}`, { modal: true }, 'OK');
        }
        catch (error) {
            showFailure(error);
        }
    }));
    // Register Git Push Interceptor for Push Protection
    try {
        const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
        if (gitExtension) {
            const gitApi = gitExtension.getAPI(1);
            if (gitApi && gitApi.repositories) {
                for (const repo of gitApi.repositories) {
                    repo.state.onDidChange(async () => {
                        // Validate push safety on repository state changes
                        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                            const repoPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
                            await pushGuardService.validatePushSafety(repoPath);
                        }
                    });
                }
            }
        }
    }
    catch (e) {
        logger_1.Logger.warn('Could not bind VS Code Git API push guard listener', e);
    }
    // Keep VS Code as the source of truth; the companion never receives vault tokens.
    if (vscode.env?.uiKind === vscode.UIKind?.Desktop && vscode.env && !vscode.env.remoteName) {
        try {
            const bridge = await (0, DesktopBridge_1.startDesktopBridge)(vscode.workspace.name || 'VS Code — no folder', async (request) => {
                try {
                    if (request.action === 'agentRepository') {
                        if (!vscode.workspace.isTrusted)
                            throw new Error('Trust this workspace before granting agent access.');
                        const folder = vscode.workspace.workspaceFolders?.[0];
                        const repository = folder && await repoDetector.detectRepository(folder.uri.fsPath);
                        if (!repository)
                            throw new Error('Open a Git repository with an origin remote.');
                        const profile = repoMapper.resolveProfileForRepository(repository);
                        if (!profile)
                            throw new Error('Assign this repository to an account before granting agent access.');
                        return new TokenHealthService_1.TokenHealthService().repositoryMetadata(profile, await secretService.getToken(profile.id), repository);
                    }
                    if (request.action !== 'snapshot') {
                        if (!vscode.workspace.isTrusted)
                            throw new Error('Trust the VS Code workspace before changing accounts.');
                        switch (request.action) {
                            case 'browserLogin':
                                await quickPickMenu.addAccountViaBrowser();
                                break;
                            case 'addAccount':
                                await quickPickMenu.showAddAccountWizard();
                                break;
                            case 'saveToken':
                                await quickPickMenu.saveToken(request.id);
                                break;
                            case 'reauthenticate':
                                await quickPickMenu.reauthenticate(request.id);
                                break;
                            case 'switchProfile':
                                await syncWorkspaceProfile(request.id);
                                break;
                            case 'sync':
                                await syncWorkspaceProfile();
                                break;
                            case 'removeProfile':
                                await vscode.commands.executeCommand('githubAccountManager.removeAccount', { profile: { id: request.id } });
                                break;
                            case 'removeMapping': {
                                const mapping = profileManager.getMappings().find(row => row.id === request.id);
                                if (!mapping)
                                    throw new Error('Mapping no longer exists.');
                                await vscode.commands.executeCommand('githubAccountManager.removeMapping', { mapping });
                                break;
                            }
                            default: {
                                const commands = { mapProject: 'mapProject', diagnostics: 'diagnostics', health: 'validateAuthentication', dashboard: 'openDashboard' };
                                await vscode.commands.executeCommand(`githubAccountManager.${commands[request.action]}`);
                            }
                        }
                        refreshUI();
                    }
                    return {
                        profiles: profileManager.getProfiles().map(p => ({ id: p.id, displayName: p.displayName, githubUsername: p.githubUsername,
                            githubEmail: p.githubEmail, authenticationMethod: p.authenticationMethod })),
                        mappings: profileManager.getMappings().map(m => ({ id: m.id, profileId: m.profileId, pattern: m.pattern, isPathPattern: m.isPathPattern })),
                        activeProfileId: profileManager.getActiveProfileId(), trusted: vscode.workspace.isTrusted,
                        folders: vscode.workspace.workspaceFolders?.map(folder => folder.uri.fsPath) || []
                    };
                }
                catch (error) {
                    showFailure(error);
                    throw error;
                }
            });
            context.subscriptions.push(bridge);
        }
        catch {
            logger_1.Logger.warn('Desktop companion connection could not start. Reload the VS Code window to retry.');
        }
    }
    logger_1.Logger.info('GitHub Account & Git Identity Manager extension successfully activated.');
}
exports.activate = activate;
function deactivate() {
    statusBarController?.dispose();
    logger_1.Logger.info('GitHub Account Manager extension deactivated.');
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map