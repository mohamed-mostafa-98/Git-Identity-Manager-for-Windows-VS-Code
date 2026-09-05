"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAgentApproval = exports.agentApprovalKey = void 0;
const crypto_1 = require("crypto");
function agentApprovalKey(repository, profile) {
    return (0, crypto_1.createHash)('sha256').update(JSON.stringify([
        repository.rootPath, repository.remoteName, repository.remoteUrl,
        profile.id, profile.githubUsername, profile.authenticationMethod
    ])).digest('hex');
}
exports.agentApprovalKey = agentApprovalKey;
function requireAgentApproval(approved, current) {
    if (approved !== current)
        throw new Error('AI-agent access is disabled for this repository/account. Use GitHub: Manage AI Agent Access in VS Code.');
}
exports.requireAgentApproval = requireAgentApproval;
//# sourceMappingURL=AgentApproval.js.map