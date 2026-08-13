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
exports.DiagnosticsService = void 0;
const vscode = __importStar(require("vscode"));
const os = __importStar(require("os"));
const commandExecutor_1 = require("../utils/commandExecutor");
const logger_1 = require("../utils/logger");
class DiagnosticsService {
    constructor(profileManager, repoDetector, ghStrategy) {
        this.profileManager = profileManager;
        this.repoDetector = repoDetector;
        this.ghStrategy = ghStrategy;
    }
    /**
     * Generates a comprehensive system diagnostic markdown report without exposing any secrets or tokens.
     */
    async generateReport() {
        const osInfo = `${os.type()} ${os.release()} (${os.arch()})`;
        const vscodeVersion = vscode.version;
        // Git version
        const gitRes = await commandExecutor_1.CommandExecutor.execute('git', ['--version']);
        const gitVersion = gitRes.stdout || 'Git not found';
        // GCM version
        const gcmRes = await commandExecutor_1.CommandExecutor.execute('git-credential-manager', ['--version']);
        const gcmVersion = gcmRes.stdout || (gcmRes.exitCode === 0 ? 'Detected' : 'Not detected in PATH');
        // SSH version
        const sshRes = await commandExecutor_1.CommandExecutor.execute('ssh', ['-V']);
        const sshVersion = sshRes.stderr || sshRes.stdout || 'OpenSSH not found';
        // GitHub CLI status
        const ghStatus = await this.ghStrategy.checkStatus();
        const ghInfo = ghStatus.isInstalled
            ? `✓ Installed (${ghStatus.version || 'Active'}) - Logged in as: ${ghStatus.loggedInUsers.join(', ') || 'None'}`
            : '✗ GitHub CLI not installed';
        // Active profile & repository
        const activeProfile = this.profileManager.getActiveProfile();
        const activeProfileText = activeProfile
            ? `🟢 ${activeProfile.displayName} (@${activeProfile.githubUsername}) [Auth: ${activeProfile.authenticationMethod}]`
            : '⚪ None';
        let currentRepoText = 'No active workspace repository detected';
        let currentGitIdentity = 'N/A';
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            const folderPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
            const repo = await this.repoDetector.detectRepository(folderPath);
            if (repo) {
                currentRepoText = `Remote: ${repo.remoteUrl} (Host: ${repo.hostname}, Owner: ${repo.owner}, Repo: ${repo.repoName})`;
                const nameRes = await commandExecutor_1.CommandExecutor.execute('git', ['config', '--local', 'user.name'], { cwd: repo.rootPath });
                const emailRes = await commandExecutor_1.CommandExecutor.execute('git', ['config', '--local', 'user.email'], { cwd: repo.rootPath });
                currentGitIdentity = `${nameRes.stdout || 'Not set'} <${emailRes.stdout || 'Not set'}>`;
            }
        }
        const profiles = this.profileManager.getProfiles();
        const mappings = this.profileManager.getMappings();
        const report = `# GitHub Account & Git Identity Manager: Diagnostics

## System Environment
- **OS**: ${osInfo}
- **VS Code Version**: ${vscodeVersion}
- **Git Version**: ${gitVersion}
- **Git Credential Manager**: ${gcmVersion}
- **OpenSSH Version**: ${sshVersion}
- **GitHub CLI**: ${ghInfo}

## Active Context
- **Active Account Profile**: ${activeProfileText}
- **Current Workspace Repository**: ${currentRepoText}
- **Local Repository Git Identity**: ${currentGitIdentity}

## Configured Profiles (${profiles.length})
${profiles.map(p => `- **${p.displayName}** (@${p.githubUsername}) | Email: ${p.githubEmail} | Auth: ${p.authenticationMethod}`).join('\n') || '- No account profiles configured.'}

## Repository Mappings (${mappings.length})
${mappings.map(m => `- Pattern: \`${m.pattern}\` -> Profile ID: \`${m.profileId}\` (${m.isPathPattern ? 'Path' : 'Remote URL'})`).join('\n') || '- No repository mappings configured.'}

---
*Generated at ${new Date().toISOString()} | All secrets and tokens are redacted.*
`;
        logger_1.Logger.info('Generated system diagnostic report.');
        return report;
    }
}
exports.DiagnosticsService = DiagnosticsService;
//# sourceMappingURL=DiagnosticsService.js.map