import { DesktopBridgeClient } from '../../src/services/DesktopBridge';

async function main() {
    const args = process.argv.slice(2);
    if (args.length !== 2 || args[0] !== '--connection') throw new Error('Usage: npm run agent:repo -- --connection <VS Code connection ID>');
    const value = await new DesktopBridgeClient().call(args[1], { action: 'agentRepository' });
    process.stdout.write(JSON.stringify(value, null, 2) + '\n');
}

main().catch(error => { process.stderr.write((error instanceof Error ? error.message : 'Agent repository lookup failed.') + '\n'); process.exitCode = 1; });
