# Troubleshooting & FAQ

## Frequently Encountered Issues

### 1. `HTTP 403 Forbidden` on `git push` over HTTPS
- **Cause**: GCM is returning a cached token from a different GitHub account.
- **Solution**: Ensure `githubAccountManager.enableGcmHttpPath` is set to `true`. Run `GitHub: Switch Account Profile` to re-apply `credential.useHttpPath = true` and `credential.username`.

### 2. `Permission denied (publickey)` over SSH
- **Cause**: OpenSSH is offering the wrong key or key permissions are incorrect.
- **Solution**: Run `GitHub: Run Diagnostics`. Verify that `~/.ssh/config` has a `Host` alias matching your remote URL, and check that `IdentityFile` points to a valid private key.

### 3. `git config` changes not taking effect
- **Cause**: Global git config (`~/.gitconfig`) might be overriding local settings.
- **Solution**: Run `git config --get-all user.email` inside your repository directory to inspect resolution hierarchy.

### 4. How to view debug output?
- Open VS Code Output view (`Ctrl+Shift+U`).
- Select `GitHub Account Manager` from the dropdown menu to view sanitized execution logs.
