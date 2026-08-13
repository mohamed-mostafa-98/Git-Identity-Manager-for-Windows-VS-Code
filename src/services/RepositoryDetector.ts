import * as path from 'path';
import { CommandExecutor } from '../utils/commandExecutor';
import { Logger } from '../utils/logger';

export interface RepositoryDetails {
    rootPath: string;
    remoteName: string;
    remoteUrl: string;
    hostname: string;
    owner: string;
    repoName: string;
    isSSH: boolean;
    sshHostAlias?: string;
}

export class RepositoryDetector {
    /**
     * Inspects a local folder path to determine if it is a Git repository and extracts remote info.
     */
    public async detectRepository(folderPath: string): Promise<RepositoryDetails | undefined> {
        try {
            // Get git root
            const rootResult = await CommandExecutor.execute('git', ['rev-parse', '--show-toplevel'], { cwd: folderPath });
            if (rootResult.exitCode !== 0 || !rootResult.stdout) {
                return undefined;
            }

            const gitRoot = path.normalize(rootResult.stdout);

            // Get origin remote URL
            const remoteResult = await CommandExecutor.execute('git', ['remote', 'get-url', 'origin'], { cwd: gitRoot });
            let remoteUrl = remoteResult.stdout;
            let remoteName = 'origin';

            if (!remoteUrl || remoteResult.exitCode !== 0) {
                // Try listing all remotes
                const remotesResult = await CommandExecutor.execute('git', ['remote', '-v'], { cwd: gitRoot });
                if (remotesResult.exitCode === 0 && remotesResult.stdout) {
                    const match = remotesResult.stdout.split('\n')[0]?.match(/^(\S+)\s+(\S+)/);
                    if (match) {
                        remoteName = match[1];
                        remoteUrl = match[2];
                    }
                }
            }

            if (!remoteUrl) {
                Logger.info(`No Git remote found for repository at: ${gitRoot}`);
                return undefined;
            }

            return this.parseRemoteUrl(gitRoot, remoteName, remoteUrl);
        } catch (error) {
            Logger.error(`Error detecting Git repository at ${folderPath}`, error);
            return undefined;
        }
    }

    /**
     * Parses remote URLs in HTTPS or SSH format.
     * Examples:
     * - HTTPS: https://github.com/company/payment-system.git
     * - Standard SSH: git@github.com:company/payment-system.git
     * - SSH Host Alias: git@github.com-work:company/payment-system.git
     * - SSH URL format: ssh://git@github.com-work/company/payment-system.git
     */
    public parseRemoteUrl(rootPath: string, remoteName: string, remoteUrl: string): RepositoryDetails | undefined {
        const cleanUrl = remoteUrl.trim();

        // Check SSH scp-like syntax: git@host:owner/repo.git
        const scpSshMatch = cleanUrl.match(/^git@([^:]+):([^/]+)\/(.+?)(\.git)?$/);
        if (scpSshMatch) {
            const hostOrAlias = scpSshMatch[1];
            const owner = scpSshMatch[2];
            const repoName = scpSshMatch[3];
            const isCustomAlias = hostOrAlias !== 'github.com';

            return {
                rootPath,
                remoteName,
                remoteUrl: cleanUrl,
                hostname: 'github.com',
                owner,
                repoName,
                isSSH: true,
                sshHostAlias: hostOrAlias
            };
        }

        // Check SSH URL syntax: ssh://git@host/owner/repo.git
        const urlSshMatch = cleanUrl.match(/^ssh:\/\/git@([^/]+)\/([^/]+)\/(.+?)(\.git)?$/);
        if (urlSshMatch) {
            return {
                rootPath,
                remoteName,
                remoteUrl: cleanUrl,
                hostname: 'github.com',
                owner: urlSshMatch[2],
                repoName: urlSshMatch[3],
                isSSH: true,
                sshHostAlias: urlSshMatch[1]
            };
        }

        // Check HTTPS syntax: https://github.com/owner/repo.git
        const httpsMatch = cleanUrl.match(/^https?:\/\/([^/]+)\/([^/]+)\/(.+?)(\.git)?$/);
        if (httpsMatch) {
            return {
                rootPath,
                remoteName,
                remoteUrl: cleanUrl,
                hostname: httpsMatch[1],
                owner: httpsMatch[2],
                repoName: httpsMatch[3],
                isSSH: false
            };
        }

        Logger.warn(`Unrecognized Git remote URL format: ${cleanUrl}`);
        return undefined;
    }
}
