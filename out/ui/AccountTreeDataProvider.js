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
exports.MappingTreeItem = exports.RepoMappingsTreeProvider = exports.ProfileTreeItem = exports.AccountProfilesTreeProvider = void 0;
const vscode = __importStar(require("vscode"));
class AccountProfilesTreeProvider {
    constructor(profileManager) {
        this.profileManager = profileManager;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (!element) {
            const profiles = this.profileManager.getProfiles();
            const activeId = this.profileManager.getActiveProfileId();
            return Promise.resolve(profiles.map(p => new ProfileTreeItem(p, p.id === activeId)));
        }
        return Promise.resolve([]);
    }
}
exports.AccountProfilesTreeProvider = AccountProfilesTreeProvider;
class ProfileTreeItem extends vscode.TreeItem {
    constructor(profile, isActive) {
        super(profile.displayName, vscode.TreeItemCollapsibleState.None);
        this.profile = profile;
        this.isActive = isActive;
        this.description = `@${profile.githubUsername} (${profile.authenticationMethod})`;
        this.tooltip = `Email: ${profile.githubEmail}\nAuth: ${profile.authenticationMethod}\nCreated: ${new Date(profile.createdAt).toLocaleDateString()}`;
        this.iconPath = new vscode.ThemeIcon(isActive ? 'check' : 'account');
        this.contextValue = isActive ? 'profileItemActive' : 'profileItemInactive';
        this.command = {
            command: 'githubAccountManager.switchAccount',
            title: 'Switch Profile'
        };
    }
}
exports.ProfileTreeItem = ProfileTreeItem;
class RepoMappingsTreeProvider {
    constructor(profileManager) {
        this.profileManager = profileManager;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (!element) {
            const mappings = this.profileManager.getMappings();
            return Promise.resolve(mappings.map(m => {
                const profile = this.profileManager.getProfileById(m.profileId);
                const profileName = profile ? profile.displayName : 'Unknown Profile';
                return new MappingTreeItem(m, profileName);
            }));
        }
        return Promise.resolve([]);
    }
}
exports.RepoMappingsTreeProvider = RepoMappingsTreeProvider;
class MappingTreeItem extends vscode.TreeItem {
    constructor(mapping, profileName) {
        super(mapping.pattern, vscode.TreeItemCollapsibleState.None);
        this.mapping = mapping;
        this.profileName = profileName;
        this.description = `-> ${profileName} (${mapping.isPathPattern ? 'Folder' : 'Remote URL'})`;
        this.tooltip = `Pattern: ${mapping.pattern}\nProfile: ${profileName}\nType: ${mapping.isPathPattern ? 'Path Pattern' : 'Remote URL Pattern'}`;
        this.iconPath = new vscode.ThemeIcon(mapping.isPathPattern ? 'folder' : 'repo');
        this.contextValue = 'mappingItem';
        this.command = {
            command: 'githubAccountManager.openDashboard',
            title: 'Open Dashboard'
        };
    }
}
exports.MappingTreeItem = MappingTreeItem;
//# sourceMappingURL=AccountTreeDataProvider.js.map