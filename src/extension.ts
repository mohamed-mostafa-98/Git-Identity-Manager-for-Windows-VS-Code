import * as vscode from 'vscode';
import { ProfileManager } from './services/ProfileManager';
import { SecretStorageService } from './services/SecretStorageService';
import { RepositoryDetector } from './services/RepositoryDetector';
import { RepositoryMapper } from './services/RepositoryMapper';
import { GitIdentityManager } from './services/GitIdentityManager';
import { HTTPSAuthStrategy } from './services/HTTPSAuthStrategy';
import { SSHAuthStrategy } from './services/SSHAuthStrategy';
import { GitHubCliStrategy } from './services/GitHubCliStrategy';
import { BrowserAuthStrategy } from './services/BrowserAuthStrategy';
import { PushGuardService } from './services/PushGuardService';
import { DiagnosticsService } from './services/DiagnosticsService';
import { StatusBarController } from './ui/StatusBarController';
import { AccountProfilesTreeProvider, RepoMappingsTreeProvider } from './ui/AccountTreeDataProvider';
import { QuickPickMenu } from './ui/QuickPickMenu';
import { DashboardWebview } from './ui/DashboardWebview';
import { Logger } from './utils/logger';
import { AuthenticationMethod } from './models/AccountProfile';

let statusBarController: StatusBarController | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    Logger.initialize('GitHub Account Manager');
    Logger.info('Initializing GitHub Account & Git Identity Manager extension...');

    // Core Services
    const secretService = new SecretStorageService(context);
    const profileManager = new ProfileManager(context, secretService);
    const repoDetector = new RepositoryDetector();
    const repoMapper = new RepositoryMapper(profileManager);
    const gitIdentityManager = new GitIdentityManager();
    const httpsAuthStrategy = new HTTPSAuthStrategy();
    const sshAuthStrategy = new SSHAuthStrategy();
    const ghCliStrategy = new GitHubCliStrategy();
    const browserAuthStrategy = new BrowserAuthStrategy();
    const pushGuardService = new PushGuardService(profileManager, repoDetector, repoMapper);
    const diagnosticsService = new DiagnosticsService(profileManager, repoDetector, ghCliStrategy);

    // UI Controllers & Tree Views
    statusBarController = new StatusBarController(profileManager);
    context.subscriptions.push(statusBarController);

    const quickPickMenu = new QuickPickMenu(profileManager);

    const profilesTreeProvider = new AccountProfilesTreeProvider(profileManager);
    const mappingsTreeProvider = new RepoMappingsTreeProvider(profileManager);

    vscode.window.registerTreeDataProvider('githubAccountProfilesTree', profilesTreeProvider);
    vscode.window.registerTreeDataProvider('githubRepoMappingsTree', mappingsTreeProvider);

    const refreshUI = () => {
        statusBarController?.update();
        profilesTreeProvider.refresh();
        mappingsTreeProvider.refresh();
        DashboardWebview.refresh();
    };

    /**
     * Automatic account profile application for open workspace repository.
     */
    const syncWorkspaceProfile = async (): Promise<void> => {
        const config = vscode.workspace.getConfiguration('githubAccountManager');
        const autoSwitch = config.get<boolean>('autoSwitchOnWorkspaceOpen', true);

        if (!autoSwitch || !vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            return;
        }

        const rootFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
        const repo = await repoDetector.detectRepository(rootFolder);

        if (!repo) {
            Logger.info(`No Git remote detected in workspace: ${rootFolder}`);
            return;
        }

        const mappedProfile = repoMapper.resolveProfileForRepository(repo);

        if (mappedProfile) {
            Logger.info(`Auto-switch: Activating profile '${mappedProfile.displayName}' for repo ${repo.owner}/${repo.repoName}`);
            await profileManager.setActiveProfile(mappedProfile.id);

            // Apply Git Commit Identity
            await gitIdentityManager.setLocalIdentity(repo.rootPath, mappedProfile);

            // Apply Authentication Strategy
            if (mappedProfile.authenticationMethod === AuthenticationMethod.BROWSER_OAUTH) {
                await browserAuthStrategy.configureBrowserAuth(repo.rootPath, mappedProfile);
            } else if (mappedProfile.authenticationMethod === AuthenticationMethod.HTTPS) {
                await httpsAuthStrategy.configureHTTPSAuth(repo.rootPath, mappedProfile);
            } else if (mappedProfile.authenticationMethod === AuthenticationMethod.SSH) {
                const hostAlias = await sshAuthStrategy.ensureSSHHostAlias(mappedProfile);
                await sshAuthStrategy.bindRepoRemoteToHostAlias(repo.rootPath, hostAlias);
            } else if (mappedProfile.authenticationMethod === AuthenticationMethod.GITHUB_CLI) {
                await ghCliStrategy.switchAccount(mappedProfile.githubUsername);
            }

            refreshUI();
        }
    };

    // Run workspace sync on activation
    syncWorkspaceProfile();

    // Listen to workspace folder changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeWorkspaceFolders(() => syncWorkspaceProfile())
    );

    // Register Commands
    context.subscriptions.push(
        vscode.commands.registerCommand('githubAccountManager.openDashboard', () => {
            DashboardWebview.createOrShow(
                context.extensionUri,
                profileManager,
                repoDetector,
                repoMapper,
                gitIdentityManager,
                diagnosticsService,
                syncWorkspaceProfile
            );
        }),

        vscode.commands.registerCommand('githubAccountManager.removeMapping', async (item?: any) => {
            const targetId = item?.mapping?.id;
            if (!targetId) return;

            const confirm = await vscode.window.showWarningMessage(
                `Remove mapping rule '${item.mapping.pattern}'?`,
                { modal: true },
                'Remove'
            );

            if (confirm === 'Remove') {
                await profileManager.removeMapping(targetId);
                await syncWorkspaceProfile();
                refreshUI();
                vscode.window.showInformationMessage(`Removed repository mapping rule.`);
            }
        }),

        vscode.commands.registerCommand('githubAccountManager.switchAccount', async () => {
            const switched = await quickPickMenu.showAccountSwitcher();
            if (switched) {
                await syncWorkspaceProfile();
                refreshUI();
                vscode.window.showInformationMessage(`Active GitHub Account: ${switched.displayName} (@${switched.githubUsername})`);
            }
        }),

        vscode.commands.registerCommand('githubAccountManager.addAccount', async () => {
            const added = await quickPickMenu.showAddAccountWizard();
            if (added) {
                await syncWorkspaceProfile();
                refreshUI();
            }
        }),

        vscode.commands.registerCommand('githubAccountManager.removeAccount', async (item?: any) => {
            const targetId = item?.profile?.id || profileManager.getActiveProfileId();
            if (!targetId) return;

            const profile = profileManager.getProfileById(targetId);
            if (!profile) return;

            const confirm = await vscode.window.showWarningMessage(
                `Are you sure you want to remove account profile '${profile.displayName}'?`,
                { modal: true },
                'Remove'
            );

            if (confirm === 'Remove') {
                await profileManager.removeProfile(targetId);
                refreshUI();
                vscode.window.showInformationMessage(`Removed account profile: ${profile.displayName}`);
            }
        }),

        vscode.commands.registerCommand('githubAccountManager.currentAccount', () => {
            const active = profileManager.getActiveProfile();
            if (active) {
                vscode.window.showInformationMessage(`Active Account: ${active.displayName} (@${active.githubUsername}) | Email: ${active.githubEmail}`);
            } else {
                vscode.window.showWarningMessage('No active GitHub account profile selected.');
            }
        }),

        vscode.commands.registerCommand('githubAccountManager.mapProject', async () => {
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

            if (!selectedProfile) return;

            const patternType = await vscode.window.showQuickPick([
                { label: 'Current Workspace Folder', isPath: true },
                { label: 'Remote Organization / Owner Pattern', isPath: false }
            ], { title: 'Mapping Type' });

            if (!patternType) return;

            let pattern: string | undefined = undefined;

            if (patternType.isPath) {
                if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                    pattern = vscode.workspace.workspaceFolders[0].uri.fsPath;
                } else {
                    pattern = await vscode.window.showInputBox({ prompt: 'Enter folder path to map' });
                }
            } else {
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
        }),

        vscode.commands.registerCommand('githubAccountManager.repositoryStatus', async () => {
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
        }),

        vscode.commands.registerCommand('githubAccountManager.diagnostics', async () => {
            const report = await diagnosticsService.generateReport();
            const doc = await vscode.workspace.openTextDocument({
                content: report,
                language: 'markdown'
            });
            await vscode.window.showTextDocument(doc);
        }),

        vscode.commands.registerCommand('githubAccountManager.validateAuthentication', async () => {
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
        })
    );

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
    } catch (e) {
        Logger.warn('Could not bind VS Code Git API push guard listener', e);
    }

    Logger.info('GitHub Account & Git Identity Manager extension successfully activated.');
}

export function deactivate(): void {
    statusBarController?.dispose();
    Logger.info('GitHub Account Manager extension deactivated.');
}
