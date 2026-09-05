# Releases

The source repository contains installable VSIX artifacts for local testing. Install a file through **Extensions → … → Install from VSIX…**, then reload VS Code. Published marketplace/GitHub releases are a future delivery step unless a release page explicitly says otherwise.

## 1.3.0 — Repository-aware token health

- Validates the saved token against the expected GitHub account.
- Checks current repository visibility and GitHub's Git push-service endpoint without creating a commit or pushing.
- Distinguishes missing/invalid/expired tokens, wrong accounts, HTTP 403/404, SSO requirements, and rate limits.
- Explains remaining branch-rule, workflow-permission, SSH, and terminal-credential limits.
- Uses the same Health command from the dashboard and desktop companion.

Artifact: `github-account-manager-1.3.0.vsix`

## 1.2.1 — Windows credential-store correction

- Uses Git Credential Manager's current `wincredman` backend name instead of the rejected `wincred` name.
- Improves the vault-save error message without logging secret output.

Artifact: `github-account-manager-1.2.1.vsix`

## 1.2.0 — Shared desktop companion

- Adds an Electron desktop view of the running local VS Code extension.
- Shares the extension's profile and mapping data instead of maintaining a duplicate account registry.
- Delegates browser login, switching, token updates, mappings, diagnostics, and health actions to VS Code.
- Uses authenticated loopback communication, renderer isolation, and allowlisted commands; tokens never enter desktop responses.

Artifact: `github-account-manager-1.2.0.vsix`

## 1.1.0 — Saved authentication and project routing

- Adds browser OAuth and verified PAT onboarding.
- Saves tokens in VS Code SecretStorage and repository credentials in Windows Credential Manager through GCM.
- Enables `credential.useHttpPath` for repository-specific GitHub credentials.
- Adds explicit project switching and more specific folder/remote mapping rules.
- Hardens remote validation, command execution, logging, token ownership checks, and push guard behavior.

Artifact: `github-account-manager-1.1.0.vsix`

## 1.0.0 — Initial extension

- Multiple GitHub account profiles.
- Repository mappings and repository-local Git identity synchronization.
- HTTPS, SSH alias, and GitHub CLI strategies.
- Activity Bar views, Quick Pick switching, dashboard, diagnostics, and advisory push guard.

Artifact: `github-account-manager-1.0.0.vsix`

## Verification status

- Extension: 14 automated unit/regression checks currently pass on Windows.
- Desktop: 5 core tests and native Electron UI smoke checks have passed on Windows.
- Live GitHub operations require user accounts and are not performed by automated tests.
- macOS/Linux credential and installer validation remain pending.

## Planned releases

- **Authentication completion:** real two-account isolation, expiry/revocation health, and supported OS-vault validation.
- **AI-agent connector:** project/account-scoped MCP and CLI access without token-returning tools.
- **Workflow controls:** GitHub Actions run visibility and explicit run/retry/cancel actions.
- **Cross-platform distribution:** tested Windows, macOS, and Linux packages with CI, security, and accessibility gates.
