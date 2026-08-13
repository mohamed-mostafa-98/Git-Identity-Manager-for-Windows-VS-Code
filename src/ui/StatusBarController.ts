import * as vscode from 'vscode';
import { ProfileManager } from '../services/ProfileManager';

export class StatusBarController {
    private statusBarItem: vscode.StatusBarItem;
    private profileManager: ProfileManager;

    constructor(profileManager: ProfileManager) {
        this.profileManager = profileManager;
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100
        );
        this.statusBarItem.command = 'githubAccountManager.switchAccount';
        this.statusBarItem.tooltip = 'Click to switch GitHub Account Profile';
        this.update();
    }

    public update(): void {
        const activeProfile = this.profileManager.getActiveProfile();

        if (activeProfile) {
            this.statusBarItem.text = `$(github) GitHub: ${activeProfile.displayName}`;
            this.statusBarItem.backgroundColor = undefined;
            this.statusBarItem.tooltip = `Active Profile: ${activeProfile.displayName} (@${activeProfile.githubUsername})\nAuth: ${activeProfile.authenticationMethod}\nEmail: ${activeProfile.githubEmail}`;
        } else {
            this.statusBarItem.text = `$(github) GitHub: Select Account`;
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
            this.statusBarItem.tooltip = 'No active GitHub profile selected. Click to switch.';
        }

        this.statusBarItem.show();
    }

    public dispose(): void {
        this.statusBarItem.dispose();
    }
}
