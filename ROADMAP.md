# Product Roadmap

## Delivered through 1.5.0
- [x] Windows & VS Code extension architecture.
- [x] Multiple Account Profiles (Personal, Work, Client).
- [x] Secure storage via VS Code SecretStorage API & Windows Credential Manager.
- [x] Automatic repository remote URL & path detection.
- [x] Persistent repository-to-profile mapping rules.
- [x] Local Git commit identity sync (`user.name` & `user.email`).
- [x] HTTPS authentication via GCM `credential.useHttpPath = true`.
- [x] SSH authentication via OpenSSH `~/.ssh/config` host aliasing.
- [x] Status Bar indicator & QuickPick account switcher.
- [x] Wrong account Push Guard protection.
- [x] Non-sensitive diagnostics report tool.
- [x] Desktop companion view of the same running extension data and actions.
- [x] Repository-aware saved-token Health check without pushing.
- [x] In-place browser-account reauthentication with same-username protection.
- [x] Explicit browser account selection, canonical username repair, and duplicate-account protection.

## Milestone 2: Secure authentication completion (MOH-82)
- [ ] Verify two real accounts remain isolated across repositories.
- [ ] Add expiry, renewal, revocation, and repository-access guidance.
- [ ] Validate secure credential storage on every supported operating system.
- [ ] Package the desktop companion after Windows/macOS/Linux checks.

## Milestone 3: Authenticated AI-agent connector (MOH-83)
- [ ] Add project-scoped MCP and CLI tools that use the assigned account. The authenticated repository-metadata CLI slice is delivered.
- [ ] Continue from repository metadata to pull-request reads.
- [ ] Never expose raw tokens to the model, logs, arguments, or tool output.
- [ ] Add explicit authorization for write operations only after read isolation is proven.

## Milestone 4: Workflow controls and releases (MOH-84)
- [ ] Show GitHub Actions runs for each mapped project.
- [ ] Add explicit run, retry, and cancel controls.
- [ ] Add Windows/macOS/Linux CI and installer validation.
- [ ] Complete accessibility and security release gates.

## Later, based on demand
- [ ] GitHub Enterprise Server.
- [ ] GitLab and Bitbucket support.
- [ ] Guided SSH key creation and public-key upload.
