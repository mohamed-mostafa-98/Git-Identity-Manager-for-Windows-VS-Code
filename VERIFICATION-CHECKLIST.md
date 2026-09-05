# Linear closure verification checklist

Use this checklist to finish the live checks required to close MOH-82 and MOH-83. Never paste a GitHub token into screenshots, logs, Linear, or terminal arguments.

## Test setup

Prepare:

- Two GitHub accounts, referred to below as **Account A** and **Account B**.
- One repository that Account A can push to and one repository that Account B can push to.
- A harmless branch in each repository. Do not test against a protected production branch.
- VS Code with `github-account-manager-1.6.0.vsix` installed and the window reloaded.
- Git Credential Manager installed for HTTPS testing.
- A clone of this source project for the desktop and MCP commands.

Record the operating system, VS Code version, Git version, Git Credential Manager version, extension version, authentication method, repository name, and pass/fail result. Redact local usernames and private repository names when necessary.

## MOH-82: secure cross-platform authentication

### 1. Add and verify both accounts

1. Open the extension dashboard.
2. Add Account A using browser login or a personal access token.
3. Add Account B separately.
4. Click **Health** on each profile while its repository is open.
5. Confirm each result reports the expected GitHub username and repository access.

Pass when both profiles exist at the same time, each token belongs to its displayed username, and no repeated browser login is required after reloading VS Code.

### 2. Verify project isolation

1. Open repository A and assign it to Account A with **Use for This Project**.
2. Open repository B in another VS Code window and assign it to Account B.
3. In each repository, create a harmless branch and commit a small text change.
4. Push repository A, then repository B, then repository A again.
5. Confirm GitHub attributes each push to the intended account and no operation changes the other repository's assignment.
6. Reload both VS Code windows and repeat a fetch or push.

Pass when the sequence is **A → B → A**, no credential prompt appears after initial setup, and each repository continues using its mapped account.

### 3. Verify reauthentication and legacy username repair

1. Select a browser profile and click **Reauthenticate**.
2. Confirm VS Code lets you choose the intended GitHub account instead of silently reusing another account.
3. If an old profile contains a non-canonical username such as `ctrl_eg`, authenticate as the canonical GitHub account such as `ctrleg` and confirm **Update Profile**.
4. Confirm the profile ID, display name, and repository mappings remain intact.
5. Try authenticating a profile as an account already saved in another profile.

Pass when canonical repair succeeds without losing mappings and a duplicate-account collision is rejected without replacing either credential.

### 4. Verify token replacement and revocation

1. Use **Save / Update Token** to replace one profile's token.
2. Run **Health**, switch the project to that profile, and perform a fetch or harmless push.
3. Revoke that token in GitHub settings.
4. Run **Health** again and confirm it reports rejection.
5. Restore authentication using **Save / Update Token** or **Reauthenticate** and confirm recovery.

Pass when revoked credentials fail clearly, replacement credentials restore access, and the token never appears in output, Git config, remote URLs, or desktop responses.

### 5. Verify each supported operating system

Repeat sections 1–4 on:

- Windows with Windows Credential Manager.
- macOS with Keychain.
- Linux with an available OS-backed secret service and no plaintext fallback.

Record unsupported behavior as a release limitation. MOH-82 can close only after the supported-platform claim matches the systems actually tested.

### MOH-82 closure evidence

Attach or summarize:

- The A → B → A result for every supported operating system.
- Health results with usernames and private details redacted.
- Reauthentication, canonical repair, duplicate rejection, revocation, and recovery results.
- Confirmation that searches of logs, Git config, remote URLs, desktop responses, and MCP output found no token.
- Any platform explicitly removed from the supported list because it was not verified.

## MOH-83: authenticated AI-agent connector

### 1. Verify the CLI repository tool

1. Keep a trusted VS Code window open on a repository mapped to Account A.
2. Find that window's connection filename under `%USERPROFILE%\.git-identity-manager\connections` on Windows or `~/.git-identity-manager/connections` on macOS/Linux.
3. Use the filename without `.json` as the connection ID:

```powershell
npm run agent:repo --prefix desktop -- --connection <connection-id>
```

Pass when the output contains the correct repository, verified account, default branch, and permissions, and contains no token.

### 2. Configure and verify MCP

1. Build the desktop tools:

```powershell
npm run build --prefix desktop
```

2. Configure the MCP client to launch `node` with the absolute path to `desktop/dist/desktop/src/mcp.js`.
3. Call `list_vscode_windows` and select the target window's connection ID.
4. Call `get_repository_metadata` with that ID.
5. Repeat with repository B in a second VS Code window mapped to Account B.

Pass when each window returns its own repository and verified account, concurrent A/B calls stay isolated, and neither response contains credentials.

### 3. Verify failure handling

Run `get_repository_metadata` after each condition:

- Remove the repository mapping.
- Close the target VS Code window.
- Open the repository in an untrusted workspace.
- Revoke or replace the mapped account's token with an invalid credential.
- Change the repository remote after mapping it.
- Request a non-GitHub remote.
- Supply an invalid connection ID or unsupported MCP tool name.

Pass when every request fails closed with a useful error and no token, credential, connection key, or unrelated account metadata is returned.

### 4. Finish the remaining MOH-83 implementation

Before closing MOH-83, implement and verify:

- Read-only pull-request listing and pull-request detail tools.
- An explicit per-repository approval control showing that AI-agent access is enabled.
- Denial when approval is missing or withdrawn.
- Concurrent A/B routing tests for repository and pull-request tools.
- Documentation for configuring at least one real MCP client.

Write operations remain outside this closure unless MOH-83 is deliberately expanded. Any later write tool must have permission-aware, user-visible authorization.

### MOH-83 closure evidence

Attach or summarize:

- Successful CLI and MCP output for Accounts A and B with sensitive details redacted.
- A concurrent A/B isolation result.
- All failure-handling results.
- Pull-request read results for both accounts.
- Approval enable, denial, and withdrawal results.
- Confirmation that MCP input/output and logs contain no token or connection key.

## Closing the Linear issues

1. Add a final comment to the issue containing the environment matrix, results, commit, and remaining limitations.
2. Link screenshots or logs only after checking that they contain no secrets.
3. Mark MOH-82 **Done** only when its supported-platform authentication matrix passes.
4. Mark MOH-83 **Done** only when its remaining implementation list and live two-account checks pass.
5. Update the project and release documentation so their support claims match the verified evidence.
