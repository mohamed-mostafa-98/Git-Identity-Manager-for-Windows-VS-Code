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
exports.TokenHealthService = void 0;
const https = __importStar(require("https"));
const token_1 = require("../utils/token");
class TokenHealthService {
    request(host, route, token) {
        return new Promise((resolve, reject) => {
            const request = https.get({ hostname: host, path: route, headers: {
                    'User-Agent': 'Git-Identity-Manager',
                    Authorization: host === 'api.github.com' ? `Bearer ${token}` : `Basic ${Buffer.from(`x-access-token:${token}`).toString('base64')}`,
                    Accept: host === 'api.github.com' ? 'application/vnd.github+json' : 'application/x-git-receive-pack-advertisement'
                } }, response => {
                let body = '';
                response.setEncoding('utf8');
                response.on('data', chunk => {
                    // Only API JSON is needed. Git refs may be large and are never retained.
                    if (host === 'api.github.com')
                        body += chunk;
                    if (body.length > 1024 * 1024)
                        response.destroy(new Error('Response too large'));
                });
                response.on('error', () => reject(new Error('GitHub response interrupted. Retry the health check.')));
                response.on('end', () => resolve({ status: response.statusCode || 0, body,
                    type: String(response.headers['content-type'] || ''),
                    limited: response.headers['x-ratelimit-remaining'] === '0' || !!response.headers['retry-after'],
                    sso: String(response.headers['x-github-sso'] || '').includes('required') }));
            });
            const timeout = setTimeout(() => request.destroy(), 15000);
            request.on('close', () => clearTimeout(timeout));
            request.on('error', () => reject(new Error('Cannot reach GitHub. Check your network and retry; token validity is unknown.')));
        });
    }
    async check(profile, token, repository) {
        if (!token)
            return ['No saved token for this profile. Add a token or sign in with your browser, then retry.'];
        if (!(0, token_1.isValidToken)(token))
            return ['The saved token has an invalid format. Replace it.'];
        const failure = (response) => {
            if (response.limited || response.status === 429)
                return 'GitHub rate limit reached. Wait and retry; permissions are not determined.';
            if (response.sso)
                return 'GitHub requires organization SSO authorization for this token.';
            if (response.status === 401)
                return 'Token rejected: it may be expired, revoked or invalid. Replace it or sign in again.';
            if (response.status === 403)
                return 'Access denied (403). Check token repository selection, write permissions and organization policies.';
            if (response.status === 404)
                return 'Repository unavailable (404): it may not exist, or this token may lack access.';
            return `GitHub returned HTTP ${response.status}. Retry later; access could not be verified.`;
        };
        const user = await this.request('api.github.com', '/user', token);
        if (user.status !== 200)
            return [failure(user)];
        let login;
        try {
            login = JSON.parse(user.body).login;
        }
        catch { /* handled below */ }
        if (typeof login !== 'string' || !/^[A-Za-z0-9-]+$/.test(login))
            return ['GitHub returned an unexpected account response. Retry.'];
        if (login.toLowerCase() !== profile.githubUsername.toLowerCase())
            return [`Wrong account: token belongs to @${login}, but this profile expects @${profile.githubUsername}. Update the saved token.`];
        const lines = [`Token accepted for @${login}.`];
        if (!repository)
            return [...lines, 'Open a Git repository to check its access.'];
        if (repository.hostname !== 'github.com' || !/^[A-Za-z0-9_.-]+$/.test(repository.owner) || !/^[A-Za-z0-9_.-]+$/.test(repository.repoName)) {
            return [...lines, 'Repository checks support GitHub.com only. No token was sent to the remote host.'];
        }
        const name = `${repository.owner}/${repository.repoName}`;
        const repo = await this.request('api.github.com', `/repos/${name}`, token);
        if (repo.status !== 200)
            return [...lines, `${name}: ${failure(repo)}`];
        lines.push(`Repository metadata accessible: ${name}.`);
        // GET advertises the push service: no push, branch update or credential-store mutation.
        const push = await this.request('github.com', `/${name}.git/info/refs?service=git-receive-pack`, token);
        if (push.status === 200 && push.type.split(';')[0].trim() === 'application/x-git-receive-pack-advertisement') {
            lines.push('Git push endpoint accepts this saved token. No changes were pushed.');
        }
        else if (push.status === 200) {
            lines.push('Push access could not be verified: GitHub did not return a Git push-service response.');
        }
        else {
            lines.push(`Git push access: ${failure(push)}`, 'For fine-grained tokens, include this repository and Contents: Read and write. For classic tokens, check repository scopes.');
        }
        lines.push('Branch rules and workflow-file permissions may still reject a particular push.', 'This checks the extension’s saved token. Terminal Git may use a different cached credential; use “Switch Account Profile” to apply this token to the project.');
        if (repository.isSSH)
            lines.push('This repository uses SSH; terminal pushes use its SSH key, not this token.');
        return lines;
    }
    async repositoryMetadata(profile, token, repository) {
        if (!token || !(0, token_1.isValidToken)(token))
            throw new Error('This mapped account needs valid saved authentication.');
        if (repository.hostname !== 'github.com')
            throw new Error('Agent repository access supports GitHub.com only.');
        const user = await this.request('api.github.com', '/user', token);
        let login;
        try {
            login = JSON.parse(user.body).login;
        }
        catch { /* handled below */ }
        if (user.status !== 200 || typeof login !== 'string' || login.toLowerCase() !== profile.githubUsername.toLowerCase()) {
            throw new Error('The saved authentication does not match this project account.');
        }
        const response = await this.request('api.github.com', `/repos/${repository.owner}/${repository.repoName}`, token);
        if (response.status !== 200)
            throw new Error(`GitHub repository access failed with HTTP ${response.status}.`);
        let value;
        try {
            value = JSON.parse(response.body);
        }
        catch {
            throw new Error('GitHub returned invalid repository metadata.');
        }
        return {
            repository: String(value.full_name || `${repository.owner}/${repository.repoName}`),
            description: typeof value.description === 'string' ? value.description : null,
            private: value.private === true,
            defaultBranch: typeof value.default_branch === 'string' ? value.default_branch : null,
            permissions: value.permissions && typeof value.permissions === 'object' ? {
                pull: value.permissions.pull === true, triage: value.permissions.triage === true,
                push: value.permissions.push === true, maintain: value.permissions.maintain === true,
                admin: value.permissions.admin === true
            } : undefined,
            account: `@${login}`
        };
    }
}
exports.TokenHealthService = TokenHealthService;
//# sourceMappingURL=TokenHealthService.js.map