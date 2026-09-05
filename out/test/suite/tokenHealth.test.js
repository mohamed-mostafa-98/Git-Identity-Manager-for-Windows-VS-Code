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
const TokenHealthService_1 = require("../../services/TokenHealthService");
const AccountProfile_1 = require("../../models/AccountProfile");
suite('Saved-token health check', () => {
    const profile = { id: 'work', displayName: 'Work', githubUsername: 'work', githubEmail: 'work@example.com', authenticationMethod: AccountProfile_1.AuthenticationMethod.HTTPS, createdAt: '', updatedAt: '' };
    const repo = { rootPath: 'test', remoteName: 'origin', remoteUrl: 'https://github.com/work/project.git', hostname: 'github.com', owner: 'work', repoName: 'project', isSSH: false };
    const response = (status, body = '', extra = {}) => ({ status, body, type: '', limited: false, sso: false, ...extra });
    async function run(responses, token = 'test_token', repository = repo) {
        const service = new TokenHealthService_1.TokenHealthService();
        const calls = [];
        service.request = async (host, route) => { calls.push(`${host}${route}`); assert.ok(responses.length, 'Unexpected request'); return responses.shift(); };
        const report = (await service.check(profile, token, repository)).join('\n');
        assert.ok(!report.includes('test_token'));
        return { report, calls };
    }
    test('stops on missing, invalid, expired or wrong-account tokens', async () => {
        const service = new TokenHealthService_1.TokenHealthService();
        assert.match((await service.check(profile, undefined, repo)).join(), /No saved token/);
        assert.match((await run([], 'bad token')).report, /invalid format/);
        assert.match((await run([response(401)])).report, /expired/);
        const mismatch = await run([response(200, '{"login":"someone-else"}')]);
        assert.match(mismatch.report, /Wrong account/);
        assert.strictEqual(mismatch.calls.length, 1);
    });
    test('distinguishes repository access, SSO and rate limits', async () => {
        for (const [result, expected] of [[response(404), /Repository unavailable/], [response(403), /Access denied/], [response(403, '', { sso: true }), /SSO/], [response(403, '', { limited: true }), /rate limit/]]) {
            const checked = await run([response(200, '{"login":"work"}'), result]);
            assert.match(checked.report, expected);
            assert.strictEqual(checked.calls.length, 2);
        }
    });
    test('checks actual Git push service instead of treating API access as write access', async () => {
        const denied = await run([response(200, '{"login":"work"}'), response(200, '{}'), response(403)]);
        assert.match(denied.report, /Contents: Read and write/);
        assert.strictEqual(denied.calls[2], 'github.com/work/project.git/info/refs?service=git-receive-pack');
        const accepted = await run([response(200, '{"login":"work"}'), response(200, '{}'), response(200, '', { type: 'application/x-git-receive-pack-advertisement' })]);
        assert.match(accepted.report, /endpoint accepts/);
        assert.match(accepted.report, /Branch rules/);
        assert.match(accepted.report, /different cached credential/);
        const html = await run([response(200, '{"login":"work"}'), response(200, '{}'), response(200, '', { type: 'text/html' })]);
        assert.match(html.report, /could not be verified/);
    });
    test('never sends token to a non-GitHub remote', async () => {
        const checked = await run([response(200, '{"login":"work"}')], 'test_token', { ...repo, hostname: 'example.com' });
        assert.strictEqual(checked.calls.length, 1);
        assert.match(checked.report, /No token was sent to the remote host/);
    });
});
//# sourceMappingURL=tokenHealth.test.js.map