/**
 * Authentication strategy supported per profile.
 */
export enum AuthenticationMethod {
    BROWSER_OAUTH = 'BROWSER_OAUTH',
    HTTPS = 'HTTPS',
    SSH = 'SSH',
    GITHUB_CLI = 'GITHUB_CLI'
}

/**
 * Account Push Guard warning mode.
 */
export enum PushGuardMode {
    Warn = 'Warn',
    Strict = 'Strict',
    Disabled = 'Disabled'
}

/**
 * GitHub Account Profile metadata.
 * NOTE: Credentials/Secrets MUST NEVER be stored in this structure.
 */
export interface AccountProfile {
    id: string;
    displayName: string;
    githubUsername: string;
    githubEmail: string;
    authenticationMethod: AuthenticationMethod;
    sshProfileHostAlias?: string;
    sshKeyPath?: string;
    createdAt: string;
    updatedAt: string;
    lastUsedAt?: string;
}

/**
 * Binding rule mapping a repository remote URL pattern or local path to a profile ID.
 */
export interface RepositoryMapping {
    id: string;
    profileId: string;
    pattern: string; // e.g. "github.com/company/*" or "C:\\Projects\\WorkApp"
    isPathPattern: boolean; // true if matching folder path, false if matching remote URL
    createdAt: string;
}

/**
 * Health status of an account profile.
 */
export interface AccountHealthStatus {
    profileId: string;
    username: string;
    isGitIdentityValid: boolean;
    isAuthValid: boolean;
    authMethod: AuthenticationMethod;
    details: string[];
}
