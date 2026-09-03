const { app, dialog } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { openWindow } = require('../dist/desktop/src/main.js');
const { WorkspaceStore } = require('../dist/desktop/src/workspace.js');
const { DesktopBridgeClient, startDesktopBridge } = require('../dist/src/services/DesktopBridge.js');
app.on('window-all-closed', () => {});
const root = fs.mkdtempSync(path.join(path.resolve(__dirname, '..'), '.smoke-run-'));
app.setPath('userData', path.join(root, 'electron'));
const store = new WorkspaceStore(path.join(root, 'workspace.json'));
const folder = path.join(root, 'sample-project'); fs.mkdirSync(folder);
execFileSync('git', ['init', '--quiet'], { cwd: folder, windowsHide: true });
execFileSync('git', ['remote', 'add', 'origin', 'https://github.com/example/sample-project.git'], { cwd: folder, windowsHide: true });
dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] });
const waitFor = async (win, expression) => {
    for (let i = 0; i < 100; i++) {
        if (await win.webContents.executeJavaScript(expression)) return;
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error(`UI condition timed out: ${expression}`);
};
app.whenReady().then(async () => {
    const win = await openWindow(store, false);
    await waitFor(win, "document.querySelector('#stat-accounts').textContent === '0'");
    assert.equal(await win.webContents.executeJavaScript('typeof require'), 'undefined');
    assert.equal(await win.webContents.executeJavaScript('typeof process'), 'undefined');
    await win.webContents.executeJavaScript("document.querySelector('[data-view=accounts]').click(); document.querySelector('.add-account').click(); document.querySelector('[name=displayName]').value='Example Personal'; document.querySelector('[name=githubUsername]').value='example-personal'; document.querySelector('[name=githubEmail]').value='personal@example.com'; document.querySelector('#account-form').requestSubmit(document.querySelector('[type=submit]'))");
    await waitFor(win, "document.querySelector('#stat-accounts').textContent === '1'");
    await win.webContents.executeJavaScript("document.querySelector('[data-view=projects]').click(); document.querySelector('#projects .add-project').click()");
    await waitFor(win, "document.querySelector('#stat-projects').textContent === '1'");
    await win.webContents.executeJavaScript("const select=document.querySelector('#project-list select'); select.selectedIndex=1; select.dispatchEvent(new Event('change'))");
    await waitFor(win, "document.querySelector('#stat-assigned').textContent === '1'");
    await win.webContents.executeJavaScript("document.querySelector('#project-list .quiet').click()");
    await waitFor(win, "document.querySelector('#context-dialog').open");
    const context = JSON.parse(await win.webContents.executeJavaScript("document.querySelector('#context-output').textContent"));
    assert.equal(context.account.username, 'example-personal'); assert.equal(context.authenticated, false);
    await assert.rejects(() => win.webContents.executeJavaScript("window.identity.addAccount({displayName:'Invalid',githubUsername:'invalid',githubEmail:'invalid@example.com',token:'secret'})"));
    await win.webContents.executeJavaScript("document.querySelector('#context-dialog').close(); document.querySelector('[data-view=overview]').click()");
    await waitFor(win, "!document.querySelector('#context-dialog').open && !document.querySelector('#overview').hidden");
    await new Promise(resolve => setTimeout(resolve, 250));
    const out = path.resolve(__dirname, '../.smoke'); fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'desktop-overview.png'), (await win.webContents.capturePage()).toPNG());
    assert.equal(new WorkspaceStore(store.file).read().projects[0].accountId, store.read().accounts[0].id);
    console.log('Desktop UI smoke passed: account form, native project chooser, assignment, safe agent context, IPC validation, renderer isolation and restart persistence.');
    win.destroy();
    const shared = { profiles: [{ id: 'existing', displayName: 'Existing VS Code account', githubUsername: 'example', githubEmail: 'example@example.com', authenticationMethod: 'BROWSER_OAUTH' }], mappings: [{ id: 'mapping', profileId: 'existing', pattern: folder, isPathPattern: true }], activeProfileId: 'existing', trusted: true, folders: [folder] };
    const connections = path.join(root, 'connections');
    const bridge = await startDesktopBridge('Sample VS Code workspace', async request => {
        if (request.action === 'browserLogin') shared.profiles.push({ ...shared.profiles[0], id: 'browser', displayName: 'Browser login account' });
        return shared;
    }, connections);
    try {
        const companion = await openWindow(store, false, new DesktopBridgeClient(connections));
        await waitFor(companion, "document.querySelector('#account-list').textContent.includes('Existing VS Code account')");
        assert.equal(await companion.webContents.executeJavaScript('typeof require'), 'undefined');
        const listed = await companion.webContents.executeJavaScript('window.identity.connections()');
        assert.deepEqual(Object.keys(listed[0]).sort(), ['id', 'label']);
        await companion.webContents.executeJavaScript("document.querySelector('[data-action=browserLogin]').click()");
        await waitFor(companion, "document.querySelector('#account-list').textContent.includes('Browser login account')");
        shared.profiles[0].displayName = 'Updated in VS Code';
        await companion.webContents.executeJavaScript("document.querySelector('#refresh').click()");
        await waitFor(companion, "document.querySelector('#account-list').textContent.includes('Updated in VS Code')");
        await assert.rejects(() => companion.webContents.executeJavaScript(`window.identity.extensionAction(${JSON.stringify(bridge.id)}, {action:'executeCommand'})`));
        fs.writeFileSync(path.join(out, 'companion-connected.png'), (await companion.webContents.capturePage()).toPNG());
        bridge.dispose();
        await companion.webContents.executeJavaScript("document.querySelector('#refresh').click()");
        await waitFor(companion, "!document.querySelector('#disconnected').hidden");
        assert.equal(await companion.webContents.executeJavaScript("document.querySelector('#account-list').textContent"), '');
        companion.destroy();
        console.log('Companion UI passed: existing accounts, browser action, shared refresh, no connection key in renderer, rejected commands and disconnect state.');
    } finally { bridge.dispose(); }
    app.exit(0);
}).catch(error => { console.error(error); app.exit(1); });
