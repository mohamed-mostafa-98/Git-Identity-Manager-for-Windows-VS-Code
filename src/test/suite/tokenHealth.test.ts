import * as assert from 'assert';
import { TokenHealthService } from '../../services/TokenHealthService';
import { AuthenticationMethod, AccountProfile } from '../../models/AccountProfile';
import { RepositoryDetails } from '../../services/RepositoryDetector';

suite('Saved-token health check', () => {
    const profile: AccountProfile = { id: 'work', displayName: 'Work', githubUsername: 'work', githubEmail: 'work@example.com', authenticationMethod: AuthenticationMethod.HTTPS, createdAt: '', updatedAt: '' };
    const repo: RepositoryDetails = { rootPath: 'test', remoteName: 'origin', remoteUrl: 'https://github.com/work/project.git', hostname: 'github.com', owner: 'work', repoName: 'project', isSSH: false };
    const response = (status: number, body = '', extra = {}) => ({ status, body, type: '', limited: false, sso: false, ...extra });
    async function run(responses: unknown[], token: string | undefined = 'test_token', repository: RepositoryDetails | undefined = repo) {
        const service = new TokenHealthService();
        const calls: string[] = [];
        (service as any).request = async (host: string, route: string) => { calls.push(`${host}${route}`); assert.ok(responses.length, 'Unexpected request'); return responses.shift(); };
        const report = (await service.check(profile, token, repository)).join('\n');
        assert.ok(!report.includes('test_token'));
        return { report, calls };
    }
    test('stops on missing, invalid, expired or wrong-account tokens', async () => {
        const service = new TokenHealthService();
        assert.match((await service.check(profile, undefined, repo)).join(), /No saved token/);
        assert.match((await run([], 'bad token')).report, /invalid format/);
        assert.match((await run([response(401)])).report, /expired/);
        const mismatch = await run([response(200, '{"login":"someone-else"}')]);
        assert.match(mismatch.report, /Wrong account/); assert.strictEqual(mismatch.calls.length, 1);
    });
    test('distinguishes repository access, SSO and rate limits', async () => {
        for (const [result, expected] of [[response(404), /Repository unavailable/], [response(403), /Access denied/], [response(403, '', { sso: true }), /SSO/], [response(403, '', { limited: true }), /rate limit/]] as const) {
            const checked = await run([response(200, '{"login":"work"}'), result]);
            assert.match(checked.report, expected); assert.strictEqual(checked.calls.length, 2);
        }
    });
    test('checks actual Git push service instead of treating API access as write access', async () => {
        const denied = await run([response(200, '{"login":"work"}'), response(200, '{}'), response(403)]);
        assert.match(denied.report, /Contents: Read and write/);
        assert.strictEqual(denied.calls[2], 'github.com/work/project.git/info/refs?service=git-receive-pack');
        const accepted = await run([response(200, '{"login":"work"}'), response(200, '{}'), response(200, '', { type: 'application/x-git-receive-pack-advertisement' })]);
        assert.match(accepted.report, /endpoint accepts/); assert.match(accepted.report, /Branch rules/); assert.match(accepted.report, /different cached credential/);
        const html = await run([response(200, '{"login":"work"}'), response(200, '{}'), response(200, '', { type: 'text/html' })]);
        assert.match(html.report, /could not be verified/);
    });
    test('never sends token to a non-GitHub remote', async () => {
        const checked = await run([response(200, '{"login":"work"}')], 'test_token', { ...repo, hostname: 'example.com' });
        assert.strictEqual(checked.calls.length, 1); assert.match(checked.report, /No token was sent to the remote host/);
    });
});
