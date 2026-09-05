import { createHash } from 'crypto';
import { RepositoryDetails } from './RepositoryDetector';
import { AccountProfile } from '../models/AccountProfile';

export function agentApprovalKey(repository: RepositoryDetails, profile: AccountProfile): string {
    return createHash('sha256').update(JSON.stringify([
        repository.rootPath, repository.remoteName, repository.remoteUrl,
        profile.id, profile.githubUsername, profile.authenticationMethod
    ])).digest('hex');
}

export function requireAgentApproval(approved: unknown, current: string): void {
    if (approved !== current) throw new Error('AI-agent access is disabled for this repository/account. Use GitHub: Manage AI Agent Access in VS Code.');
}
