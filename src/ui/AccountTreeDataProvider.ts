import * as vscode from 'vscode';
import { ProfileManager } from '../services/ProfileManager';
import { AccountProfile, RepositoryMapping } from '../models/AccountProfile';

export class AccountProfilesTreeProvider implements vscode.TreeDataProvider<ProfileTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ProfileTreeItem | undefined | null | void> = new vscode.EventEmitter<ProfileTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ProfileTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private profileManager: ProfileManager) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ProfileTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: ProfileTreeItem): Thenable<ProfileTreeItem[]> {
        if (!element) {
            const profiles = this.profileManager.getProfiles();
            const activeId = this.profileManager.getActiveProfileId();

            return Promise.resolve(
                profiles.map(p => new ProfileTreeItem(p, p.id === activeId))
            );
        }
        return Promise.resolve([]);
    }
}

export class ProfileTreeItem extends vscode.TreeItem {
    constructor(
        public readonly profile: AccountProfile,
        public readonly isActive: boolean
    ) {
        super(profile.displayName, vscode.TreeItemCollapsibleState.None);

        this.description = `@${profile.githubUsername} (${profile.authenticationMethod})`;
        this.tooltip = `Email: ${profile.githubEmail}\nAuth: ${profile.authenticationMethod}\nCreated: ${new Date(profile.createdAt).toLocaleDateString()}`;
        this.iconPath = new vscode.ThemeIcon(isActive ? 'check' : 'account');
        this.contextValue = 'profileItem';
    }
}

export class RepoMappingsTreeProvider implements vscode.TreeDataProvider<MappingTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<MappingTreeItem | undefined | null | void> = new vscode.EventEmitter<MappingTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<MappingTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private profileManager: ProfileManager) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: MappingTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: MappingTreeItem): Thenable<MappingTreeItem[]> {
        if (!element) {
            const mappings = this.profileManager.getMappings();
            return Promise.resolve(
                mappings.map(m => {
                    const profile = this.profileManager.getProfileById(m.profileId);
                    const profileName = profile ? profile.displayName : 'Unknown Profile';
                    return new MappingTreeItem(m, profileName);
                })
            );
        }
        return Promise.resolve([]);
    }
}

export class MappingTreeItem extends vscode.TreeItem {
    constructor(
        public readonly mapping: RepositoryMapping,
        public readonly profileName: string
    ) {
        super(mapping.pattern, vscode.TreeItemCollapsibleState.None);

        this.description = `-> ${profileName} (${mapping.isPathPattern ? 'Folder' : 'Remote URL'})`;
        this.tooltip = `Pattern: ${mapping.pattern}\nProfile: ${profileName}\nType: ${mapping.isPathPattern ? 'Path Pattern' : 'Remote URL Pattern'}`;
        this.iconPath = new vscode.ThemeIcon(mapping.isPathPattern ? 'folder' : 'repo');
        this.contextValue = 'mappingItem';
    }
}
