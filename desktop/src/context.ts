import * as path from 'path';
import { WorkspaceStore } from './workspace';

async function main() {
    const args = process.argv.slice(2);
    if (args.length !== 4 || args[0] !== '--state' || args[2] !== '--project' || !path.isAbsolute(args[1]) || !path.isAbsolute(args[3])) {
        throw new Error('Usage: node context.js --state <absolute workspace.json path> --project <absolute repository path>');
    }
    const context = await new WorkspaceStore(args[1]).context(args[3]);
    process.stdout.write(JSON.stringify(context, null, 2) + '\n');
}
main().catch(error => { process.stderr.write((error instanceof Error ? error.message : 'Context lookup failed.') + '\n'); process.exitCode = 1; });
