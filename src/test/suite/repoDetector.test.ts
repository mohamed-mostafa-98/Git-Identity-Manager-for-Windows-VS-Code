import * as assert from 'assert';
import { RepositoryDetector } from '../../services/RepositoryDetector';

suite('RepositoryDetector Test Suite', () => {
    const detector = new RepositoryDetector();

    test('Parses HTTPS remote URLs correctly', () => {
        const parsed = detector.parseRemoteUrl('C:\\Repo', 'origin', 'https://github.com/mohammed/personal-app.git');
        assert.ok(parsed);
        assert.strictEqual(parsed?.hostname, 'github.com');
        assert.strictEqual(parsed?.owner, 'mohammed');
        assert.strictEqual(parsed?.repoName, 'personal-app');
        assert.strictEqual(parsed?.isSSH, false);
    });

    test('Parses SCP-style SSH remote URLs correctly', () => {
        const parsed = detector.parseRemoteUrl('C:\\Repo', 'origin', 'git@github.com-work:company/payment-system.git');
        assert.ok(parsed);
        assert.strictEqual(parsed?.hostname, 'github.com');
        assert.strictEqual(parsed?.owner, 'company');
        assert.strictEqual(parsed?.repoName, 'payment-system');
        assert.strictEqual(parsed?.isSSH, true);
        assert.strictEqual(parsed?.sshHostAlias, 'github.com-work');
    });

    test('Parses SSH URL format correctly', () => {
        const parsed = detector.parseRemoteUrl('C:\\Repo', 'origin', 'ssh://git@github.com-client/client/backend.git');
        assert.ok(parsed);
        assert.strictEqual(parsed?.owner, 'client');
        assert.strictEqual(parsed?.repoName, 'backend');
        assert.strictEqual(parsed?.sshHostAlias, 'github.com-client');
    });
});
