# Authentication Specification

## Overview

The tool supports four authentication strategies for GitHub account profiles:

1. **Browser OAuth**, stored through VS Code SecretStorage and applied to HTTPS Git through GCM
2. **HTTPS personal access token (Git Credential Manager - GCM)**
3. **SSH (OpenSSH Host Aliasing)**
4. **GitHub CLI (`gh`)**

### Reauthenticating browser accounts

Use the dashboard's **Reauthenticate** button or **GitHub: Reauthenticate Browser Account**. VS Code clears its remembered account preference and asks which GitHub account to use. Matching accounts refresh the secure token and email. If GitHub returns a canonical username that differs from legacy metadata, you can confirm the username repair without changing the profile ID or mappings. An account already saved under another profile is rejected, and cancellation does not overwrite the credential. **Save / Update Token** remains available for manual token replacement.

---

## HTTPS via Git Credential Manager (GCM)

GCM is Microsoft's official cross-platform Git credential helper on Windows.

### Configuration Rules
When an account profile using HTTPS is activated for a repository, the tool executes:
```cmd
git config --local credential.useHttpPath true
git config --local credential.username <github-username>
```

### How Windows Vault Target Keys Change
- **Standard Git Default**:
  `git:https://github.com` (Shared single entry across all accounts)
- **With `useHttpPath` & `credential.username`**:
  `git:https://github.com/company/backend` (Stored separately for Work)
  `git:https://github.com/personal-user/app` (Stored separately for Personal)

Result: Both Personal and Work HTTPS credentials co-exist in Windows Credential Vault simultaneously.

---

## SSH via OpenSSH Host Aliasing

For developers who authenticate using SSH key pairs (`git@github.com:...`).

### OpenSSH Host Aliasing (`~/.ssh/config`)
The extension manages Host blocks in `~/.ssh/config`:
```sshconfig
Host github.com-personal
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_personal
    IdentitiesOnly yes

Host github.com-work
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_work
    IdentitiesOnly yes
```

### Remote URL Mapping
When switching to the `Work` profile, the repository's origin URL is automatically updated:
`git@github.com:company/backend.git` → `git@github.com-work:company/backend.git`

OpenSSH routes traffic to `github.com` using the `id_ed25519_work` key automatically.

---

## GitHub CLI (`gh`)

If installed, the extension integrates with `gh auth status` and `gh auth switch`.
When switching profiles, it runs:
```cmd
gh auth switch --user mohammed-work
```
This ensures GitHub CLI commands (`gh pr create`, `gh issue list`, `gh repo view`) operate under the correct account context.
