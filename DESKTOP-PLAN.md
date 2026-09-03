# Desktop app and account-aware AI access

## Revised direction: shared application
The user clarified that the desktop must use the existing extension data and capabilities. Desktop v0.2.0 therefore connects to extension v1.2.0 through a local authenticated companion bridge. VS Code remains the source of truth for profiles, mapping rules, browser OAuth and secure token storage. The independent M1 registry is retained only for legacy tests/CLI. VS Code must stay open; standalone authentication and real cross-platform/account verification are still pending. The milestones below describe the original roadmap; this shared-data decision supersedes migration to an independent desktop registry.

## Outcome
An open-source desktop application that visualizes GitHub accounts, local projects, their assignments and authentication health. Git operations and AI tools select credentials from the project's explicit assignment, never from a machine-wide active account.

## Stack and tradeoff
Electron + TypeScript + native HTML/CSS, Node.js built-ins for local metadata, Git/GCM for Git integration, and an MCP stdio server for compatible AI clients. Electron is MIT licensed and supports Windows/macOS/Linux. Reuse the existing TypeScript models and Git inspection rather than rewriting in Rust or adding a web framework. Electron has a larger runtime footprint; that is the tradeoff for a single-language implementation. Native credentials stay in a privileged process. Future Linux vault support must reject Electron's basic_text fallback rather than save plaintext.

## Milestones (in order)
1. Desktop workspace and explicit account context: runnable desktop window, local account metadata, add/inspect Git repositories, persistent project-account assignments, honest auth-not-connected state, and a read-only agent-context command with no token output. Automated data/routing tests and Windows UI smoke test. This is the first implementation slice.
2. Secure cross-platform authentication: account-verified PAT/OAuth onboarding, OS-backed credential storage, expiry/revocation handling, per-repository Git application, secure opt-in extension migration and cross-window consistency. Validate two real accounts on supported operating systems; never auto-import SecretStorage internals.
3. Authenticated agent connector: MCP tools and CLI select an approved project/account per request; begin with account status, repository metadata and pull-request reads. Add explicit authorized writes later. No token-returning tool, arbitrary URL tool or global gh auth switch. Verify concurrent account A/B isolation and fail closed for missing assignments or permission.
4. Workflow actions and release: per-project workflow-run visualization, explicit run/retry/cancel controls, approval-aware writes, Windows/macOS/Linux build/test matrix, packaged installers, accessibility and security regression checks.

## What we do first
Build the desktop account/project registry and prove deterministic account routing before adding a credential vault. Milestone 1 stores only allowlisted metadata. Its assignments do not yet configure Git credentials or grant agent GitHub access. The existing v1.1.0 VS Code authentication continues to work independently until secure migration is delivered in milestone 2.

## Security boundaries
Sandboxed renderer, context isolation, narrow IPC with sender and payload validation, local assets only, no exposed filesystem/shell bridge, no token output. Canonical repository paths and remotes are checked on use; stale/remapped projects must not silently authorize a different repository. Secrets stay out of JSON metadata, command arguments, logs and exports. Credentials are account-scoped and authorization is repository/operation-scoped. Agent token access requires a supported local connector; existing hosted GitHub connectors cannot be silently reconfigured by this application.

## Testing and delivery
Each milestone has runnable acceptance tests and a Linear completion update. Windows is locally available; macOS/Linux runtime checks remain explicit CI/manual gates, not inferred from successful Windows compilation. Do not mark future milestones complete from a prototype. No deadlines assumed.

References: https://www.electronjs.org/docs/latest ; https://www.electronjs.org/docs/latest/tutorial/security ; https://www.electronjs.org/docs/latest/api/safe-storage ; https://modelcontextprotocol.io/docs/learn/architecture
