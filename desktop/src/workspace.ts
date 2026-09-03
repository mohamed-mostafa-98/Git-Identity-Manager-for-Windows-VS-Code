import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import type { AccountProfile } from '../../src/models/AccountProfile';
import { CommandExecutor } from '../../src/utils/commandExecutor';
import { RepositoryDetector } from '../../src/services/RepositoryDetector';

export type Account = Pick<AccountProfile, 'id' | 'displayName' | 'githubUsername' | 'githubEmail'>;
export type Project = { id: string; rootPath: string; name: string; remote: string; accountId: string | null };
export type Workspace = { version: 1; accounts: Account[]; projects: Project[] };
const empty = (): Workspace => ({ version: 1, accounts: [], projects: [] });

function record(value: unknown, keys: string[]): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) {
        throw new Error('Invalid workspace data. Only account and project metadata is supported.');
    }
    return value as Record<string, unknown>;
}
function text(value: unknown, max = 200): string {
    if (typeof value !== 'string' || !value.trim() || value.length > max || /[\x00-\x1f]|github_pat_|gh[pousr]_/i.test(value)) {
        throw new Error('Enter valid metadata. Tokens and control characters are not accepted.');
    }
    return value.trim();
}
export function accountInput(value: unknown): Omit<Account, 'id'> {
    const data = record(value, ['displayName', 'githubUsername', 'githubEmail']);
    const githubUsername = text(data.githubUsername, 39);
    const githubEmail = text(data.githubEmail);
    if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(githubUsername) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(githubEmail)) {
        throw new Error('Enter a GitHub username and a valid commit email.');
    }
    return { displayName: text(data.displayName, 80), githubUsername, githubEmail };
}
const samePath = (a: string, b: string): boolean => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;

