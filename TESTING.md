# Testing & Verification Guide

## Test Suite Execution

Run the automated Mocha unit and integration tests:

```cmd
npm test
```

---

## Test Verification Scenarios

### Scenario 1: Multi-Account HTTPS Isolation
1. Create Account A (`Personal`, HTTPS, username: `mohammed-personal`).
2. Create Account B (`Work`, HTTPS, username: `mohammed-work`).
3. Open a repository mapped to `Work`.
4. Verify `git config credential.useHttpPath` returns `true`.
5. Verify `git config credential.username` returns `mohammed-work`.
6. Run `git push` — verify GCM prompts or uses `mohammed-work` without wiping `mohammed-personal` entry.

### Scenario 2: SSH Host Aliasing
1. Create Account `Work` (SSH, Host Alias `github.com-work`).
2. Map to repository `company/backend`.
3. Verify `git remote get-url origin` returns `git@github.com-work:company/backend.git`.
4. Verify `~/.ssh/config` contains Host block pointing to designated private key.

### Scenario 3: Push Protection
1. Set Push Guard Mode to `Strict`.
2. Activate `Personal` profile while inside a repository mapped to `Work`.
3. Trigger push command.
4. Verify modal error dialog pops up blocking push and offering `[Switch to Work]` action.
