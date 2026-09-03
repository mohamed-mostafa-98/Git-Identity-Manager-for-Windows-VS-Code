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
exports.DesktopBridgeClient = exports.startDesktopBridge = exports.bridgeRequest = exports.bridgeDirectory = void 0;
const http = __importStar(require("http"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const crypto_1 = require("crypto");
const bridgeDirectory = () => path.join(os.homedir(), '.git-identity-manager', 'connections');
exports.bridgeDirectory = bridgeDirectory;
const actions = ['snapshot', 'browserLogin', 'addAccount', 'saveToken', 'switchProfile', 'removeProfile', 'mapProject', 'removeMapping', 'sync', 'diagnostics', 'health', 'dashboard'];
function bridgeRequest(value) {
    const row = value;
    if (!row || typeof row !== 'object' || Array.isArray(row) ||
        Object.keys(row).some(key => !['action', 'id'].includes(key)) || !actions.includes(row.action) ||
        (row.id !== undefined && (typeof row.id !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(row.id)))) {
        throw new Error('Unsupported desktop action.');
    }
    if (['saveToken', 'switchProfile', 'removeProfile', 'removeMapping'].includes(row.action) !== (row.id !== undefined)) {
        throw new Error('Invalid action target.');
    }
    return row;
}
exports.bridgeRequest = bridgeRequest;
/** Local companion transport. GitHub credentials never enter this connection. */
async function startDesktopBridge(label, handle, directory = (0, exports.bridgeDirectory)()) {
    const key = (0, crypto_1.randomBytes)(32).toString('hex');
    let busy = false;
    const server = http.createServer((req, res) => {
        const reply = (status, body) => {
            res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
            res.end(JSON.stringify(body));
        };
        // No browser origins, cross-site calls, arbitrary paths or unauthenticated access.
        if (req.headers.origin || req.headers['sec-fetch-site'] || req.headers.authorization !== `Bearer ${key}` ||
            req.method !== 'POST' || req.url !== '/' || req.headers.host !== `127.0.0.1:${server.address().port}`) {
            reply(403, { error: 'Connection denied.' });
            req.resume();
            return;
        }
        let body = '';
        req.setEncoding('utf8');
        req.on('data', chunk => {
            body += chunk;
            if (body.length > 4096)
                req.destroy();
        });
        req.on('error', () => { });
        req.on('end', async () => {
            let request;
            try {
                request = bridgeRequest(JSON.parse(body));
            }
            catch {
                reply(400, { error: 'Unsupported desktop request.' });
                return;
            }
            const mutation = request.action !== 'snapshot';
            if (mutation && busy) {
                reply(409, { error: 'Finish the current action in VS Code first.' });
                return;
            }
            if (mutation)
                busy = true;
            try {
                reply(200, { value: await handle(request) });
            }
            catch {
                reply(500, { error: 'The action did not finish. Check VS Code for details, then refresh before retrying.' });
            }
            finally {
                if (mutation)
                    busy = false;
            }
        });
    });
    server.requestTimeout = 20000;
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const id = (0, crypto_1.randomUUID)();
    const file = path.join(directory, `${id}.json`);
    try {
        fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
        fs.writeFileSync(file, JSON.stringify({ version: 1, port: server.address().port, key, label }), { mode: 0o600, flag: 'wx' });
    }
    catch (error) {
        server.close();
        throw error;
    }
    return { id, dispose: () => { server.close(); server.closeAllConnections(); if (fs.existsSync(file))
            fs.unlinkSync(file); } };
}
exports.startDesktopBridge = startDesktopBridge;
class DesktopBridgeClient {
    constructor(directory = (0, exports.bridgeDirectory)()) {
        this.directory = directory;
    }
    connection(id) {
        if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id))
            throw new Error('Choose a VS Code window.');
        const file = path.join(this.directory, `${id}.json`);
        if (fs.statSync(file).size > 8192)
            throw new Error('Invalid connection.');
        const row = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (row.version !== 1 || !Number.isInteger(row.port) || row.port < 1 || row.port > 65535 ||
            !/^[a-f0-9]{64}$/.test(row.key) || typeof row.label !== 'string')
            throw new Error('Invalid connection.');
        return row;
    }
    async list() {
        if (!fs.existsSync(this.directory))
            return [];
        const results = await Promise.all(fs.readdirSync(this.directory).filter(file => /^[a-f0-9-]{36}\.json$/.test(file)).map(async (file) => {
            const id = file.slice(0, -5);
            try {
                const connection = this.connection(id);
                await this.call(id, { action: 'snapshot' }, 1500);
                return { id, label: connection.label };
            }
            catch {
                return undefined;
            }
        }));
        return results.filter((row) => !!row);
    }
    async call(id, input, timeout = 180000) {
        const request = bridgeRequest(input);
        let connection;
        try {
            connection = this.connection(id);
        }
        catch {
            throw new Error('VS Code is disconnected. Open its GitHub control panel and reconnect.');
        }
        return new Promise((resolve, reject) => {
            const req = http.request({ hostname: '127.0.0.1', port: connection.port, path: '/', method: 'POST',
                headers: { Authorization: `Bearer ${connection.key}`, 'Content-Type': 'application/json' } }, res => {
                let body = '';
                res.setEncoding('utf8');
                res.on('data', chunk => { body += chunk; if (body.length > 2 * 1024 * 1024)
                    res.destroy(new Error('Response too large.')); });
                res.on('error', () => reject(new Error('VS Code connection interrupted. Refresh before retrying.')));
                res.on('end', () => {
                    try {
                        const result = JSON.parse(body);
                        if (res.statusCode !== 200)
                            reject(new Error(result.error || 'VS Code action failed.'));
                        else
                            resolve(result.value);
                    }
                    catch {
                        reject(new Error('Invalid VS Code response.'));
                    }
                });
            });
            req.on('error', () => reject(new Error('VS Code connection unavailable. Reconnect and refresh before retrying.')));
            req.setTimeout(timeout, () => req.destroy());
            req.end(JSON.stringify(request));
        });
    }
}
exports.DesktopBridgeClient = DesktopBridgeClient;
//# sourceMappingURL=DesktopBridge.js.map