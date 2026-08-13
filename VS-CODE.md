# VS Code Extension Integration Guide

## User Interface Elements

1. **Status Bar Indicator (`GitHub: Work 🟢`)**:
   - Displays active account profile.
   - Clicking opens the Account Switcher QuickPick menu.
   - Displays warning colors if no active profile is selected.
2. **Activity Bar Side View**:
   - **Account Profiles Tree**: List of all configured profiles, active status badges, usernames, and auth methods.
   - **Repository Mappings Tree**: Visual list of folder paths and remote URL rules bound to account profiles.
3. **Command Palette Integration**:
   - `GitHub: Switch Account Profile`
   - `GitHub: Add Account Profile`
   - `GitHub: Remove Account Profile`
   - `GitHub: Map Project to Account`
   - `GitHub: Repository Account Status`
   - `GitHub: Run Diagnostics`
   - `GitHub: Validate Authentication Health`

---

## Extension Configuration Settings

Configure settings in `.vscode/settings.json` or Global User Settings:

```json
{
  "githubAccountManager.pushGuardMode": "Warn",
  "githubAccountManager.autoSwitchOnWorkspaceOpen": true,
  "githubAccountManager.gitConfigScope": "LocalRepo",
  "githubAccountManager.enableGcmHttpPath": true
}
```
