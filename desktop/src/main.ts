import { app, BrowserWindow, dialog, ipcMain, session } from 'electron';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { WorkspaceStore } from './workspace';
import { DesktopBridgeClient } from '../../src/services/DesktopBridge';

export async function openWindow(store: WorkspaceStore, show = true, companion?: DesktopBridgeClient): Promise<BrowserWindow> {
    const page = path.resolve(__dirname, companion ? '../../../ui/companion.html' : '../../../ui/index.html');
    const pageUrl = pathToFileURL(page).href;
    const window = new BrowserWindow({
        width: 1220, height: 840, minWidth: 820, minHeight: 620, show,
        title: 'Git Identity Manager', backgroundColor: '#f6f7f9',
        webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
    });
    window.setMenuBarVisibility(false);
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', event => event.preventDefault());
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    const snapshot = () => ({ ...store.read(), stateFile: store.file });
    const handlers: Record<string, (...args: any[]) => unknown> = companion ? {
        connections: () => companion.list(),
        extensionAction: (connection: unknown, request: unknown) => companion.call(connection, request)
    } : {
        snapshot,
        addAccount: (input: unknown) => { store.addAccount(input); return snapshot(); },
        addProject: async () => {
            const selected = await dialog.showOpenDialog(window, { title: 'Choose a Git project', properties: ['openDirectory'] });
            if (!selected.canceled && selected.filePaths[0]) await store.addProject(selected.filePaths[0]);
            return snapshot();
        },
        assign: (projectId: unknown, accountId: unknown) => { store.assign(projectId, accountId); return snapshot(); },
        remove: async (kind: unknown, id: unknown) => {
            if (kind !== 'account' && kind !== 'project') throw new Error('Unknown item type.');
            const result = await dialog.showMessageBox(window, {
                type: 'question', message: `Remove this ${kind} from the workspace?`,
                detail: kind === 'account' ? 'Its projects will become unassigned. Git credentials are not changed.' : 'Your project files and Git settings will stay in place.',
                buttons: ['Cancel', 'Remove'], defaultId: 0, cancelId: 0
            });
            if (result.response === 1) store.remove(kind, id);
            return snapshot();
        },
        context: async (projectId: unknown) => {
            const project = store.read().projects.find(p => p.id === projectId);
            if (!project) throw new Error('Project not found.');
            return store.context(project.rootPath);
        }
    };
    for (const [name, handler] of Object.entries(handlers)) {
        const channel = `identity:${name}`;
        ipcMain.removeHandler(channel);
        ipcMain.handle(channel, async (event, ...args: unknown[]) => {
            if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || event.senderFrame.url !== pageUrl) {
                throw new Error('Untrusted application request.');
            }
            try { return { ok: true, value: await handler(...args) }; }
            catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Operation failed.' }; }
        });
    }
    await window.loadFile(page);
    return window;
}

export function startApp(): void {
    app.setName('git-identity-desktop');
    if (!app.requestSingleInstanceLock()) app.quit();
    else {
        app.on('second-instance', () => {
            const window = BrowserWindow.getAllWindows()[0];
            if (window) { if (window.isMinimized()) window.restore(); window.focus(); }
        });
        app.whenReady().then(async () => {
            const store = new WorkspaceStore(path.join(app.getPath('userData'), 'workspace.json'));
            const companion = new DesktopBridgeClient();
            await openWindow(store, true, companion);
            app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) void openWindow(store, true, companion); });
        }).catch(() => { dialog.showErrorBox('Cannot start Git Identity Manager', 'The desktop window could not be opened. Check the application installation.'); app.quit(); });
        app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
    }
}
