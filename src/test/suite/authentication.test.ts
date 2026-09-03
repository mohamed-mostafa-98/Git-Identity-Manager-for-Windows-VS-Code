import * as assert from 'assert';
import * as path from 'path';
import { CommandExecutor } from '../../utils/commandExecutor';
import { HTTPSAuthStrategy } from '../../services/HTTPSAuthStrategy';
import { ProfileManager } from '../../services/ProfileManager';
import { BrowserAuthStrategy } from '../../services/BrowserAuthStrategy';
import { RepositoryMapper } from '../../services/RepositoryMapper';
import { RepositoryDetector, RepositoryDetails } from '../../services/RepositoryDetector';
import { GitIdentityManager } from '../../services/GitIdentityManager';
import { SecretStorageService } from '../../services/SecretStorageService';
import { AccountProfile, AuthenticationMethod } from '../../models/AccountProfile';
import * as DesktopBridge from '../../services/DesktopBridge';

const personal: AccountProfile = { id: 'personal', displayName: 'Personal', githubUsername: 'personal', githubEmail: 'personal@example.com', authenticationMethod: AuthenticationMethod.HTTPS, createdAt: '', updatedAt: '' };
const work = { ...personal, id: 'work', displayName: 'Work', githubUsername: 'work' };
const rootPath = path.resolve('test-work');
const repo: RepositoryDetails = { rootPath, remoteName: 'origin', remoteUrl: 'https://github.com/company/app.git', hostname: 'github.com', owner: 'company', repoName: 'app', isSSH: false };

