import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as http from 'http';
import { DesktopBridgeClient, startDesktopBridge, bridgeRequest } from '../../services/DesktopBridge';

suite('Desktop companion transport', () => {
    test('authenticates local requests, isolates windows, reads fresh data and rejects browser/invalid requests', async () => {
        const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'identity-bridge-test-'));
        let name = 'Personal';
        let calls = 0;
        const first = await startDesktopBridge('Personal window', async request => {
            calls++;
            if (request.action === 'browserLogin') name = 'New account';
            return { name };
        }, directory);
        const second = await startDesktopBridge('Work window', async () => ({ name: 'Work' }), directory);
        try {
            const client = new DesktopBridgeClient(directory);
            const rows = await client.list();
            assert.strictEqual(rows.length, 2);
            assert.ok(rows.every(row => Object.keys(row).sort().join(',') === 'id,label'));
            assert.deepStrictEqual(await client.call(first.id, { action: 'browserLogin' }), { name: 'New account' });
            name = 'Edited in VS Code';
            assert.deepStrictEqual(await client.call(first.id, { action: 'snapshot' }), { name });
            assert.deepStrictEqual(await client.call(second.id, { action: 'snapshot' }), { name: 'Work' });
            for (const request of [{ action: 'executeCommand' }, { action: 'browserLogin', token: 'secret' }, { action: 'switchProfile' }, { action: 'snapshot', id: 'extra' }]) {
                assert.throws(() => bridgeRequest(request));
            }
            const connection = JSON.parse(fs.readFileSync(path.join(directory, `${first.id}.json`), 'utf8'));
            const denied = (headers: Record<string, string>) => new Promise<number>(resolve => {
                const req = http.request({ hostname: '127.0.0.1', port: connection.port, method: 'POST', headers }, res => { res.resume(); resolve(res.statusCode!); });
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
        } finally {
            first.dispose(); second.dispose(); fs.rmSync(directory, { recursive: true, force: true });
        }
    });
});
