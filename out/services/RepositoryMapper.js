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
exports.RepositoryMapper = void 0;
const path = __importStar(require("path"));
const logger_1 = require("../utils/logger");
class RepositoryMapper {
    constructor(profileManager) {
        this.profileManager = profileManager;
    }
    /**
     * Finds the matching AccountProfile for a given repository.
     * Evaluates:
     * 1. Direct path mappings (e.g. C:\Projects\Work)
     * 2. Remote URL / Organization pattern mappings (e.g. github.com/company/* or owner name)
     * 3. Owner matching by GitHub username
     */
    resolveProfileForRepository(repo) {
        const mappings = this.profileManager.getMappings();
        const normalizedRepoPath = path.normalize(repo.rootPath).toLowerCase();
        // 1. Check direct folder path mappings
        for (const mapping of [...mappings].sort((a, b) => b.pattern.length - a.pattern.length)) {
            if (mapping.isPathPattern) {
                const normalizedPattern = path.normalize(mapping.pattern).toLowerCase();
                const relative = path.relative(normalizedPattern, normalizedRepoPath);
                if (relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))) {
                    const profile = this.profileManager.getProfileById(mapping.profileId);
                    if (profile) {
                        logger_1.Logger.info(`Mapped repo path '${repo.rootPath}' to profile '${profile.displayName}' via path pattern '${mapping.pattern}'`);
                        return profile;
                    }
                }
            }
        }
        // 2. Check Remote URL / Org patterns (e.g. "github.com/company/*" or "company")
        const fullRepoSpec = `${repo.hostname}/${repo.owner}/${repo.repoName}`.toLowerCase();
        for (const mapping of mappings) {
            if (!mapping.isPathPattern) {
                const pattern = mapping.pattern.toLowerCase().trim();
                const escaped = pattern.split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*');
                if (new RegExp(`^${escaped}$`).test(fullRepoSpec) ||
                    repo.owner.toLowerCase() === pattern ||
                    pattern === `${repo.hostname}/${repo.owner}`.toLowerCase()) {
                    const profile = this.profileManager.getProfileById(mapping.profileId);
                    if (profile) {
                        logger_1.Logger.info(`Mapped repo remote '${repo.remoteUrl}' to profile '${profile.displayName}' via URL pattern '${mapping.pattern}'`);
                        return profile;
                    }
                }
            }
        }
        // 3. Fallback: Check if repository owner matches a profile's githubUsername directly
        const profiles = this.profileManager.getProfiles();
        const usernameMatch = profiles.find(p => p.githubUsername.toLowerCase() === repo.owner.toLowerCase());
        if (usernameMatch) {
            logger_1.Logger.info(`Automatically matched repo owner '${repo.owner}' to profile '${usernameMatch.displayName}'`);
            return usernameMatch;
        }
        return undefined;
    }
}
exports.RepositoryMapper = RepositoryMapper;
//# sourceMappingURL=RepositoryMapper.js.map