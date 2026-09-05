# Troubleshooting & FAQ

## Frequently Encountered Issues

### 1. `HTTP 403 Forbidden` on `git push` over HTTPS
- **Cause**: GCM may be returning another account, or the saved token may be expired, excluded from the repository, missing Contents write access, or awaiting organization SSO approval.
- **Solution**: Click the account's **Health** button. For browser accounts, use **Reauthenticate** if the token is invalid. For PAT accounts, run **GitHub: Save or Update Account Token**. Then run **GitHub: Switch Account Profile** to refresh the repository-specific GCM entry.

### 2. `Invalid GitHub username or token`
- Install extension 1.5.0. It accepts safe opaque token characters and repairs legacy usernames.
- Browser account: click **Reauthenticate**, then select the intended GitHub account. If the profile says `ctrl_eg` but GitHub verifies `ctrleg`, confirm **Update Profile**. GitHub usernames cannot contain underscores.
- If the verified account already belongs to another profile, use that existing profile or authenticate as the intended account; the extension will not merge their credentials.
- PAT account: run **GitHub: Save or Update Account Token** and paste the replacement in the masked prompt.

### 3. `Permission denied (publickey)` over SSH
- **Cause**: OpenSSH is offering the wrong key or key permissions are incorrect.
- **Solution**: Run `GitHub: Run Diagnostics`. Verify that `~/.ssh/config` has a `Host` alias matching your remote URL, and check that `IdentityFile` points to a valid private key.

### 4. `git config` changes not taking effect
- **Cause**: Global git config (`~/.gitconfig`) might be overriding local settings.
- **Solution**: Run `git config --get-all user.email` inside your repository directory to inspect resolution hierarchy.

### 5. How to view debug output?
- Open VS Code Output view (`Ctrl+Shift+U`).
- Select `GitHub Account Manager` from the dropdown menu to view sanitized execution logs.