suite('Saved authentication and repository assignment', () => {
    const originalExecute = CommandExecutor.execute;
    const originalUser = BrowserAuthStrategy.prototype.fetchGitHubUserProfile;
    teardown(() => {
        CommandExecutor.execute = originalExecute;
        BrowserAuthStrategy.prototype.fetchGitHubUserProfile = originalUser;
    });

    test('stores through GCM stdin and fails on helper/config errors', async function () {
        if (process.platform !== 'win32') this.skip();
        const calls: Parameters<typeof CommandExecutor.execute>[] = [];
        CommandExecutor.execute = async (...args) => { calls.push(args); return { exitCode: 0, stdout: '', stderr: '' }; };
        await new HTTPSAuthStrategy().configureHTTPSAuth(rootPath, work, repo.remoteUrl, 'test_token');
        const store = calls.find(c => c[1].includes('store'))!;
        assert.ok(store);
        assert.strictEqual(store[3], 'protocol=https\nhost=github.com\npath=company/app.git\nusername=work\npassword=test_token\n\n');
        assert.strictEqual(store[2]?.env?.GCM_CREDENTIAL_STORE, 'wincredman');
        assert.ok(calls.some(c => c[1].includes('credential.credentialStore') && c[1].includes('wincredman')));
        assert.ok(calls.every(c => !JSON.stringify(c.slice(0, 3)).includes('test_token')));
        assert.ok(calls.some(c => c[1].includes('credential.https://github.com.username') && c[1].includes('work')));
        for (const failedCommand of ['--version', 'config', 'store']) {
            CommandExecutor.execute = async (_, args) => ({ exitCode: args.includes(failedCommand) ? 1 : 0, stdout: '', stderr: '' });
            await assert.rejects(() => new HTTPSAuthStrategy().configureHTTPSAuth(rootPath, work, repo.remoteUrl, 'test_token'));
        }
    });

    test('rejects other hosts and credential injection before invoking commands', async function () {
        if (process.platform !== 'win32') this.skip();
        CommandExecutor.execute = async () => { throw new Error('must not execute'); };
        const strategy = new HTTPSAuthStrategy();
        for (const url of ['https://evil.example/company/app.git', 'https://github.com.evil.example/a/b', 'http://github.com/a/b', 'https://token@github.com/a/b', 'https://github.com/a/b?token=abc']) {
            await assert.rejects(() => strategy.configureHTTPSAuth(rootPath, work, url, 'test_token'), /clean https/);
        }
        await assert.rejects(() => strategy.configureHTTPSAuth(rootPath, work, repo.remoteUrl, 'token\nhost=evil'), /Invalid/);
    });

    test('stdin is delivered while echoed secret output is discarded', async () => {
        const result = await CommandExecutor.execute(process.execPath, ['-e', "let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>{console.log(s);console.error(s);process.exit(s==='test_secret'?0:1)})"], {}, 'test_secret');
        assert.deepStrictEqual(result, { exitCode: 0, stdout: '', stderr: '' });
    });

    test('verifies token ownership and keeps tokens out of profile metadata', async () => {
        const state = new Map<string, unknown>();
        const secrets = new Map<string, string>();
        const context: any = {
            globalState: { get: (k: string, fallback: unknown) => state.get(k) ?? fallback, update: async (k: string, v: unknown) => { state.set(k, v); } },
            secrets: { get: async (k: string) => secrets.get(k), store: async (k: string, v: string) => { secrets.set(k, v); }, delete: async (k: string) => { secrets.delete(k); } }
        };
        const manager = new ProfileManager(context, new SecretStorageService(context));
        BrowserAuthStrategy.prototype.fetchGitHubUserProfile = async () => ({ username: 'someone-else', email: '', displayName: '' });
        await assert.rejects(() => manager.saveProfile(work, 'test_token'), /verification failed/);
        assert.strictEqual(secrets.size, 0);
        BrowserAuthStrategy.prototype.fetchGitHubUserProfile = async () => ({ username: 'work', email: '', displayName: '' });
        await manager.saveProfile(work, 'test_token');
        assert.strictEqual(secrets.get('github_token_work'), 'test_token');
        assert.ok(!JSON.stringify([...state]).includes('test_token'));
        await manager.removeProfile(work.id);
        assert.strictEqual(secrets.size, 0);
    });

    test('folder boundaries and specific assignments take precedence; wildcards work', () => {
        let mappings: any[] = [{ pattern: rootPath, isPathPattern: true, profileId: 'personal' }, { pattern: path.join(rootPath, 'client'), isPathPattern: true, profileId: 'work' }];
        const manager = { getMappings: () => mappings, getProfileById: (id: string) => id === 'work' ? work : personal, getProfiles: () => [] } as unknown as ProfileManager;
        const mapper = new RepositoryMapper(manager);
        assert.strictEqual(mapper.resolveProfileForRepository({ ...repo, rootPath: rootPath + 'shop' }), undefined);
        assert.strictEqual(mapper.resolveProfileForRepository({ ...repo, rootPath: path.join(rootPath, 'client', 'app') })?.id, 'work');
        mappings = [{ pattern: 'github.com/company/*', isPathPattern: false, profileId: 'work' }];
        assert.strictEqual(mapper.resolveProfileForRepository(repo)?.id, 'work');
        assert.strictEqual(mapper.resolveProfileForRepository({ ...repo, owner: 'company-evil' }), undefined);
    });

    test('explicit switch works with auto-switch disabled; failed setup preserves selection', async () => {
        const Module = require('module');
        const originalLoad = Module._load;
        const originalDetect = RepositoryDetector.prototype.detectRepository;
        const originalConfigure = HTTPSAuthStrategy.prototype.configureHTTPSAuth;
        const originalIdentity = GitIdentityManager.prototype.setLocalIdentity;
        const originalBridge = DesktopBridge.startDesktopBridge;
        const originalLogin = BrowserAuthStrategy.prototype.loginViaBrowser;
        let bridgeHandler: (request: DesktopBridge.BridgeRequest) => Promise<any>;
        (DesktopBridge as any).startDesktopBridge = async (_label: string, handler: typeof bridgeHandler) => { bridgeHandler = handler; return { dispose() {} }; };
        const commands = new Map<string, (...args: any[]) => Promise<void>>();
        const state = new Map<string, any>([
            ['github_account_profiles_v1', [personal, work]], ['github_active_profile_id_v1', 'personal'],
            ['github_repository_mappings_v1', [{ id: 'old', profileId: 'personal', pattern: rootPath, isPathPattern: true }]]
        ]);
        const errors: string[] = [];
        const noop = () => ({ dispose() {} });
        const fake = {
            env: { uiKind: 1 }, UIKind: { Desktop: 1 },
            workspace: { isTrusted: true, workspaceFolders: [{ uri: { fsPath: rootPath } }], getConfiguration: () => ({ get: () => false }), onDidChangeWorkspaceFolders: noop },
            window: { createStatusBarItem: () => ({ show() {}, dispose() {} }), registerTreeDataProvider: noop, showInputBox: async () => 'Browser account', showInformationMessage: noop, showErrorMessage: (m: string) => errors.push(m) },
            commands: { registerCommand: (name: string, cb: any) => { commands.set(name, cb); return noop(); } },
            extensions: { getExtension: () => undefined }, StatusBarAlignment: { Left: 1 },
            EventEmitter: class { event = noop; fire() {} }, TreeItem: class {}, ThemeColor: class {}
        };
        const applied: string[] = [];
        const savedSecrets = new Map<string, string>();
        const modules = ['../../extension', '../../ui/StatusBarController', '../../ui/QuickPickMenu', '../../ui/AccountTreeDataProvider', '../../ui/DashboardWebview', '../../services/PushGuardService'];
        const cached = modules.map(name => [require.resolve(name), require.cache[require.resolve(name)]] as const);
        try {
            Module._load = function (request: string, ...args: any[]) { return request === 'vscode' ? fake : originalLoad.call(this, request, ...args); };
            for (const [id] of cached) delete require.cache[id];
            RepositoryDetector.prototype.detectRepository = async () => repo;
            HTTPSAuthStrategy.prototype.configureHTTPSAuth = async (_, profile, __, token) => { applied.push(profile.id); assert.strictEqual(token, 'test_token'); return true; };
            GitIdentityManager.prototype.setLocalIdentity = async () => true;
            await require('../../extension').activate({
                subscriptions: [], globalState: { get: (k: string, fallback: any) => state.get(k) ?? fallback, update: async (k: string, v: any) => { state.set(k, v); } },
                secrets: { get: async () => 'test_token', store: async (key: string, token: string) => savedSecrets.set(key, token) }
            });
            await commands.get('githubAccountManager.switchAccount')!({ profile: work });
            assert.deepStrictEqual(applied, ['work']);
            assert.strictEqual(state.get('github_active_profile_id_v1'), 'work');
            assert.strictEqual(state.get('github_repository_mappings_v1')[0].profileId, 'work');
            HTTPSAuthStrategy.prototype.configureHTTPSAuth = async () => false;
            await commands.get('githubAccountManager.switchAccount')!({ profile: personal });
            assert.strictEqual(state.get('github_active_profile_id_v1'), 'work');
            assert.strictEqual(state.get('github_repository_mappings_v1')[0].profileId, 'work');
            assert.ok(errors.some(m => m.includes('setup failed')));
            const snapshot = await bridgeHandler!({ action: 'snapshot' });
            assert.strictEqual(snapshot.profiles.length, 2);
            assert.strictEqual(snapshot.mappings[0].profileId, 'work');
            assert.ok(!JSON.stringify(snapshot).includes('test_token'));
            BrowserAuthStrategy.prototype.loginViaBrowser = async () => ({ username: 'new-user', email: 'new@example.com', displayName: 'New', accessToken: 'browser_token' });
            BrowserAuthStrategy.prototype.fetchGitHubUserProfile = async () => ({ username: 'new-user', email: 'new@example.com', displayName: 'New' });
            const loggedIn = await bridgeHandler!({ action: 'browserLogin' });
            assert.strictEqual(loggedIn.profiles.length, 3);
            assert.strictEqual(state.get('github_account_profiles_v1')[2].githubUsername, 'new-user');
            assert.strictEqual([...savedSecrets.values()][0], 'browser_token');
            assert.ok(!JSON.stringify(loggedIn).includes('browser_token'));
            fake.workspace.isTrusted = false;
            await assert.rejects(() => bridgeHandler!({ action: 'browserLogin' }), /Trust/);
        } finally {
            (DesktopBridge as any).startDesktopBridge = originalBridge;
            BrowserAuthStrategy.prototype.loginViaBrowser = originalLogin;
            Module._load = originalLoad;
            for (const [id, value] of cached) { if (value) require.cache[id] = value; else delete require.cache[id]; }
            RepositoryDetector.prototype.detectRepository = originalDetect;
            HTTPSAuthStrategy.prototype.configureHTTPSAuth = originalConfigure;
            GitIdentityManager.prototype.setLocalIdentity = originalIdentity;
        }
    });
});
