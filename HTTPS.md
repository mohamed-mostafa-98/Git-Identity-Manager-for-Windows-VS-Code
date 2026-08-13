# HTTPS & Git Credential Manager (GCM) Guide

## Overview

For developers who use HTTPS clone URLs (`https://github.com/owner/repo.git`), Git Credential Manager (GCM) handles token storage and retrieval on Windows.

---

## The Default Problem

Without configuration, GCM creates a single target entry in Windows Credential Manager:
Target: `git:https://github.com`

When switching between Account A and Account B, GCM returns whichever account token was last saved, causing `HTTP 403 Forbidden` errors.

---

## The Solution: `credential.useHttpPath = true`

When `credential.useHttpPath = true` is set locally in `.git/config`:

1. GCM constructs target keys including path components:
   `git:https://github.com/company/payment-system`
2. Combined with `credential.username = mohammed-work`, GCM searches Windows Credential Vault specifically for:
   Username: `mohammed-work`
   Target: `git:https://github.com/company`

---

## Windows Credential Manager Verification

You can inspect stored credentials in Windows via PowerShell:

```powershell
cmdkey /list | Select-String "git:https://github.com"
```

With our HTTPS strategy active, you will see separate entries for each profile username side-by-side!
