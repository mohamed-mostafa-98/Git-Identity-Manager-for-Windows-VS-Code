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
const RepositoryDetector_1 = require("../../services/RepositoryDetector");
suite('RepositoryDetector Test Suite', () => {
    const detector = new RepositoryDetector_1.RepositoryDetector();
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
//# sourceMappingURL=repoDetector.test.js.map