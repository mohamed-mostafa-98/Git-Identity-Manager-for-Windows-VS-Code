# Git Identity desktop companion

Electron + TypeScript + native HTML/CSS, MIT licensed. The desktop is another view of the **same VS Code extension**, with its existing profiles, project mappings, saved authentication and browser login.

## Run

1. Install `github-account-manager-1.6.2.vsix` in VS Code (Extensions → Install from VSIX), then reload the VS Code window.
2. Keep your local VS Code window open. The extension starts its connection automatically; you can also open **GitHub: Open Control Panel Dashboard**.
3. From this repository run `npm start --prefix desktop`. Select the VS Code window if more than one is available.

For a fresh checkout, install Node.js 22.12+ and Git, then run `npm install` and `npm install --prefix desktop` first. Windows is verified locally; macOS/Linux execution remains a release gate. Remote SSH/WSL/web extension hosts are not connected by this version.

## Shared actions

- Existing accounts and folder/owner mapping rules load directly from the selected extension window. Changes refresh every five seconds while visible and when returning to the desktop.
- **Sign in with browser** calls the extension’s existing OAuth flow. Complete GitHub login and the friendly-name prompt through VS Code. Username/email are detected and the token stays in VS Code SecretStorage. Signing in to an existing username updates that profile rather than duplicating it.
- **Reauthenticate** clears VS Code's remembered GitHub account choice, then replaces an invalid/expired OAuth token without changing the profile ID or mappings. It can repair a legacy username after confirmation and rejects an account already saved under another profile.
- Add accounts with a token or manual settings, use **Update token** or **Reauthenticate** independently, remove profiles, map projects, switch the selected workspace account and apply its mapping.
- Run the same diagnostics, health check and dashboard commands. Prompts, confirmations and reports appear in VS Code. These retain the extension’s current capabilities and platform limitations.

VS Code must stay open. A disconnected app shows connection instructions instead of an independent account registry. Selecting **Use for workspace** changes the Git identity/authentication of the first folder in the selected VS Code window, just as the extension does. Untrusted workspaces allow viewing only. GitHub CLI profiles retain the extension’s global CLI switching behavior.

The first MOH-83 agent tool reads authenticated metadata for the repository open in a trusted VS Code window. Find its connection ID in `%USERPROFILE%\.git-identity-manager\connections`, then run `npm run agent:repo --prefix desktop -- --connection <id>`. The mapped account's token stays inside the extension; output contains repository metadata, permissions, and the verified username only. Missing mappings, changed accounts, invalid tokens, and non-GitHub remotes fail closed.

Run `npm run build --prefix desktop` once, then configure an MCP client to launch `node` with the absolute path to `desktop/dist/desktop/src/mcp.js`. The server exposes `list_vscode_windows` and `get_repository_metadata`. Use the first tool to obtain a connection ID, then pass it to the second tool. VS Code must remain open with the target repository trusted and mapped.

## Data and security

### AI-agent approval (1.6.2)
Before using the CLI or MCP repository tool, run **GitHub: Manage AI Agent Access** in VS Code, or use **Manage AI Agent Access** in the extension dashboard. Access starts disabled. Confirm the displayed repository and account to enable read-only access for local clients in that window. Run the control again to withdraw approval.

Approval is stored in VS Code workspace state as a hash bound to the first folder's repository path, exact remote, account ID, username and authentication method. A different context is denied; restoring the exact approved context matches again unless approval was withdrawn. Requests recheck approval and context before returning their result. Withdrawal blocks subsequent results but cannot erase data already returned to a client. Use separate windows for separate repositories; no GitHub credentials are stored in approval state.

### Token health
The dashboard's account **Health** button checks that account's saved token against the current repository. The desktop **Authentication health** action uses the repository's mapped account (or the active account if unmapped). Results distinguish missing/expired/wrong-account tokens, repository access, SSO/rate limits and rejection by GitHub's push endpoint. The endpoint check only requests Git service information; it never pushes or changes credentials. Branch rules and workflow permissions can still reject a particular push, and terminal Git may use a different cached credential. SSH/CLI profiles are explicitly reported as outside saved-token verification.

There is no account import or duplicate vault. GitHub tokens never cross the companion connection. The extension serves allowlisted actions over authenticated loopback HTTP with browser-origin requests rejected. A random session capability is stored in a private connection descriptor under `~/.git-identity-manager/connections`; it is read only by the desktop main process and never sent to the renderer. Unix modes are 0700/0600; Windows inherits the user profile’s ACL. This protects against other users and browser pages, not malicious software running as the same OS user. Each window has a distinct connection; stale/disconnected connections are ignored, with no automatic retry of mutations.

The original M1 `workspace.json` is preserved but no longer drives the desktop UI. Its old read-only `context` CLI and tests remain available; they do not authenticate AI agents or reflect extension data.

## Checks

```sh
npm run test:unit
npm test --prefix desktop
npm run test:ui --prefix desktop
```

Checks cover connection authentication, browser request rejection, explicit window routing, fresh shared reads, mocked browser login saving to the same extension metadata/vault, trusted-workspace restrictions, desktop interactions, renderer isolation, disconnection and the real Electron package entry. No real GitHub credentials are used in automated tests.
