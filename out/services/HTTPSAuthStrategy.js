"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HTTPSAuthStrategy = void 0;
const commandExecutor_1 = require("../utils/commandExecutor");
class HTTPSAuthStrategy {
    async configureHTTPSAuth(repoPath, profile, remoteUrl, token) {
        if (process.platform !== 'win32')
            throw new Error('Saved HTTPS authentication currently requires Windows and Git Credential Manager.');
        const url = new URL(remoteUrl);
        if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.port ||
            url.username || url.password || url.search || url.hash ||
            !/^\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/.test(url.pathname)) {
            throw new Error('Use a clean https://github.com/owner/repository.git remote for saved authentication.');
        }
        if (!/^[A-Za-z0-9-]+$/.test(profile.githubUsername) || (token !== undefined && !/^[A-Za-z0-9_]+$/.test(token))) {
            throw new Error('Invalid GitHub username or token.');
        }
        const options = { cwd: repoPath, timeout: 30000 };
        const manager = await commandExecutor_1.CommandExecutor.execute('git', ['credential-manager', '--version'], options);
        if (manager.exitCode !== 0)
            throw new Error('Git Credential Manager is required. Install it with Git for Windows, then retry.');
        // Reset inherited helpers for GitHub so plaintext helpers never receive the token.
        for (const args of [
            ['--replace-all', 'credential.https://github.com.helper', ''],
            ['--add', 'credential.https://github.com.helper', 'manager'],
            ['--replace-all', 'credential.https://github.com.useHttpPath', 'true'],
            ['--replace-all', 'credential.https://github.com.username', profile.githubUsername],
            ['--replace-all', 'credential.credentialStore', 'wincredman']
        ]) {
            const result = await commandExecutor_1.CommandExecutor.execute('git', ['config', '--local', ...args], options);
            if (result.exitCode !== 0)
                throw new Error('Could not configure repository authentication. Check repository write access and retry.');
        }
        if (token) {
            // Direct invocation avoids arbitrary configured helpers; secrets travel only via stdin.
            const result = await commandExecutor_1.CommandExecutor.execute('git', ['credential-manager', 'store'], {
                ...options,
                env: { ...process.env, GCM_CREDENTIAL_STORE: 'wincredman', GCM_INTERACTIVE: 'never', GCM_TRACE: '0', GCM_TRACE_SECRETS: '0' }
            }, `protocol=https\nhost=github.com\npath=${url.pathname.slice(1)}\nusername=${profile.githubUsername}\npassword=${token}\n\n`);
            if (result.exitCode !== 0)
                throw new Error('Git Credential Manager could not save the credential. Check GCM installation and Windows vault access. The project account assignment was not changed.');
        }
        return true;
    }
}
exports.HTTPSAuthStrategy = HTTPSAuthStrategy;
//# sourceMappingURL=HTTPSAuthStrategy.js.map