const githubRemote = /^(?:https:\/\/github\.com\/|git@github\.com(?:-[A-Za-z0-9-]+)?:|ssh:\/\/git@github\.com(?:-[A-Za-z0-9-]+)?\/)[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export async function inspectRepository(folder: string) {
    text(folder, 4096);
    const canonical = fs.realpathSync(folder);
    const options = { cwd: canonical, timeout: 10000 };
    const root = await CommandExecutor.execute('git', ['rev-parse', '--show-toplevel'], options);
    if (root.exitCode !== 0) throw new Error('Choose a local Git repository.');
    const rootPath = fs.realpathSync(root.stdout);
    const remote = await CommandExecutor.execute('git', ['remote', 'get-url', 'origin'], { ...options, cwd: rootPath });
    if (remote.exitCode !== 0) throw new Error('This repository needs an origin remote.');
    // Accept only known GitHub URL forms. Never persist credentials embedded in a remote.
    if (!githubRemote.test(remote.stdout)) {
        throw new Error('Use a GitHub.com remote without embedded credentials, query parameters or fragments.');
    }
    const parsed = new RepositoryDetector().parseRemoteUrl(rootPath, 'origin', remote.stdout);
    if (!parsed) throw new Error('Unsupported GitHub remote.');
    return { rootPath, name: `${parsed.owner}/${parsed.repoName}`, remote: remote.stdout };
}

export class WorkspaceStore {
    constructor(public readonly file: string) {}

    read(): Workspace {
        if (!fs.existsSync(this.file)) return empty();
        if (fs.statSync(this.file).size > 2 * 1024 * 1024) throw new Error('Workspace data is too large.');
        let raw: unknown;
        try { raw = JSON.parse(fs.readFileSync(this.file, 'utf8')); }
        catch { throw new Error('Workspace data is unreadable. Restore a backup; it has not been overwritten.'); }
        const data = record(raw, ['version', 'accounts', 'projects']);
        if (data.version !== 1 || !Array.isArray(data.accounts) || !Array.isArray(data.projects)) throw new Error('Unsupported workspace format.');
        const accounts = data.accounts.map(value => {
            const row = record(value, ['id', 'displayName', 'githubUsername', 'githubEmail']);
            return { id: text(row.id), ...accountInput({ displayName: row.displayName, githubUsername: row.githubUsername, githubEmail: row.githubEmail }) };
        });
        const projects = data.projects.map(value => {
            const row = record(value, ['id', 'rootPath', 'name', 'remote', 'accountId']);
            const rootPath = text(row.rootPath, 4096);
            if (typeof row.remote !== 'string' || !githubRemote.test(row.remote)) throw new Error('Unsupported or credential-bearing saved remote.');
            if (!path.isAbsolute(rootPath)) throw new Error('Project paths must be absolute.');
            const accountId = row.accountId === null ? null : text(row.accountId);
            if (accountId && !accounts.some(a => a.id === accountId)) throw new Error('A project references a missing account.');
            return { id: text(row.id), rootPath, name: text(row.name), remote: text(row.remote, 4096), accountId };
        });
        if (new Set(accounts.map(a => a.id)).size !== accounts.length || new Set(projects.map(p => p.id)).size !== projects.length) {
            throw new Error('Workspace identifiers must be unique.');
        }
        return { version: 1, accounts, projects };
    }

    private write(state: Workspace): void {
        fs.mkdirSync(path.dirname(this.file), { recursive: true });
        const temporary = `${this.file}.${randomUUID()}.tmp`;
        try {
            fs.writeFileSync(temporary, JSON.stringify(state, null, 2), { mode: 0o600, flag: 'wx' });
            fs.renameSync(temporary, this.file);
        } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
    }

    addAccount(input: unknown): Workspace {
        const account = accountInput(input);
        const state = this.read();
        if (state.accounts.some(a => a.githubUsername.toLowerCase() === account.githubUsername.toLowerCase())) throw new Error('This account is already listed.');
        state.accounts.push({ id: randomUUID(), ...account });
        this.write(state);
        return state;
    }

    async addProject(folder: string): Promise<Workspace> {
        const inspected = await inspectRepository(folder);
        const state = this.read();
        if (state.projects.some(p => samePath(p.rootPath, inspected.rootPath))) throw new Error('This project is already listed.');
        state.projects.push({ id: randomUUID(), ...inspected, accountId: null });
        this.write(state);
        return state;
    }

    assign(projectId: unknown, accountId: unknown): Workspace {
        const state = this.read();
        const project = state.projects.find(p => p.id === projectId);
        if (!project || (accountId !== null && !state.accounts.some(a => a.id === accountId))) throw new Error('Choose an existing project and account.');
        project.accountId = accountId as string | null;
        this.write(state);
        return state;
    }

    remove(kind: unknown, id: unknown): Workspace {
        const state = this.read();
        if (kind === 'account') {
            if (!state.accounts.some(a => a.id === id)) throw new Error('Account not found.');
            state.accounts = state.accounts.filter(a => a.id !== id);
            state.projects.forEach(p => { if (p.accountId === id) p.accountId = null; });
        } else if (kind === 'project') {
            if (!state.projects.some(p => p.id === id)) throw new Error('Project not found.');
            state.projects = state.projects.filter(p => p.id !== id);
        } else throw new Error('Unknown item type.');
        this.write(state);
        return state;
    }

    async context(folder: string) {
        const inspected = await inspectRepository(folder);
        const state = this.read();
        const project = state.projects.find(p => samePath(p.rootPath, inspected.rootPath));
        if (!project) throw new Error('Add this project in the desktop app first.');
        if (project.remote !== inspected.remote) throw new Error('The remote has changed. Remove and re-add this project before using its account context.');
        const account = state.accounts.find(a => a.id === project.accountId);
        if (!account) throw new Error('Assign an account to this project first.');
        return { project: { rootPath: inspected.rootPath, repository: inspected.name }, account: { id: account.id, username: account.githubUsername, commitEmail: account.githubEmail }, authenticated: false, capabilities: ['account-context'], nextStep: 'Secure desktop login and authenticated MCP tools are planned in milestones 2 and 3.' };
    }
}
