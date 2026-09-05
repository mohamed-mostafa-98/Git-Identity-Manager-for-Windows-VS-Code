import * as vscode from 'vscode';
import { ProfileManager } from '../services/ProfileManager';
import { RepositoryDetector } from '../services/RepositoryDetector';
import { RepositoryMapper } from '../services/RepositoryMapper';
import { GitIdentityManager } from '../services/GitIdentityManager';
import { DiagnosticsService } from '../services/DiagnosticsService';
import { AccountProfile, AuthenticationMethod } from '../models/AccountProfile';
import { Logger } from '../utils/logger';
import { agentApprovalKey } from '../services/AgentApproval';

export class DashboardWebview {
    public static currentPanel: DashboardWebview | undefined;
    private static readonly viewType = 'githubAccountManagerDashboard';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    private constructor(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        private profileManager: ProfileManager,
        private repoDetector: RepositoryDetector,
        private repoMapper: RepositoryMapper,
        private gitIdentityManager: GitIdentityManager,
        private diagnosticsService: DiagnosticsService,
        private syncCallback: (profileId?: string) => Promise<void>,
        private getAgentApproval: () => unknown
    ) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        // Set the webview's initial html content
        this._updateWebview();

        // Listen for when the panel is disposed
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                try {
                    switch (message.command) {
                        case 'switchProfile':
                            await this.syncCallback(message.profileId);
                            vscode.window.showInformationMessage(`Active profile switched.`);
                            await this._updateWebview();
                            break;

                        case 'saveToken':
                            await vscode.commands.executeCommand('githubAccountManager.saveToken', message.profileId);
                            break;
                        case 'reauthenticate':
                            await vscode.commands.executeCommand('githubAccountManager.reauthenticate', message.profileId);
                            break;

                        case 'addProfile':
                            const newProfile: AccountProfile = {
                                id: `profile_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                                displayName: message.displayName,
                                githubUsername: message.githubUsername,
                                githubEmail: message.githubEmail,
                                authenticationMethod: message.authenticationMethod as AuthenticationMethod,
                                sshProfileHostAlias: message.sshHostAlias || undefined,
                                sshKeyPath: message.sshKeyPath || undefined,
                                createdAt: new Date().toISOString(),
                                updatedAt: new Date().toISOString()
                            };

                            await this.profileManager.saveProfile(newProfile, message.token || undefined);
                            vscode.window.showInformationMessage(`Added GitHub profile: ${newProfile.displayName}`);
                            await this._updateWebview();
                            break;

                        case 'removeProfile':
                            const profile = this.profileManager.getProfileById(message.profileId);
                            if (profile) {
                                const confirm = await vscode.window.showWarningMessage(
                                    `Remove profile '${profile.displayName}'?`,
                                    { modal: true },
                                    'Remove'
                                );
                                if (confirm === 'Remove') {
                                    await this.profileManager.removeProfile(message.profileId);
                                    await this.syncCallback();
                                    vscode.window.showInformationMessage(`Removed profile.`);
                                    await this._updateWebview();
                                }
                            }
                            break;

                        case 'addMapping':
                            await this.profileManager.saveMapping(
                                message.profileId,
                                message.pattern,
                                message.isPathPattern
                            );
                            await this.syncCallback();
                            vscode.window.showInformationMessage(`Saved repository mapping rule.`);
                            await this._updateWebview();
                            break;

                        case 'removeMapping':
                            await this.profileManager.removeMapping(message.mappingId);
                            await this.syncCallback();
                            vscode.window.showInformationMessage(`Removed mapping rule.`);
                            await this._updateWebview();
                            break;

                        case 'manageAgentAccess':
                            await vscode.commands.executeCommand('githubAccountManager.manageAgentAccess');
                            break;
                        case 'syncWorkspaceIdentity':
                            await this.syncCallback();
                            vscode.window.showInformationMessage(`Synchronized workspace Git identity.`);
                            await this._updateWebview();
                            break;

                        case 'validateAuth':
                            await vscode.commands.executeCommand('githubAccountManager.validateAuthentication', message.profileId);
                            break;

                        case 'runDiagnostics':
                            const report = await this.diagnosticsService.generateReport();
                            this._panel.webview.postMessage({ command: 'diagnosticsReport', report });
                            break;

                        case 'refresh':
                            await this._updateWebview();
                            break;
                    }
                } catch (err: any) {
                    Logger.error('Dashboard message error', err);
                    vscode.window.showErrorMessage(`Dashboard operation failed: ${err.message}`);
                }
            },
            null,
            this._disposables
        );
    }

    public static createOrShow(
        extensionUri: vscode.Uri,
        profileManager: ProfileManager,
        repoDetector: RepositoryDetector,
        repoMapper: RepositoryMapper,
        gitIdentityManager: GitIdentityManager,
        diagnosticsService: DiagnosticsService,
        syncCallback: (profileId?: string) => Promise<void>,
        getAgentApproval: () => unknown
    ): DashboardWebview {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (DashboardWebview.currentPanel) {
            DashboardWebview.currentPanel._panel.reveal(column);
            DashboardWebview.currentPanel._updateWebview();
            return DashboardWebview.currentPanel;
        }

        const panel = vscode.window.createWebviewPanel(
            DashboardWebview.viewType,
            'GitHub Account Control Panel',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [extensionUri]
            }
        );

        DashboardWebview.currentPanel = new DashboardWebview(
            panel,
            extensionUri,
            profileManager,
            repoDetector,
            repoMapper,
            gitIdentityManager,
            diagnosticsService,
            syncCallback,
            getAgentApproval
        );

        return DashboardWebview.currentPanel;
    }

    public static refresh(): void {
        if (DashboardWebview.currentPanel) {
            DashboardWebview.currentPanel._updateWebview();
        }
    }

    private async _updateWebview(): Promise<void> {
        const webview = this._panel.webview;
        const html = await this._getHtmlForWebview(webview);
        webview.html = html;
    }

    private escapeHtml(str: string | undefined | null): string {
        if (!str) return '';
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    private async _getHtmlForWebview(webview: vscode.Webview): Promise<string> {
        const profiles = this.profileManager.getProfiles();
        const activeProfileId = this.profileManager.getActiveProfileId();
        const mappings = this.profileManager.getMappings();

        let repoDetails: any = null;
        let localIdentity: any = null;
        let mappedProfileName: string = 'None';
        let mappedProfile: AccountProfile | undefined;

        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
            const detected = await this.repoDetector.detectRepository(rootPath);
            if (detected) {
                repoDetails = detected;
                localIdentity = await this.gitIdentityManager.getLocalIdentity(rootPath);
                const mapped = this.repoMapper.resolveProfileForRepository(detected);
                if (mapped) {
                    mappedProfile = mapped;
                    mappedProfileName = mapped.displayName;
                }
            }
        }

        const approval = this.getAgentApproval();
        const agentEnabled = !!(vscode.workspace.isTrusted && repoDetails && mappedProfile && approval === agentApprovalKey(repoDetails, mappedProfile));
        const agentHelp = !vscode.workspace.isTrusted ? 'Trust this workspace before enabling access.'
            : !repoDetails ? 'Open a Git project to enable access.'
            : !mappedProfile ? 'Assign this project to an account first.'
            : approval && !agentEnabled ? 'The saved approval does not match this project/account. Clear it, then enable access again.'
            : agentEnabled ? 'Local AI tools can read this project’s GitHub metadata using the account below.'
            : 'AI tools cannot read this project through this extension until you enable access.';

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GitHub Account Control Panel</title>
    <style>
        :root {
            --bg-color: var(--vscode-editor-background);
            --fg-color: var(--vscode-editor-foreground);
            --card-bg: var(--vscode-welcomePage-tileBackground, rgba(127, 127, 127, 0.08));
            --card-border: var(--vscode-widget-border, rgba(127, 127, 127, 0.2));
            --button-bg: var(--vscode-button-background);
            --button-fg: var(--vscode-button-foreground);
            --button-hover: var(--vscode-button-hoverBackground);
            --badge-bg: var(--vscode-badge-background);
            --badge-fg: var(--vscode-badge-foreground);
            --input-bg: var(--vscode-input-background);
            --input-fg: var(--vscode-input-foreground);
            --input-border: var(--vscode-input-border, rgba(127,127,127,0.3));
        }

        body {
            font-family: var(--vscode-font-family, system-ui, -apple-system, sans-serif);
            background-color: var(--bg-color);
            color: var(--fg-color);
            padding: 24px;
            margin: 0;
            line-height: 1.5;
        }

        header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 16px;
            margin-bottom: 24px;
            border-bottom: 1px solid var(--card-border);
        }

        h1 {
            font-size: 1.6rem;
            margin: 0;
            display: flex;
            align-items: center;
            gap: 10px;
            font-weight: 600;
        }

        .subtitle {
            font-size: 0.9rem;
            opacity: 0.8;
            margin-top: 4px;
        }

        .tab-bar {
            display: flex;
            gap: 8px;
            border-bottom: 1px solid var(--card-border);
            margin-bottom: 24px;
        }

        .tab-btn {
            background: transparent;
            border: none;
            color: var(--fg-color);
            padding: 10px 18px;
            cursor: pointer;
            font-size: 0.95rem;
            font-weight: 500;
            border-bottom: 2px solid transparent;
            opacity: 0.7;
            transition: all 0.2s ease;
        }

        .tab-btn:hover {
            opacity: 1;
        }

        .tab-btn.active {
            opacity: 1;
            border-bottom-color: var(--button-bg);
            color: var(--button-bg);
        }

        .tab-content {
            display: none;
        }

        .tab-content.active {
            display: block;
        }

        .action-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }

        .btn {
            background-color: var(--button-bg);
            color: var(--button-fg);
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.9rem;
            font-weight: 500;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            transition: background-color 0.2s;
        }

        .btn:hover {
            background-color: var(--button-hover);
        }

        .btn-secondary {
            background-color: transparent;
            border: 1px solid var(--card-border);
            color: var(--fg-color);
        }

        .btn-secondary:hover {
            background-color: rgba(127, 127, 127, 0.15);
        }

        .btn-danger {
            background-color: rgba(220, 53, 69, 0.2);
            color: #ff6b6b;
            border: 1px solid rgba(220, 53, 69, 0.4);
        }

        .btn-danger:hover {
            background-color: rgba(220, 53, 69, 0.4);
        }

        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
            gap: 16px;
        }

        .card {
            background-color: var(--card-bg);
            border: 1px solid var(--card-border);
            border-radius: 8px;
            padding: 18px;
            position: relative;
            transition: transform 0.15s ease, box-shadow 0.15s ease;
        }

        .card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }

        .card.active-card {
            border: 2px solid var(--button-bg);
        }

        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 12px;
        }

        .card-title {
            font-size: 1.1rem;
            font-weight: 600;
            margin: 0;
        }

        .badge {
            background-color: var(--badge-bg);
            color: var(--badge-fg);
            padding: 3px 8px;
            border-radius: 12px;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
        }

        .badge-active {
            background-color: #28a745;
            color: #ffffff;
        }

        .info-row {
            display: flex;
            margin-bottom: 6px;
            font-size: 0.88rem;
        }

        .info-label {
            width: 100px;
            opacity: 0.7;
        }

        .card-actions {
            margin-top: 16px;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 8px;
        }

        .card-actions .btn {
            justify-content: center;
            min-width: 0;
            text-align: center;
        }

        .form-panel {
            background-color: var(--card-bg);
            border: 1px solid var(--card-border);
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 24px;
            display: none;
        }

        .form-panel.open {
            display: block;
        }

        .form-group {
            margin-bottom: 14px;
        }

        .form-group label {
            display: block;
            margin-bottom: 4px;
            font-size: 0.85rem;
            font-weight: 500;
        }

        .form-control {
            width: 100%;
            padding: 8px 12px;
            background-color: var(--input-bg);
            color: var(--input-fg);
            border: 1px solid var(--input-border);
            border-radius: 4px;
            font-size: 0.9rem;
            box-sizing: border-box;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            background-color: var(--card-bg);
            border-radius: 8px;
            overflow: hidden;
            border: 1px solid var(--card-border);
        }

        th, td {
            padding: 12px 16px;
            text-align: left;
            border-bottom: 1px solid var(--card-border);
        }

        th {
            background-color: rgba(127, 127, 127, 0.1);
            font-weight: 600;
            font-size: 0.85rem;
            text-transform: uppercase;
        }

        pre {
            background-color: var(--card-bg);
            border: 1px solid var(--card-border);
            padding: 16px;
            border-radius: 8px;
            overflow-x: auto;
            font-family: monospace;
            font-size: 0.88rem;
            white-space: pre-wrap;
        }
    </style>
</head>
<body>
    <header>
        <div>
            <h1>⚡ GitHub Account & Git Identity Manager</h1>
            <div class="subtitle">Control Panel for Switching Profiles, Managing Repositories & Git Identities</div>
        </div>
        <div>
            <button class="btn btn-secondary" onclick="sendMessage('refresh')">🔄 Refresh</button>
        </div>
    </header>

    <section class="card" aria-labelledby="agent-access-heading" style="margin-bottom:24px; overflow-wrap:anywhere;">
        <h2 id="agent-access-heading">AI Agent Access <span class="badge">${agentEnabled ? 'Enabled — read only' : 'Disabled'}</span></h2>
        <p>${agentHelp}</p>
        <p><strong>Project:</strong> ${repoDetails ? this.escapeHtml(repoDetails.owner + '/' + repoDetails.repoName) : 'No Git project open'}<br>
        <strong>Account:</strong> ${mappedProfile ? this.escapeHtml(mappedProfile.displayName + ' (@' + mappedProfile.githubUsername + ')') : 'No account assigned'}</p>
        <p>Allows repository information only. It does not allow edits or pushes. Your GitHub token stays in VS Code.</p>
        <button class="btn ${approval ? 'btn-danger' : ''}" onclick="sendMessage('manageAgentAccess')" ${!approval && (!vscode.workspace.isTrusted || !repoDetails || !mappedProfile) ? 'disabled' : ''}>${approval ? (agentEnabled ? 'Disable AI Access' : 'Clear Previous Approval') : 'Enable AI Access'}</button>
        <p class="subtitle">Applies to the first project folder in this VS Code window. Use Refresh after changing its remote.</p>
    </section>

    <div class="tab-bar">
        <button class="tab-btn active" onclick="switchTab('profiles')">👤 Account Profiles (${profiles.length})</button>
        <button class="tab-btn" onclick="switchTab('mappings')">🗺️ Repository Mappings (${mappings.length})</button>
        <button class="tab-btn" onclick="switchTab('workspace')">📂 Active Workspace Identity</button>
        <button class="tab-btn" onclick="switchTab('diagnostics')">🩺 System Diagnostics</button>
    </div>

    <!-- PROFILES TAB -->
    <div id="tab-profiles" class="tab-content active">
        <div class="action-bar">
            <h3>Registered Account Profiles</h3>
            <button class="btn" onclick="toggleForm('add-profile-form')">+ Add Account Profile</button>
        </div>

        <!-- Add Profile Form -->
        <div id="add-profile-form" class="form-panel">
            <h4>Add New GitHub Account Profile</h4>
            <div class="form-group">
                <label>Display Name (e.g. Work Account, Personal)</label>
                <input type="text" id="prof-displayName" class="form-control" placeholder="Work GitHub">
            </div>
            <div class="form-group">
                <label>GitHub Username</label>
                <input type="text" id="prof-username" class="form-control" placeholder="octocat">
            </div>
            <div class="form-group">
                <label>GitHub Email (used for Git commits)</label>
                <input type="email" id="prof-email" class="form-control" placeholder="user@domain.com">
            </div>
            <div class="form-group">
                <label>Authentication Strategy</label>
                <select id="prof-authMethod" class="form-control" onchange="onAuthMethodChange()">
                    <option value="BROWSER_OAUTH">Browser OAuth / GCM</option>
                    <option value="HTTPS">HTTPS Token (Personal Access Token)</option>
                    <option value="SSH">SSH Key Host Alias</option>
                    <option value="GITHUB_CLI">GitHub CLI (gh auth)</option>
                </select>
            </div>
            <div class="form-group" id="pat-field" style="display:none;">
                <label>Personal Access Token (PAT)</label>
                <input type="password" id="prof-token" class="form-control" autocomplete="off" placeholder="GitHub personal access token">
            </div>
            <div class="form-group" id="ssh-field" style="display:none;">
                <label>SSH Host Alias (e.g. github.com-work)</label>
                <input type="text" id="prof-sshAlias" class="form-control" placeholder="github.com-work">
            </div>
            <div style="display:flex; gap:10px; margin-top:16px;">
                <button class="btn" onclick="submitAddProfile()">Save Profile</button>
                <button class="btn btn-secondary" onclick="toggleForm('add-profile-form')">Cancel</button>
            </div>
        </div>

        <div class="grid">
            ${profiles.map(p => {
                const isActive = p.id === activeProfileId;
                return `
                <div class="card ${isActive ? 'active-card' : ''}">
                    <div class="card-header">
                        <h4 class="card-title">${this.escapeHtml(p.displayName)}</h4>
                        ${isActive ? '<span class="badge badge-active">ACTIVE</span>' : '<span class="badge">INACTIVE</span>'}
                    </div>
                    <div class="info-row">
                        <span class="info-label">Username:</span>
                        <strong>@${this.escapeHtml(p.githubUsername)}</strong>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Email:</span>
                        <span>${this.escapeHtml(p.githubEmail)}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Auth Method:</span>
                        <span class="badge">${this.escapeHtml(p.authenticationMethod)}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Last Used:</span>
                        <span>${p.lastUsedAt ? new Date(p.lastUsedAt).toLocaleDateString() : 'Never'}</span>
                    </div>
                    <div class="card-actions">
                        <button class="btn" onclick="sendMessage('switchProfile', {profileId: '${p.id}'})">Use for This Project</button>
                        ${p.authenticationMethod === AuthenticationMethod.HTTPS || p.authenticationMethod === AuthenticationMethod.BROWSER_OAUTH ? `<button class="btn btn-secondary" onclick="sendMessage('saveToken', {profileId: '${p.id}'})">Save / Update Token</button>` : ''}
                        ${p.authenticationMethod === AuthenticationMethod.BROWSER_OAUTH ? `<button class="btn btn-secondary" onclick="sendMessage('reauthenticate', {profileId: '${p.id}'})">Reauthenticate</button>` : ''}
                        <button class="btn btn-secondary" onclick="sendMessage('validateAuth', {profileId: '${p.id}'})">Health</button>
                        <button class="btn btn-danger" onclick="sendMessage('removeProfile', {profileId: '${p.id}'})">Remove</button>
                    </div>
                </div>
                `;
            }).join('')}
        </div>
    </div>

    <!-- MAPPINGS TAB -->
    <div id="tab-mappings" class="tab-content">
        <div class="action-bar">
            <h3>Repository & Path Binding Rules</h3>
            <button class="btn" onclick="toggleForm('add-mapping-form')">+ Add Mapping Rule</button>
        </div>

        <div id="add-mapping-form" class="form-panel">
            <h4>Bind Repository or Path to Profile</h4>
            <div class="form-group">
                <label>Target Account Profile</label>
                <select id="map-profileId" class="form-control">
                    ${profiles.map(p => `<option value="${p.id}">${this.escapeHtml(p.displayName)} (@${this.escapeHtml(p.githubUsername)})</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Pattern Type</label>
                <select id="map-isPath" class="form-control">
                    <option value="true">Local Workspace Folder Path</option>
                    <option value="false">Remote URL / Organization Pattern (e.g. "company" or "github.com/company/*")</option>
                </select>
            </div>
            <div class="form-group">
                <label>Folder Path or Remote Pattern</label>
                <input type="text" id="map-pattern" class="form-control" placeholder="C:\\Projects\\WorkApp or company">
            </div>
            <div style="display:flex; gap:10px; margin-top:16px;">
                <button class="btn" onclick="submitAddMapping()">Save Mapping Rule</button>
                <button class="btn btn-secondary" onclick="toggleForm('add-mapping-form')">Cancel</button>
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th>Pattern</th>
                    <th>Mapped Profile</th>
                    <th>Rule Type</th>
                    <th>Created</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
                ${mappings.length === 0 ? '<tr><td colspan="5" style="text-align:center; opacity:0.6;">No repository mappings created yet.</td></tr>' : ''}
                ${mappings.map(m => {
                    const prof = profiles.find(p => p.id === m.profileId);
                    return `
                    <tr>
                        <td><code>${this.escapeHtml(m.pattern)}</code></td>
                        <td><strong>${prof ? this.escapeHtml(prof.displayName) : 'Unknown'}</strong></td>
                        <td><span class="badge">${m.isPathPattern ? 'Folder Path' : 'Remote Pattern'}</span></td>
                        <td>${new Date(m.createdAt).toLocaleDateString()}</td>
                        <td><button class="btn btn-danger" onclick="sendMessage('removeMapping', {mappingId: '${m.id}'})">Delete</button></td>
                    </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    </div>

    <!-- WORKSPACE TAB -->
    <div id="tab-workspace" class="tab-content">
        <div class="action-bar">
            <h3>Active Workspace Git & Identity Status</h3>
            <button class="btn" onclick="sendMessage('syncWorkspaceIdentity')">🔄 Apply & Sync Identity</button>
        </div>

        ${repoDetails ? `
        <div class="card" style="margin-bottom: 20px;">
            <h4>Git Repository Information</h4>
            <div class="info-row"><span class="info-label">Repo Path:</span><code>${this.escapeHtml(repoDetails.rootPath)}</code></div>
            <div class="info-row"><span class="info-label">Remote URL:</span><code>${this.escapeHtml(repoDetails.remoteUrl)}</code></div>
            <div class="info-row"><span class="info-label">Owner/Repo:</span><strong>${this.escapeHtml(repoDetails.owner)} / ${this.escapeHtml(repoDetails.repoName)}</strong></div>
            <div class="info-row"><span class="info-label">Protocol:</span><span class="badge">${repoDetails.isSSH ? 'SSH' : 'HTTPS'}</span></div>
        </div>

        <div class="card">
            <h4>Current Local Git Commit Identity</h4>
            <div class="info-row"><span class="info-label">user.name:</span><strong>${localIdentity ? this.escapeHtml(localIdentity.name) : 'Not configured'}</strong></div>
            <div class="info-row"><span class="info-label">user.email:</span><strong>${localIdentity ? this.escapeHtml(localIdentity.email) : 'Not configured'}</strong></div>
            <div class="info-row"><span class="info-label">Mapped Profile:</span><span>${this.escapeHtml(mappedProfileName)}</span></div>
        </div>
        ` : `
        <div class="card" style="text-align: center; padding: 40px;">
            <p>No active Git repository open in the current workspace window.</p>
        </div>
        `}
    </div>

    <!-- DIAGNOSTICS TAB -->
    <div id="tab-diagnostics" class="tab-content">
        <div class="action-bar">
            <h3>System Diagnostics & Health Check</h3>
            <button class="btn" onclick="sendMessage('runDiagnostics')">⚡ Run Diagnostic Audit</button>
        </div>
        <div id="diagnostics-output">
            <p style="opacity:0.7;">Click "Run Diagnostic Audit" above to check GCM, GitHub CLI, and system health.</p>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        function switchTab(tabId) {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            event.target.classList.add('active');
            document.getElementById('tab-' + tabId).classList.add('active');
        }

        function toggleForm(formId) {
            const form = document.getElementById(formId);
            form.classList.toggle('open');
        }

        function onAuthMethodChange() {
            const val = document.getElementById('prof-authMethod').value;
            document.getElementById('pat-field').style.display = val === 'HTTPS' ? 'block' : 'none';
            document.getElementById('ssh-field').style.display = val === 'SSH' ? 'block' : 'none';
        }

        function sendMessage(command, data = {}) {
            vscode.postMessage({ command, ...data });
        }

        function submitAddProfile() {
            const displayName = document.getElementById('prof-displayName').value.trim();
            const githubUsername = document.getElementById('prof-username').value.trim();
            const githubEmail = document.getElementById('prof-email').value.trim();
            const authenticationMethod = document.getElementById('prof-authMethod').value;
            const token = document.getElementById('prof-token').value.trim();
            const sshHostAlias = document.getElementById('prof-sshAlias').value.trim();

            if (!displayName || !githubUsername || !githubEmail) {
                alert('Please complete all required profile fields.');
                return;
            }

            sendMessage('addProfile', {
                displayName,
                githubUsername,
                githubEmail,
                authenticationMethod,
                token,
                sshHostAlias
            });
        }

        function submitAddMapping() {
            const profileId = document.getElementById('map-profileId').value;
            const isPathPattern = document.getElementById('map-isPath').value === 'true';
            const pattern = document.getElementById('map-pattern').value.trim();

            if (!pattern) {
                alert('Please enter a folder path or remote URL pattern.');
                return;
            }

            sendMessage('addMapping', {
                profileId,
                isPathPattern,
                pattern
            });
        }

        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'diagnosticsReport') {
                document.getElementById('diagnostics-output').innerHTML = '<pre>' + escapeHtml(message.report) + '</pre>';
            }
        });

        function escapeHtml(str) {
            if (!str) return '';
            return str.replace(/&/g, "&amp;")
                      .replace(/</g, "&lt;")
                      .replace(/>/g, "&gt;")
                      .replace(/"/g, "&quot;")
                      .replace(/'/g, "&#039;");
        }
    </script>
</body>
</html>`;
    }

    public dispose() {
        DashboardWebview.currentPanel = undefined;
        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
}
