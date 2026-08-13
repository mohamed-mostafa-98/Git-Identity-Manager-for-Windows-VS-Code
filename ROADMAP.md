# Product Roadmap

## Phase 1: MVP Core (Current Release)
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

## Phase 2: Advanced Developer Automation
- [ ] Standalone Windows CLI tool (`github-manager switch`).
- [ ] Guided SSH Key pair generator & automatic GitHub public key upload via OAuth.
- [ ] Windows System Tray application for global desktop context switching.
- [ ] Automated account health monitoring (detecting expired OAuth tokens).

## Phase 3: Multi-Provider Expansion
- [ ] Support for GitHub Enterprise Server (GHES).
- [ ] Support for GitLab and GitLab Self-Managed.
- [ ] Support for Bitbucket Data Center and Cloud.
