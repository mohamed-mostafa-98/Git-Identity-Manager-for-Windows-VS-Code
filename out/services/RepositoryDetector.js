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
exports.RepositoryDetector = void 0;
const path = __importStar(require("path"));
const commandExecutor_1 = require("../utils/commandExecutor");
const logger_1 = require("../utils/logger");
class RepositoryDetector {
    /**
     * Inspects a local folder path to determine if it is a Git repository and extracts remote info.
     */
    async detectRepository(folderPath) {
        try {
            // Get git root
            const rootResult = await commandExecutor_1.CommandExecutor.execute('git', ['rev-parse', '--show-toplevel'], { cwd: folderPath });
            if (rootResult.exitCode !== 0 || !rootResult.stdout) {
                return undefined;
            }
            const gitRoot = path.normalize(rootResult.stdout);
            // Get origin remote URL
            const remoteResult = await commandExecutor_1.CommandExecutor.execute('git', ['remote', 'get-url', 'origin'], { cwd: gitRoot });
            let remoteUrl = remoteResult.stdout;
            let remoteName = 'origin';
            if (!remoteUrl || remoteResult.exitCode !== 0) {
                // Try listing all remotes
                const remotesResult = await commandExecutor_1.CommandExecutor.execute('git', ['remote', '-v'], { cwd: gitRoot });
                if (remotesResult.exitCode === 0 && remotesResult.stdout) {
                    const match = remotesResult.stdout.split('\n')[0]?.match(/^(\S+)\s+(\S+)/);
                    if (match) {
                        remoteName = match[1];
                        remoteUrl = match[2];
                    }
                }
            }
            if (!remoteUrl) {
                logger_1.Logger.info(`No Git remote found for repository at: ${gitRoot}`);
                return undefined;
            }
            return this.parseRemoteUrl(gitRoot, remoteName, remoteUrl);
        }
        catch (error) {
            logger_1.Logger.error(`Error detecting Git repository at ${folderPath}`, error);
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
    parseRemoteUrl(rootPath, remoteName, remoteUrl) {
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
        logger_1.Logger.warn(`Unrecognized Git remote URL format: ${cleanUrl}`);
        return undefined;
    }
}
exports.RepositoryDetector = RepositoryDetector;
//# sourceMappingURL=RepositoryDetector.js.map