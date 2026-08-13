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
const BrowserAuthStrategy_1 = require("./services/BrowserAuthStrategy");
const PushGuardService_1 = require("./services/PushGuardService");
const DiagnosticsService_1 = require("./services/DiagnosticsService");
const StatusBarController_1 = require("./ui/StatusBarController");
const AccountTreeDataProvider_1 = require("./ui/AccountTreeDataProvider");
const QuickPickMenu_1 = require("./ui/QuickPickMenu");
const logger_1 = require("./utils/logger");
const AccountProfile_1 = require("./models/AccountProfile");
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
    const browserAuthStrategy = new BrowserAuthStrategy_1.BrowserAuthStrategy();
    const pushGuardService = new PushGuardService_1.PushGuardService(profileManager, repoDetector, repoMapper);
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
    };
    /**
     * Automatic account profile application for open workspace repository.
     */
    const syncWorkspaceProfile = async () => {
        const config = vscode.workspace.getConfiguration('githubAccountManager');
        const autoSwitch = config.get('autoSwitchOnWorkspaceOpen', true);
        if (!autoSwitch || !vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            return;
        }
        const rootFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
        const repo = await repoDetector.detectRepository(rootFolder);
        if (!repo) {
            logger_1.Logger.info(`No Git remote detected in workspace: ${rootFolder}`);
            return;
        }
        const mappedProfile = repoMapper.resolveProfileForRepository(repo);
        if (mappedProfile) {
            logger_1.Logger.info(`Auto-switch: Activating profile '${mappedProfile.displayName}' for repo ${repo.owner}/${repo.repoName}`);
            await profileManager.setActiveProfile(mappedProfile.id);
            // Apply Git Commit Identity
            await gitIdentityManager.setLocalIdentity(repo.rootPath, mappedProfile);
            // Apply Authentication Strategy
            if (mappedProfile.authenticationMethod === AccountProfile_1.AuthenticationMethod.BROWSER_OAUTH) {
                await browserAuthStrategy.configureBrowserAuth(repo.rootPath, mappedProfile);
            }
            else if (mappedProfile.authenticationMethod === AccountProfile_1.AuthenticationMethod.HTTPS) {
                await httpsAuthStrategy.configureHTTPSAuth(repo.rootPath, mappedProfile);
            }
            else if (mappedProfile.authenticationMethod === AccountProfile_1.AuthenticationMethod.SSH) {
                const hostAlias = await sshAuthStrategy.ensureSSHHostAlias(mappedProfile);
                await sshAuthStrategy.bindRepoRemoteToHostAlias(repo.rootPath, hostAlias);
            }
            else if (mappedProfile.authenticationMethod === AccountProfile_1.AuthenticationMethod.GITHUB_CLI) {
                await ghCliStrategy.switchAccount(mappedProfile.githubUsername);
            }
            refreshUI();
        }
    };
    // Run workspace sync on activation
    syncWorkspaceProfile();
    // Listen to workspace folder changes
    context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(() => syncWorkspaceProfile()));
    // Register Commands
    context.subscriptions.push(vscode.commands.registerCommand('githubAccountManager.switchAccount', async () => {
        const switched = await quickPickMenu.showAccountSwitcher();
        if (switched) {
            await syncWorkspaceProfile();
            refreshUI();
            vscode.window.showInformationMessage(`Active GitHub Account: ${switched.displayName} (@${switched.githubUsername})`);
        }
    }), vscode.commands.registerCommand('githubAccountManager.addAccount', async () => {
        const added = await quickPickMenu.showAddAccountWizard();
        if (added) {
            await syncWorkspaceProfile();
            refreshUI();
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
    }), vscode.commands.registerCommand('githubAccountManager.validateAuthentication', async () => {
        const active = profileManager.getActiveProfile();
        if (!active) {
            vscode.window.showWarningMessage('No active profile selected.');
            return;
        }
        const ghStatus = await ghCliStrategy.checkStatus();
        const msg = `Authentication Health for Profile '${active.displayName}':\n\n` +
            `- Strategy: ${active.authenticationMethod}\n` +
            `- GitHub Username: ${active.githubUsername}\n` +
            `- GitHub Email: ${active.githubEmail}\n` +
            `- gh CLI Installed: ${ghStatus.isInstalled ? 'Yes' : 'No'}`;
        vscode.window.showInformationMessage(msg, { modal: true }, 'OK');
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
    logger_1.Logger.info('GitHub Account & Git Identity Manager extension successfully activated.');
}
exports.activate = activate;
function deactivate() {
    statusBarController?.dispose();
    logger_1.Logger.info('GitHub Account Manager extension deactivated.');
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map