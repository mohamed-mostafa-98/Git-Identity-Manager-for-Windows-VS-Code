# GitHub Account & Git Identity Manager

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.75%2B-007ACC)](https://code.visualstudio.com/)
[![Current release](https://img.shields.io/badge/release-1.6.2-2563eb)](RELEASES.md)

Manage personal, work, and client GitHub accounts without deleting credentials or signing in again whenever you change projects.

The VS Code extension is the source of truth for accounts, project mappings, Git identity, and secure tokens. The optional Electron desktop app provides a simpler view of that same running extension.

## What it does

- Saves multiple GitHub profiles with browser OAuth, personal access tokens, SSH, or GitHub CLI.
- Maps a folder or GitHub owner/repository pattern to a specific account.
- Applies repository-local `user.name` and `user.email`.
- Stores HTTPS credentials per repository through Git Credential Manager using `credential.useHttpPath=true`.
- Switches the current project to its assigned account without clearing other accounts.
- Checks saved-token identity, repository visibility, SSO/rate-limit errors, and GitHub push-endpoint access without pushing.
- Warns when the active account and project mapping disagree.
- Shows the same accounts and actions in the desktop companion while VS Code is open.
- Exposes read-only MCP tools for connected VS Code windows and mapped GitHub repository metadata without returning tokens.

## Install

### Install the current VSIX

1. Download or clone this repository.
2. In VS Code, open **Extensions**, select `…`, then **Install from VSIX…**.
3. Choose `github-account-manager-1.6.2.vsix` and reload VS Code.

Or use the terminal:

```powershell
code --install-extension github-account-manager-1.6.2.vsix
```

### Build from source

```powershell
npm install
npm run compile
npx @vscode/vsce package
```

Run `npm run test:unit` for the extension test suite.

## Quick start

1. Open a local GitHub repository in VS Code.
2. Run **GitHub: Add Account Profile** from the Command Palette.
3. Choose **Login via Browser** or **Personal Access Token**. Repeat for each account.
4. Run **GitHub: Map Project to Account** and assign the current folder or an owner pattern.
5. Run **GitHub: Switch Account Profile**, or click **Use for This Project** in the dashboard.
6. Use **Health** before pushing when you want to verify the saved token and current repository.

For fine-grained tokens, select the required repositories and grant **Contents: Read and write** for pushes. Changes under `.github/workflows/` can also require **Workflows: Read and write**. Organization SSO or token approval may still be required.

## Dashboard and commands

Open **GitHub: Open Control Panel Dashboard** for profiles, mappings, workspace identity, diagnostics, and account health.

| Command | Purpose |
|---|---|
| `GitHub: Add Account Profile` | Add an account through browser login, PAT, or manual setup |
| `GitHub: Reauthenticate Browser Account` | Replace an invalid browser token for the selected profile while preserving its mappings |
| `GitHub: Save or Update Account Token` | Replace a profile's saved PAT safely |
| `GitHub: Switch Account Profile` | Apply an account to the current repository |
| `GitHub: Map Project to Account` | Save a folder or remote-owner assignment |
| `GitHub: Validate Authentication Health` | Diagnose the current repository's saved token |
| `GitHub: Repository Account Status` | Show mapping, active profile, and local identity |
| `GitHub: Run Diagnostics` | Generate a non-sensitive environment report |

The Health check performs read-only GitHub requests. A successful push-endpoint check does not override branch protection, organization policies, workflow-file permissions, or repository rules. An SSH repository pushes with its SSH key; a token health result does not validate that key.

## Where data is stored

Tokens do **not** live in this repository, `.git/config`, JSON settings, logs, remote URLs, or desktop responses.

| Data | Location | Safe way to change it |
|---|---|---|
| Profile names, usernames, emails, mappings, active profile | VS Code `globalState`, inside VS Code's internal user-data database. On standard Windows installations this is usually under `%APPDATA%\Code\User\globalStorage\state.vscdb`. | Use the extension dashboard and commands. Do not edit `state.vscdb`. |
| Extension token copy | VS Code `SecretStorage`, protected by the operating-system credential service. It has no supported editable file path. | Run **GitHub: Save or Update Account Token** or sign in through the browser again. |
| Git HTTPS credential | **Windows Credential Manager → Windows Credentials → Generic Credentials**, separated by the GitHub repository path. Windows owns the encrypted storage; there is no supported token file path. | Update through the extension. To force recreation, remove only that repository's `git:https://github.com/...` entry, then switch/sync the profile again. |
| Git identity and credential selection | `<repository>\.git\config`; contains name, email, helper, username, and path-isolation settings, never the token. | Switch or synchronize the account through the extension. |
| Desktop connection descriptors | `%USERPROFILE%\.git-identity-manager\connections\`. These contain short-lived local connection capabilities, not GitHub tokens. | Managed automatically while VS Code is running. |
| Legacy desktop M1 metadata | Electron user-data `workspace.json`, commonly `%APPDATA%\git-identity-desktop\workspace.json` on Windows. It contains metadata only and no longer drives the companion UI. | Usually leave it alone; the VS Code extension is authoritative. |

Paths can differ for VS Code Insiders, portable mode, profiles, and other operating systems. The location shown above is informational, not a manual-editing API.

### Manually update or revoke a token

The supported manual PAT update is:

1. Create or update the token in GitHub settings.
2. In VS Code, run **GitHub: Save or Update Account Token**.
3. Select the profile and paste the replacement into the masked prompt.
4. Open each mapped repository when needed and run **Switch Account Profile** or **Apply & Sync Identity**. This refreshes its Git Credential Manager entry.
5. Run **Health** to confirm the token belongs to the expected account and reaches the repository push endpoint.

For a browser-login profile, click **Reauthenticate** on its dashboard card. VS Code clears its remembered account choice so you can select the intended GitHub account. If an older profile contains a non-canonical username such as `ctrl_eg` and GitHub verifies `ctrleg`, confirm **Update Profile** to repair the username while preserving its ID and project mappings. If the verified account already belongs to another profile, the extension keeps both profiles unchanged. **Save / Update Token** remains available for manual replacement.

To revoke access, revoke the token on GitHub, remove its extension profile if no longer needed, and remove the repository-specific Windows credential. Deleting a profile removes the SecretStorage copy and mappings but cannot revoke a token at GitHub and may not remove every previously written GCM entry.

## Security model

- Tokens enter through masked VS Code prompts or GitHub's browser OAuth flow.
- Token ownership is checked before saving.
- Secrets pass to Git Credential Manager through standard input, never command arguments.
- HTTPS remotes must be clean `https://github.com/owner/repository.git` URLs without embedded credentials.
- Repository-local username and `useHttpPath` settings isolate accounts by GitHub path.
- Logs and desktop APIs do not return tokens.
- The desktop renderer is sandboxed and can call only allowlisted operations through an authenticated loopback bridge.
- Untrusted VS Code workspaces cannot trigger credential-changing desktop actions.

Software running as the same operating-system user can still access resources that user is authorized to access. Protect the Windows session, use least-privilege tokens, enable token expiry, and revoke credentials after suspected compromise. See [SECURITY.md](SECURITY.md) for the detailed threat model.

## Desktop companion

The desktop app shows the extension's existing accounts and mappings; it does not create a second vault.

```powershell
npm install --prefix desktop
npm start --prefix desktop
```

Keep the local VS Code window open and select it in the desktop app. Login prompts, confirmations, and reports appear in VS Code. Windows is verified locally; macOS and Linux remain release gates. See [desktop/README.md](desktop/README.md).

## Releases

| Version | Main changes |
|---|---|
| **1.6.2** | Prominent dashboard AI access status with clear enable/disable controls |
| **1.6.1** | Explicit repository/account approval and withdrawal for AI-agent reads |
| **1.6.0** | Authenticated agent CLI and MCP tools for mapped-account repository metadata and permissions without exposing tokens |
| **1.5.0** | Reliable browser account selection, safe legacy username repair, duplicate-account protection, separate token actions, and responsive profile cards |
| **1.4.0** | Reauthenticate an invalid browser-login profile in place; preserves mappings and accepts safe opaque OAuth/PAT token characters |
| **1.3.0** | Repository-aware token Health check; identifies invalid/wrong-account tokens, missing repository access, SSO/rate limiting, and push-endpoint rejection without pushing |
| **1.2.1** | Corrected the current GCM Windows vault backend name to `wincredman` |
| **1.2.0** | Desktop companion bridge using the extension's existing profiles, mappings, secure storage, and browser-login commands |
| **1.1.0** | Reusable PAT/browser credentials, GCM path isolation, exact per-project mappings, safer token verification, and push protection improvements |
| **1.0.0** | Initial profile management, identity switching, HTTPS/SSH/GitHub CLI strategies, mappings, dashboard, and diagnostics |

Detailed release notes and installation artifacts are in [RELEASES.md](RELEASES.md).

## Future plan

Work is tracked in the **GitHub Account & Git Identity Manager** project in the Mohamed Mostafa Linear workspace.

1. **Secure authentication completion (MOH-82):** real two-account verification, expiry/renewal UX, cross-platform vault checks, and clearer repository write-access status.
2. **Authenticated AI-agent connector (MOH-83):** project-scoped MCP/CLI tools that select the assigned account without returning tokens; read-only repository and pull-request tools first.
3. **Workflow controls and releases (MOH-84):** view, run, retry, and cancel GitHub Actions per project, followed by Windows/macOS/Linux packaging and security/accessibility checks.

The project will not claim cross-platform credential support until each platform's secure storage and two-account isolation have been tested.

## Documentation

- [Linear closure verification checklist](VERIFICATION-CHECKLIST.md)
- [Saved authentication](SAVED-AUTHENTICATION.md)
- [Security model](SECURITY.md)
- [Authentication strategies](AUTHENTICATION.md)
- [HTTPS and Git Credential Manager](HTTPS.md)
- [SSH account isolation](SSH.md)
- [Architecture](ARCHITECTURE.md)
- [Development and testing](DEVELOPMENT.md)
- [Troubleshooting](TROUBLESHOOTING.md)
- [Roadmap](ROADMAP.md)

MIT licensed. See [LICENSE](LICENSE).
