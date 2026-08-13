import * as vscode from 'vscode';
import * as os from 'os';
import { CommandExecutor } from '../utils/commandExecutor';
import { ProfileManager } from './ProfileManager';
import { RepositoryDetector } from './RepositoryDetector';
import { GitHubCliStrategy } from './GitHubCliStrategy';
import { Logger } from '../utils/logger';

export class DiagnosticsService {
    private profileManager: ProfileManager;
    private repoDetector: RepositoryDetector;
    private ghStrategy: GitHubCliStrategy;

    constructor(
        profileManager: ProfileManager,
        repoDetector: RepositoryDetector,
        ghStrategy: GitHubCliStrategy
    ) {
        this.profileManager = profileManager;
        this.repoDetector = repoDetector;
        this.ghStrategy = ghStrategy;
    }

    /**
     * Generates a comprehensive system diagnostic markdown report without exposing any secrets or tokens.
     */
    public async generateReport(): Promise<string> {
        const osInfo = `${os.type()} ${os.release()} (${os.arch()})`;
        const vscodeVersion = vscode.version;

        // Git version
        const gitRes = await CommandExecutor.execute('git', ['--version']);
        const gitVersion = gitRes.stdout || 'Git not found';

        // GCM version
        const gcmRes = await CommandExecutor.execute('git-credential-manager', ['--version']);
        const gcmVersion = gcmRes.stdout || (gcmRes.exitCode === 0 ? 'Detected' : 'Not detected in PATH');

        // SSH version
        const sshRes = await CommandExecutor.execute('ssh', ['-V']);
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
                const nameRes = await CommandExecutor.execute('git', ['config', '--local', 'user.name'], { cwd: repo.rootPath });
                const emailRes = await CommandExecutor.execute('git', ['config', '--local', 'user.email'], { cwd: repo.rootPath });
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

        Logger.info('Generated system diagnostic report.');
        return report;
    }
}
