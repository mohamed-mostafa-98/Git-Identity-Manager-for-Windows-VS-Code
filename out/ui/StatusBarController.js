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
exports.StatusBarController = void 0;
const vscode = __importStar(require("vscode"));
class StatusBarController {
    constructor(profileManager) {
        this.profileManager = profileManager;
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.statusBarItem.command = 'githubAccountManager.switchAccount';
        this.statusBarItem.tooltip = 'Click to switch GitHub Account Profile';
        this.update();
    }
    update() {
        const activeProfile = this.profileManager.getActiveProfile();
        if (activeProfile) {
            this.statusBarItem.text = `$(github) GitHub: ${activeProfile.displayName}`;
            this.statusBarItem.backgroundColor = undefined;
            this.statusBarItem.tooltip = `Active Profile: ${activeProfile.displayName} (@${activeProfile.githubUsername})\nAuth: ${activeProfile.authenticationMethod}\nEmail: ${activeProfile.githubEmail}`;
        }
        else {
            this.statusBarItem.text = `$(github) GitHub: Select Account`;
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
            this.statusBarItem.tooltip = 'No active GitHub profile selected. Click to switch.';
        }
        this.statusBarItem.show();
    }
    dispose() {
        this.statusBarItem.dispose();
    }
}
exports.StatusBarController = StatusBarController;
//# sourceMappingURL=StatusBarController.js.map