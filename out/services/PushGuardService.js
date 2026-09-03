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
exports.PushGuardService = void 0;
const vscode = __importStar(require("vscode"));
const AccountProfile_1 = require("../models/AccountProfile");
const logger_1 = require("../utils/logger");
class PushGuardService {
    constructor(profileManager, repoDetector, repoMapper, applyProfile) {
        this.applyProfile = applyProfile;
        this.profileManager = profileManager;
        this.repoDetector = repoDetector;
        this.repoMapper = repoMapper;
    }
    /**
     * Inspects current workspace repository and active account profile.
     * Triggers warning if active account profile does not match expected profile for repository.
     * @returns true if safe to proceed, false if push should be blocked/cancelled.
     */
    async validatePushSafety(repoPath) {
        const config = vscode.workspace.getConfiguration('githubAccountManager');
        const mode = config.get('pushGuardMode', AccountProfile_1.PushGuardMode.Warn);
        if (mode === AccountProfile_1.PushGuardMode.Disabled) {
            return true;
        }
        const repoDetails = await this.repoDetector.detectRepository(repoPath);
        if (!repoDetails)
            return true; // Non-git workspace, allow
        const expectedProfile = this.repoMapper.resolveProfileForRepository(repoDetails);
        if (!expectedProfile)
            return true; // No profile mapping configured
        const activeProfile = this.profileManager.getActiveProfile();
        if (!activeProfile || activeProfile.id !== expectedProfile.id) {
            const activeName = activeProfile ? activeProfile.displayName : 'None';
            const expectedName = expectedProfile.displayName;
            logger_1.Logger.warn(`Push Guard Mismatch! Active: ${activeName}, Expected: ${expectedName} for repo ${repoDetails.owner}/${repoDetails.repoName}`);
            const message = `⚠ GitHub Account Mismatch detected!\n\n` +
                `Repository (${repoDetails.owner}/${repoDetails.repoName}) expects account profile '${expectedName}', ` +
                `but current active profile is '${activeName}'.`;
            if (mode === AccountProfile_1.PushGuardMode.Strict) {
                const choice = await vscode.window.showErrorMessage(message, { modal: true }, `Switch to ${expectedName}`, 'Cancel Push');
                if (choice === `Switch to ${expectedName}`) {
                    await this.applyProfile(expectedProfile.id);
                    return true;
                }
                return false; // Block push
            }
            else {
                // Mode === Warn
                const choice = await vscode.window.showWarningMessage(message, `Switch to ${expectedName}`, 'Continue Anyway', 'Cancel Push');
                if (choice === `Switch to ${expectedName}`) {
                    await this.applyProfile(expectedProfile.id);
                    return true;
                }
                else if (choice === 'Continue Anyway') {
                    return true;
                }
                return false;
            }
        }
        return true;
    }
}
exports.PushGuardService = PushGuardService;
//# sourceMappingURL=PushGuardService.js.map