# 🐙 GitHub Account & Git Identity Manager for Windows & VS Code

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![VS Code Extension](https://img.shields.io/badge/VS%20Code-v1.75%2B-blue)](https://code.visualstudio.com/)
[![Platform](https://img.shields.io/badge/Platform-Windows-0078D6?logo=windows)](https://microsoft.com)

A production-grade developer tool for **Windows** and **VS Code** that solves the friction of managing multiple GitHub accounts (Personal, Work, Client) and Git commit identities on a single machine.

> 🚫 **Say Goodbye to Manual Credential Wiping (`cmdkey /delete:LegacyGeneric:target=git:https://github.com`) and Repeated Logins!**



---

## 📌 Problem Solved

When working with multiple GitHub accounts on Windows:
- **Default Issue**: Git Credential Manager (GCM) caches credentials globally under `git:https://github.com`. When pushing to a work project, Git submits your personal token, resulting in `HTTP 403 Forbidden` or `repository not found` errors.
- **Workaround Pain**: Developers end up running `cmdkey /delete:LegacyGeneric:target=git:https://github.com` and logging in again via OAuth browser prompts every time they change projects.
- **Commit Identity Disconnect**: Manual credential deletion doesn't update `git config user.name` or `user.email`, leading to personal commits on company repositories.

### 💡 The Solution
This tool acts as an **orchestration layer** between VS Code, Git, OpenSSH, and Windows Credential Manager:
1. **Isolated HTTPS Vault Entries**: Automatically sets `credential.useHttpPath = true` and `credential.username` so credentials for `Personal` and `Work` accounts co-exist side-by-side in Windows Credential Vault.
2. **Native SSH Host Aliasing**: Generates OpenSSH `~/.ssh/config` host aliases (`github.com-work`, `github.com-personal`) to isolate multiple SSH key pairs effortlessly.
3. **Automatic Profile Activation**: Automatically detects your workspace repository or folder path and activates the matching GitHub account profile when you open VS Code.
4. **Git Identity Sync**: Automatically keeps repository-local `user.name` and `user.email` synchronized with the active profile.
5. **Wrong Account Push Guard**: Intercepts `git push` operations and displays a protective warning if you are about to push with an active account that doesn't match the repository mapping.

---

## 🚀 How to Import & Install the Project

### Option A: Install as a VSIX Extension (Recommended for Daily Use)

1. **Clone/Download the repository**:
   ```cmd
   git clone https://github.com/mohammed-dev/githupe_acount_swicher.git
   cd githupe_acount_swicher
   ```

2. **Install Dependencies & Build VSIX Package**:
   ```cmd
   npm install
   npx @vscode/vsce package
   ```
   *This creates a `.vsix` installer package file: `github-account-manager-1.0.0.vsix`.*

3. **Install into VS Code**:
   - **Via Command Line**:
     ```cmd
     code --install-extension github-account-manager-1.0.0.vsix
     ```
   - **Via VS Code UI**:
     - Open VS Code.
     - Go to the **Extensions** view (`Ctrl+Shift+X`).
     - Click the `...` (More Actions) menu at the top right of the Extensions panel.
     - Select **Install from VSIX...** and choose `github-account-manager-1.0.0.vsix`.

---

### Option B: Import & Run in Development / Debug Mode

If you want to run or modify the source code locally:

1. **Open the project folder in VS Code**:
   ```cmd
   code "e:\SIDE PROJECT\githupe_acount_swicher"
   ```

2. **Install Dependencies & Compile**:
   ```cmd
   npm install
   npm run compile
   ```

3. **Launch Extension Host**:
   - Press `F5` (or click **Run -> Start Debugging**).
   - A new **Extension Development Host** VS Code window will open with the extension loaded and active!

---

## 🛠️ How to Use (Step-by-Step Guide)

### Step 1: Add Your Account Profiles

1. Open the Command Palette (`Ctrl+Shift+P`).
2. Type and select `GitHub: Add Account Profile`.
3. Choose your preferred setup option:
   - 🌐 **Login via Browser (OAuth)** *(Recommended)*: Opens GitHub in your web browser, authenticates your account, and automatically extracts your GitHub username and email!
   - ⚙️ **Manual Profile Setup**: Enter your username, email, and choose `HTTPS`, `SSH`, or `GitHub CLI` strategies manually.

*Repeat this step for your Personal, Work, or Client accounts.*

---

### Step 2: Map Projects to Account Profiles

Tell the extension which projects belong to which GitHub accounts:

1. Open Command Palette (`Ctrl+Shift+P`).
2. Run `GitHub: Map Project to Account`.
3. Select an account profile (e.g., `Work`).
4. Choose a mapping rule:
   - **Current Workspace Folder**: Binds the active project folder (e.g., `C:\Projects\CompanySystem`) to `Work`.
   - **Remote Organization Pattern**: Binds any repository matching a remote pattern (e.g., `company` or `github.com/company/*`) to `Work`.

---

### Step 3: Work Normally!

When you open any project in VS Code:
- The Status Bar shows: `$(github) GitHub: Work 🟢`
- **Git Commit Identity** is automatically set (`user.name` & `user.email`).
- **HTTPS Credentials** or **SSH Host Aliases** are configured automatically.
- Run `git push` or `git pull` without credential conflicts or prompts!

---

## ⚡ Commands Reference

Access these commands anytime from the Command Palette (`Ctrl+Shift+P`):

| Command | Description |
| :--- | :--- |
| `GitHub: Switch Account Profile` | Manually switch active GitHub account profile |
| `GitHub: Add Account Profile` | Launch wizard to add a new account profile |
| `GitHub: Remove Account Profile` | Delete an existing account profile |
| `GitHub: Current Active Account` | Display active account profile status |
| `GitHub: Map Project to Account` | Map workspace folder or remote pattern to a profile |
| `GitHub: Repository Account Status` | View detailed account & identity status for active repo |
| `GitHub: Run Diagnostics` | Open non-sensitive system health diagnostic report |
| `GitHub: Validate Authentication Health` | Test authentication readiness for active profile |

---

## ⚙️ Extension Settings

Customize extension behavior in VS Code Settings (`Ctrl+,` -> search for `GitHub Account Manager`):

```json
{
  // Protection mode for accidental pushes: "Warn", "Strict", or "Disabled"
  "githubAccountManager.pushGuardMode": "Warn",

  // Automatically activate profile when opening workspace
  "githubAccountManager.autoSwitchOnWorkspaceOpen": true,

  // Enable credential.useHttpPath=true for HTTPS vault isolation
  "githubAccountManager.enableGcmHttpPath": true
}
```

---

## 🛡️ Security & Secret Safety

- **No Plain-Text Secrets**: Tokens and credentials are **NEVER** saved to JSON files, settings, or logs.
- **OS Vault Storage**: HTTPS tokens are stored in **Windows Credential Manager** (via GCM) or **VS Code SecretStorage API** (Windows DPAPI).
- **Sanitized Logging**: All output logs redact sensitive token patterns (`ghp_*`) and private key blocks automatically.

---

## 📚 Technical Documentation Index

For deep architectural and implementation details, explore the full documentation suite:

- 🏗️ [Architecture Overview](ARCHITECTURE.md) — Technical architecture, control flow, design decisions
- 🔒 [Security Threat Model](SECURITY.md) — Credential storage policies & untrusted repo safety
- 🔑 [Authentication Guide](AUTHENTICATION.md) — HTTPS, SSH, and gh CLI auth strategies
- ✍️ [Git Commit Identity Sync](GIT-INTEGRATION.md) — Local git config vs global git config
- 🌐 [SSH Host Aliasing](SSH.md) — OpenSSH `~/.ssh/config` multi-key setup
- 🔐 [HTTPS & Git Credential Manager](HTTPS.md) — GCM `credential.useHttpPath` vault isolation
- 💻 [VS Code Integration](VS-CODE.md) — Status Bar, Tree Views, commands reference
- 🖥️ [CLI Roadmap](CLI.md) — Companion CLI specification (`github-manager`)
- 🧪 [Testing & Verification](TESTING.md) — Automated Mocha test suite execution
- 🩺 [Troubleshooting & FAQ](TROUBLESHOOTING.md) — Solutions to common 403 & SSH issues
- 🗺️ [Product Roadmap](ROADMAP.md) — MVP, Phase 2, and multi-provider goals

---

## 📄 License

MIT License. Developed for software engineers working across multiple GitHub accounts.
