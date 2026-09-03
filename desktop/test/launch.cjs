// Preload a check while Electron launches the real package entry point.
const { app } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

app.setPath('userData', fs.mkdtempSync(path.resolve(__dirname, '../.smoke-run-launch-')));
const timeout = setTimeout(() => {
    console.error('Package launch failed: no loaded desktop window within 15 seconds.');
    app.exit(1);
}, 15000);
app.on('browser-window-created', (_event, window) => {
    window.hide();
    window.webContents.once('did-finish-load', async () => {
        try {
            assert.equal(await window.webContents.executeJavaScript('typeof window.identity.snapshot'), 'function');
            assert.match(window.webContents.getURL(), /\/ui\/companion\.html$/);
            clearTimeout(timeout);
            console.log('Package launch passed: the real entry opened the desktop window and loaded its bridge.');
            app.exit(0);
        } catch (error) {
            console.error(error);
            app.exit(1);
        }
    });
});
