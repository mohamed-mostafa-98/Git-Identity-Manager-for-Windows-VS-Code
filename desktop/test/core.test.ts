import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { WorkspaceStore } from '../src/workspace';

const account = (name: string) => ({ displayName: name, githubUsername: name.toLowerCase(), githubEmail: `${name.toLowerCase()}@example.com` });
function directory(t: any) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'git-identity-test-'));
    t.after(() => {
        assert.equal(path.dirname(root), os.tmpdir());
        fs.rmSync(root, { recursive: true, force: true });
    });
    return root;
}
function git(folder: string, args: string[]) { return execFileSync('git', args, { cwd: folder, encoding: 'utf8', windowsHide: true }); }
function repository(root: string, name: string) {
    const folder = path.join(root, name); fs.mkdirSync(folder);
    git(folder, ['init', '--quiet']); git(folder, ['remote', 'add', 'origin', `https://github.com/example/${name}.git`]);
    return folder;
}

test('metadata survives restart, rejects secrets and clears removed-account assignments', async t => {
    const root = directory(t), file = path.join(root, 'workspace.json');
    const store = new WorkspaceStore(file);
    store.addAccount(account('Personal'));
    assert.throws(() => store.addAccount({ ...account('Work'), token: 'secret' }), /metadata/);
    assert.throws(() => store.addAccount({ ...account('Work'), displayName: 'github_pat_secret' }), /Tokens/);
    assert.throws(() => store.addAccount(account('Personal')), /already listed/);
    const folder = repository(root, 'app');
    await store.addProject(folder);
    const state = store.read();
    store.assign(state.projects[0].id, state.accounts[0].id);
    assert.equal(new WorkspaceStore(file).read().projects[0].accountId, state.accounts[0].id);
    assert.throws(() => store.assign(state.projects[0].id, 'unknown'), /existing/);
    store.remove('account', state.accounts[0].id);
    assert.equal(store.read().projects[0].accountId, null);
    await assert.rejects(() => store.context(folder), /Assign an account/);
});

test('simultaneous agent contexts keep account A and B isolated and do not change Git config', async t => {
    const root = directory(t), file = path.join(root, 'workspace.json'), store = new WorkspaceStore(file);
    const a = repository(root, 'personal-app'), b = repository(root, 'work-app');
    const before = [a, b].map(folder => fs.readFileSync(path.join(folder, '.git', 'config'), 'utf8'));
    store.addAccount(account('Personal')); store.addAccount(account('Work'));
    await store.addProject(a); await store.addProject(b);
    const state = store.read();
    state.projects.forEach((project, index) => store.assign(project.id, state.accounts[index].id));
    const contexts = await Promise.all([store.context(a), store.context(b)]);
    assert.deepEqual(contexts.map(c => c.account.username), ['personal', 'work']);
    assert.ok(contexts.every(c => c.authenticated === false && c.capabilities.join() === 'account-context'));
    assert.deepEqual([a, b].map(folder => fs.readFileSync(path.join(folder, '.git', 'config'), 'utf8')), before);
    const result = execFileSync(process.execPath, [path.resolve(__dirname, '../src/context.js'), '--state', file, '--project', b], { encoding: 'utf8', windowsHide: true });
    assert.equal(JSON.parse(result).account.username, 'work');
});

test('canonical roots reject duplicates and changed remotes fail closed', async t => {
    const root = directory(t), store = new WorkspaceStore(path.join(root, 'workspace.json'));
    const folder = repository(root, 'app'), child = path.join(folder, 'subfolder'); fs.mkdirSync(child);
    store.addAccount(account('Personal')); await store.addProject(child);
    const state = store.read(); store.assign(state.projects[0].id, state.accounts[0].id);
    await assert.rejects(() => store.addProject(folder), /already listed/);
    git(folder, ['remote', 'set-url', 'origin', 'https://github.com/other/repository.git']);
    await assert.rejects(() => store.context(folder), /remote has changed/);
    const other = repository(root, 'app-sibling');
    await assert.rejects(() => store.context(other), /Add this project/);
});

test('unsafe remote credentials never reach the metadata file', async t => {
    const root = directory(t), file = path.join(root, 'workspace.json'), store = new WorkspaceStore(file);
    const folder = repository(root, 'unsafe');
    git(folder, ['remote', 'set-url', 'origin', 'https://user:example-secret@github.com/example/unsafe.git']);
    await assert.rejects(() => store.addProject(folder), /without embedded credentials/);
    assert.equal(fs.existsSync(file), false);
});

test('corrupt state is preserved rather than overwritten', t => {
    const root = directory(t), file = path.join(root, 'workspace.json');
    fs.writeFileSync(file, '{broken');
    assert.throws(() => new WorkspaceStore(file).addAccount(account('Personal')), /unreadable/);
    assert.equal(fs.readFileSync(file, 'utf8'), '{broken');
});
