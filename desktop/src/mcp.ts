import * as readline from 'readline';
import { DesktopBridgeClient } from '../../src/services/DesktopBridge';

type Request = { jsonrpc: '2.0'; id?: string | number; method: string; params?: any };
const versions = new Set(['2024-11-05', '2025-03-26', '2025-06-18', '2025-11-25']);

export async function handle(request: Request, client = new DesktopBridgeClient()) {
    if (!request || request.jsonrpc !== '2.0' || typeof request.method !== 'string') throw new Error('Invalid JSON-RPC request.');
    if (request.method === 'initialize') return { protocolVersion: versions.has(request.params?.protocolVersion) ? request.params.protocolVersion : '2025-11-25', capabilities: { tools: {} }, serverInfo: { name: 'git-identity-manager', version: '0.3.0' } };
    if (request.method === 'ping') return {};
    if (request.method === 'tools/list') return { tools: [
        { name: 'list_vscode_windows', description: 'List local VS Code windows connected to Git Identity Manager.', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
        { name: 'get_repository_metadata', description: 'Read GitHub metadata for the mapped repository in a trusted VS Code window. Credentials never enter the MCP response.', inputSchema: { type: 'object', properties: { connectionId: { type: 'string', description: 'ID returned by list_vscode_windows.' } }, required: ['connectionId'], additionalProperties: false } }
    ] };
    if (request.method === 'tools/call') {
        const name = request.params?.name;
        const args = request.params?.arguments || {};
        try {
            const value = name === 'list_vscode_windows' ? await client.list() : name === 'get_repository_metadata' ? await client.call(args.connectionId, { action: 'agentRepository' }) : undefined;
            if (value === undefined) throw new Error('Unknown tool.');
            return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }], structuredContent: value };
        } catch (error) { return { content: [{ type: 'text', text: error instanceof Error ? error.message : 'Tool failed.' }], isError: true }; }
    }
    if (request.method.startsWith('notifications/')) return undefined;
    throw new Error('Method not found.');
}

if (require.main === module) {
    const lines = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
    lines.on('line', async line => {
        if (Buffer.byteLength(line) > 1024 * 1024) return;
        let request: Request;
        try { request = JSON.parse(line); } catch { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }) + '\n'); return; }
        if (request.id === undefined) { try { await handle(request); } catch { /* notifications have no response */ } return; }
        try { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: await handle(request) }) + '\n'); }
        catch (error) { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, error: { code: -32601, message: error instanceof Error ? error.message : 'Request failed.' } }) + '\n'); }
    });
}
