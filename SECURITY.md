# Security Specification & Threat Model

## Secret Storage Policy

Under NO circumstances are secrets written to plain text files:

| Data Type | Storage Mechanism | Location | Encrypted |
| :--- | :--- | :--- | :--- |
| Account Metadata | VS Code GlobalState | `%APPDATA%\Code\User\globalStorage` | No (Metadata only) |
| Repository Mappings | VS Code GlobalState | `%APPDATA%\Code\User\globalStorage` | No (Metadata only) |
| OAuth / PAT Tokens | VS Code `SecretStorage` | Windows Credential Manager (DPAPI) | **Yes (OS Vault)** |
| HTTPS Credentials | Git Credential Manager | Windows Credential Manager (DPAPI) | **Yes (OS Vault)** |
| SSH Private Keys | OpenSSH / SSH Agent | `~/.ssh/` | User OS File Permissions (0600) |

---

## Threat Analysis & Countermeasures

### 1. Malicious Repository Attacks
* **Threat**: A cloned repository includes malicious `.vscode/settings.json`, `.git/config` hooks, or environment variables designed to exfiltrate tokens.
* **Mitigation**: The extension ignores workspace settings for authentication credentials. Profile credentials and SSH profiles are read strictly from global user space.

### 2. Log Exposure & Credential Leaks
* **Threat**: Access tokens or private keys accidentally logged to output channels or error popups.
* **Mitigation**: The `Logger` utility automatically sanitizes outputs using regular expressions, redacting GitHub tokens (`ghp_*`), private SSH key blocks, and URL credentials.

### 3. Account Mismatch & Accidental Leaks
* **Threat**: Developer accidentally pushes confidential Work code to a Personal repository or vice versa.
* **Mitigation**: The **Push Guard** service intercepts git push actions and displays a modal confirmation dialog when active identity does not match repository mapping.

### 4. Reauthentication Account Substitution
* **Threat**: A user attempts to repair one profile but signs into another GitHub account in the browser.
* **Mitigation**: Reauthentication compares the verified GitHub username with the selected profile before replacing SecretStorage. A mismatch or cancellation preserves the existing token, profile ID, and mappings. Tokens are treated as opaque printable values but whitespace/control characters and values over 1024 characters are rejected at every shared boundary.
