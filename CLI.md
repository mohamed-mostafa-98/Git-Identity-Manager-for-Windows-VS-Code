# CLI Specifications & Interface Design

## Overview

While the core user experience is embedded within VS Code, a companion Command Line Interface (CLI) binary (`github-manager`) is specified for terminal power users.

---

## Command Interface

```cmd
github-manager account list

github-manager account add --name Work --user mohammed-work --email work@company.com --auth SSH

github-manager account remove work

github-manager account switch work

github-manager account current

github-manager repo detect

github-manager repo map work --pattern company

github-manager repo unmap company

github-manager doctor
```

---

## Output Example (`github-manager doctor`)

```text
✓ Windows 11 Enterprise (x64)
✓ Git version 2.42.0.windows.1
✓ Git Credential Manager 2.3.2
✓ OpenSSH_9.2p1, OpenSSL 3.0.11
✓ GitHub CLI version 2.39.0
✓ Account profiles configured (3)
✓ Repository mapping active: Work (mohammed-work)
```
