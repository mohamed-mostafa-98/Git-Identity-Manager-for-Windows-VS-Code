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
const assert = __importStar(require("assert"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const http = __importStar(require("http"));
const DesktopBridge_1 = require("../../services/DesktopBridge");
suite('Desktop companion transport', () => {
    test('authenticates local requests, isolates windows, reads fresh data and rejects browser/invalid requests', async () => {
        const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'identity-bridge-test-'));
        let name = 'Personal';
        let calls = 0;
        const first = await (0, DesktopBridge_1.startDesktopBridge)('Personal window', async (request) => {
            calls++;
            if (request.action === 'browserLogin')
                name = 'New account';
            return { name };
        }, directory);
        const second = await (0, DesktopBridge_1.startDesktopBridge)('Work window', async () => ({ name: 'Work' }), directory);
        try {
            const client = new DesktopBridge_1.DesktopBridgeClient(directory);
            const rows = await client.list();
            assert.strictEqual(rows.length, 2);
            assert.ok(rows.every(row => Object.keys(row).sort().join(',') === 'id,label'));
            assert.deepStrictEqual(await client.call(first.id, { action: 'browserLogin' }), { name: 'New account' });
            name = 'Edited in VS Code';
            assert.deepStrictEqual(await client.call(first.id, { action: 'snapshot' }), { name });
            assert.deepStrictEqual(await client.call(second.id, { action: 'snapshot' }), { name: 'Work' });
            assert.deepStrictEqual(await client.call(second.id, { action: 'agentRepository' }), { name: 'Work' });
            for (const request of [{ action: 'executeCommand' }, { action: 'browserLogin', token: 'secret' }, { action: 'switchProfile' }, { action: 'snapshot', id: 'extra' }]) {
                assert.throws(() => (0, DesktopBridge_1.bridgeRequest)(request));
            }
            const connection = JSON.parse(fs.readFileSync(path.join(directory, `${first.id}.json`), 'utf8'));
            const denied = (headers) => new Promise(resolve => {
                const req = http.request({ hostname: '127.0.0.1', port: connection.port, method: 'POST', headers }, res => { res.resume(); resolve(res.statusCode); });
                req.end(JSON.stringify({ action: 'snapshot' }));
            });
            const before = calls;
            assert.strictEqual(await denied({}), 403);
            assert.strictEqual(await denied({ Authorization: 'Bearer wrong' }), 403);
            assert.strictEqual(await denied({ Authorization: `Bearer ${connection.key}`, Origin: 'https://example.com' }), 403);
            assert.strictEqual(calls, before);
            first.dispose();
            assert.strictEqual((await client.list()).length, 1);
            await assert.rejects(() => client.call(first.id, { action: 'snapshot' }), /disconnected/);
        }
        finally {
            first.dispose();
            second.dispose();
            fs.rmSync(directory, { recursive: true, force: true });
        }
    });
});
//# sourceMappingURL=desktopBridge.test.js.map