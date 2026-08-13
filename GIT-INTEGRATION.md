# Git Integration & Commit Identity Specification

## Git Commit Identity vs. GitHub Authentication Identity

A critical requirement of this project is maintaining a strict distinction between:

1. **Git Commit Identity**:
   - `git config user.name`
   - `git config user.email`
   - Written into every git commit header.
2. **GitHub Authentication Identity**:
   - The token or SSH key presented during `git push` / `git pull`.

---

## Local Configuration Management

The extension updates repository-local Git configuration inside `.git/config`:

```cmd
git config --local user.name "Mohammed Work"
git config --local user.email "work@company.com"
```

### Advantages of Local Config Scope:
- Does NOT alter your machine-wide global `.gitconfig`.
- Moves with the repository folder on your local machine.
- Leaves global defaults intact for unmapped repositories.

---

## Conditional Includes (`includeIf`) Strategy

For developers who manage projects in structured directories (e.g. `C:\Projects\Personal\` and `C:\Projects\Work\`), Git 2.13+ supports conditional includes.

### Configuration in `~/.gitconfig`:
```gitconfig
[includeIf "gitdir:C:/Projects/Work/"]
    path = ~/.gitconfig-work

[includeIf "gitdir:C:/Projects/Personal/"]
    path = ~/.gitconfig-personal
```

### Contents of `~/.gitconfig-work`:
```gitconfig
[user]
    name = Mohammed Work
    email = work@company.com
[credential]
    username = mohammed-work
```

The extension supports checking and validating `includeIf` rules as part of system health diagnostics.
