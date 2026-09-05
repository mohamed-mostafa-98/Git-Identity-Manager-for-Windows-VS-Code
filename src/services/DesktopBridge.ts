import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { randomBytes, randomUUID } from 'crypto';

export const bridgeDirectory = () => path.join(os.homedir(), '.git-identity-manager', 'connections');
const actions = ['snapshot', 'agentRepository', 'browserLogin', 'addAccount', 'saveToken', 'reauthenticate', 'switchProfile', 'removeProfile', 'mapProject', 'removeMapping', 'sync', 'diagnostics', 'health', 'dashboard'];
export type BridgeRequest = { action: string; id?: string };
type Connection = { version: 1; port: number; key: string; label: string };

export function bridgeRequest(value: unknown): BridgeRequest {
    const row = value as BridgeRequest;
    if (!row || typeof row !== 'object' || Array.isArray(row) ||
        Object.keys(row).some(key => !['action', 'id'].includes(key)) || !actions.includes(row.action) ||
        (row.id !== undefined && (typeof row.id !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(row.id)))) {
        throw new Error('Unsupported desktop action.');
    }
    if (['saveToken', 'reauthenticate', 'switchProfile', 'removeProfile', 'removeMapping'].includes(row.action) !== (row.id !== undefined)) {
        throw new Error('Invalid action target.');
    }
    return row;
}

/** Local companion transport. GitHub credentials never enter this connection. */
export async function startDesktopBridge(label: string, handle: (request: BridgeRequest) => Promise<unknown>, directory = bridgeDirectory()) {
    const key = randomBytes(32).toString('hex');
    let busy = false;
    const server = http.createServer((req, res) => {
        const reply = (status: number, body: unknown) => {
            res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
            res.end(JSON.stringify(body));
        };
        // No browser origins, cross-site calls, arbitrary paths or unauthenticated access.
        if (req.headers.origin || req.headers['sec-fetch-site'] || req.headers.authorization !== `Bearer ${key}` ||
            req.method !== 'POST' || req.url !== '/' || req.headers.host !== `127.0.0.1:${(server.address() as any).port}`) {
            reply(403, { error: 'Connection denied.' }); req.resume(); return;
        }
        let body = '';
        req.setEncoding('utf8');
        req.on('data', chunk => {
            body += chunk;
            if (body.length > 4096) req.destroy();
        });
        req.on('error', () => {});
        req.on('end', async () => {
            let request: BridgeRequest;
            try { request = bridgeRequest(JSON.parse(body)); }
            catch { reply(400, { error: 'Unsupported desktop request.' }); return; }
            const mutation = !['snapshot', 'agentRepository'].includes(request.action);
            if (mutation && busy) { reply(409, { error: 'Finish the current action in VS Code first.' }); return; }
            if (mutation) busy = true;
            try { reply(200, { value: await handle(request) }); }
            catch { reply(500, { error: 'The action did not finish. Check VS Code for details, then refresh before retrying.' }); }
            finally { if (mutation) busy = false; }
        });
    });
    server.requestTimeout = 20000;
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const id = randomUUID();
    const file = path.join(directory, `${id}.json`);
    try {
        fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
        fs.writeFileSync(file, JSON.stringify({ version: 1, port: (server.address() as any).port, key, label }), { mode: 0o600, flag: 'wx' });
    } catch (error) { server.close(); throw error; }
    return { id, dispose: () => { server.close(); server.closeAllConnections(); if (fs.existsSync(file)) fs.unlinkSync(file); } };
}

export class DesktopBridgeClient {
    constructor(private directory = bridgeDirectory()) {}
    private connection(id: unknown): Connection {
        if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id)) throw new Error('Choose a VS Code window.');
        const file = path.join(this.directory, `${id}.json`);
        if (fs.statSync(file).size > 8192) throw new Error('Invalid connection.');
        const row = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (row.version !== 1 || !Number.isInteger(row.port) || row.port < 1 || row.port > 65535 ||
            !/^[a-f0-9]{64}$/.test(row.key) || typeof row.label !== 'string') throw new Error('Invalid connection.');
        return row;
    }
    async list() {
        if (!fs.existsSync(this.directory)) return [];
        const results = await Promise.all(fs.readdirSync(this.directory).filter(file => /^[a-f0-9-]{36}\.json$/.test(file)).map(async file => {
            const id = file.slice(0, -5);
            try {
                const connection = this.connection(id);
                await this.call(id, { action: 'snapshot' }, 1500);
                return { id, label: connection.label };
            } catch { return undefined; }
        }));
        return results.filter((row): row is { id: string; label: string } => !!row);
    }
    async call(id: unknown, input: unknown, timeout = 180000): Promise<unknown> {
        const request = bridgeRequest(input);
        let connection: Connection;
        try { connection = this.connection(id); }
        catch { throw new Error('VS Code is disconnected. Open its GitHub control panel and reconnect.'); }
        return new Promise((resolve, reject) => {
            const req = http.request({ hostname: '127.0.0.1', port: connection.port, path: '/', method: 'POST',
                headers: { Authorization: `Bearer ${connection.key}`, 'Content-Type': 'application/json' } }, res => {
                let body = '';
                res.setEncoding('utf8');
                res.on('data', chunk => { body += chunk; if (body.length > 2 * 1024 * 1024) res.destroy(new Error('Response too large.')); });
                res.on('error', () => reject(new Error('VS Code connection interrupted. Refresh before retrying.')));
                res.on('end', () => {
                    try {
                        const result = JSON.parse(body);
                        if (res.statusCode !== 200) reject(new Error(result.error || 'VS Code action failed.'));
                        else resolve(result.value);
                    } catch { reject(new Error('Invalid VS Code response.')); }
                });
            });
            req.on('error', () => reject(new Error('VS Code connection unavailable. Reconnect and refresh before retrying.')));
            req.setTimeout(timeout, () => req.destroy());
            req.end(JSON.stringify(request));
        });
    }
}
