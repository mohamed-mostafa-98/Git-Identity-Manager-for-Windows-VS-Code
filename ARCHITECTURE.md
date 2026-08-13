# Architecture Specification: GitHub Account & Git Identity Manager

## System Overview

The **GitHub Account & Git Identity Manager** acts as a lightweight orchestration engine sitting between the developer's IDE (VS Code), local Git binaries, OpenSSH client, Git Credential Manager (GCM), and GitHub Cloud.

```text
+-----------------------------------------------------------------------------------+
|                                  VS Code Editor                                   |
|                                                                                   |
|  +--------------------------+    +---------------------------------------------+  |
|  | Status Bar: "Work" (GCM) |    | Commands: Switch Account, Diagnostics, etc. |  |
|  +--------------+-----------+    +----------------------+----------------------+  |
+-----------------|---------------------------------------|-------------------------+
                  |                                       |
                  v                                       v
+-----------------------------------------------------------------------------------+
|                        Core Orchestration Engine (Extension)                      |
|                                                                                   |
|  1. Workspace Observer: Reads Remote URL (e.g. git@github.com-work:company/app)   |
|  2. Account Profiler: Matches Remote / Folder to Profile ("Work")                 |
|  3. Push Guard: Verifies Active Account == Target Account before git operations   |
+-----------------+---------------------------------------+-------------------------+
                  |                                       |
       +----------+--------------------+                  |
       | HTTPS Auth Path               | SSH Auth Path    | Git Identity Path
       v                               v                  v
+------------------------+   +-------------------+   +------------------------------+
| Git Credential Manager |   | OpenSSH Config    |   | Git Local Config / includeIf |
| credential.useHttpPath |   | Host Aliases      |   | user.name = "Mohammed Work"  |
| credential.username    |   | IdentityFile      |   | user.email = "work@co.com"   |
| Windows Credential Mgr |   | ~/.ssh/config     |   | .git/config                  |
+------------------------+   +-------------------+   +------------------------------+
       |                               |                          |
       +-------------------------------+--------------------------+
                                       |
                                       v
                             +-------------------+
                             |  Git Engine &     |
                             |  GitHub Remote    |
                             +-------------------+
```

---

## Architectural Principles

1. **Native Primitives First**: Do NOT replace Git, OpenSSH, or GCM. Leverage `credential.useHttpPath`, OpenSSH `Host` aliases, and local `user.name`/`user.email` git config keys.
2. **Metadata / Credential Separation**: Profile metadata (display name, email, auth strategy) is persisted in VS Code global state. Secrets (OAuth tokens, PATs) are managed exclusively by OS-level secure stores (Windows Credential Manager / VS Code SecretStorage).
3. **Zero Untrusted Repo Script Execution**: Never execute scripts or binaries supplied inside cloned workspace repositories.
4. **Push Protection**: Provide a guard layer that validates active identity against repo mapping before push operations.

---

## Component Architecture

- `ProfileManager`: Persists profile metadata and repository bindings.
- `SecretStorageService`: Wraps VS Code `ExtensionContext.secrets` for Windows DPAPI token encryption.
- `RepositoryDetector`: Inspects Git workspace remotes and parses HTTPS / SSH remote URLs.
- `RepositoryMapper`: Resolves target profile for folder paths and remote URLs.
- `GitIdentityManager`: Updates `.git/config` local `user.name` and `user.email`.
- `HTTPSAuthStrategy`: Sets `credential.useHttpPath = true` and `credential.username` for GCM isolation.
- `SSHAuthStrategy`: Maintains OpenSSH `~/.ssh/config` Host blocks.
- `PushGuardService`: Prevents pushing with mismatched accounts.
- `DiagnosticsService`: Produces non-sensitive environment diagnostics.
