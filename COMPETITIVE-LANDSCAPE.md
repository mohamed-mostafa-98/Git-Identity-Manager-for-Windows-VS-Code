# Multiple GitHub accounts: case study and feature comparison

## Executive view

Multiple GitHub identities are already supported by several independent tools. The underlying problem can be solved manually with Git configuration, Git Credential Manager (GCM), SSH aliases, and GitHub CLI. Several VS Code extensions also provide account-switching interfaces.

Git Identity Manager is therefore not positioned as the only account switcher. Its focus is one visible, repository-scoped workflow that connects:

- the commit author (`user.name` and `user.email`);
- the credential selected for GitHub HTTPS access;
- a persistent project-to-account assignment;
- authentication and repository health checks;
- optional, explicitly approved AI repository context.

## Case study: personal, work, and client repositories

This is a representative scenario, not a claim about a named customer.

### Situation

A developer works on three repositories on the same Windows machine:

| Project | Intended GitHub account | Required commit identity |
|---|---|---|
| Personal portfolio | Personal account | Personal name and email |
| Employer platform | Work account | Company name and email |
| Client application | Client-provided account | Client-approved name and email |

Git treats the commit author and the authentication credential as separate concerns. Setting the correct `user.email` does not select the correct GitHub credential, and authenticating successfully does not guarantee the desired commit identity.

### Common manual solution

An experienced user can combine:

1. Git `includeIf` rules or repository-local configuration for author identity.
2. GCM with `credential.useHttpPath=true`, or a username in the HTTPS remote, to distinguish GitHub credentials.
3. SSH host aliases when repositories use SSH.
4. `gh auth switch` for GitHub CLI operations.

This works, but the rules live in different places and GitHub CLI switching remains host-wide. Diagnosis requires knowing whether a failure belongs to commit configuration, the Git credential, repository access, SSO, branch policy, or another tool's active account.

### Git Identity Manager workflow

1. Save each account as a named profile.
2. Open a repository and map it to the intended profile.
3. Apply the profile to set repository-local identity and its supported authentication strategy.
4. Run Health to verify the saved GitHub identity and repository access before pushing.
5. If a local AI client needs repository metadata, approve that exact repository/account context in the dashboard and withdraw it when finished.

### Expected outcome

The developer can see which account is assigned to the open project and does not need to replace unrelated saved accounts when moving between repositories. For HTTPS, credentials can be separated by repository path. The application warns and fails closed in supported paths when identity, mapping, authentication, trust, or AI approval is missing.

### Current evidence and limits

- Fifteen extension regression tests and six desktop core tests have passed on Windows.
- The native Electron smoke and package-launch checks have passed on Windows.
- One approved live repository metadata read and a normal Git push succeeded with the intended account.
- A full live A → B → A two-account test remains required.
- macOS and Linux secure-storage and installer validation remain pending.
- Pull-request reads and workflow controls are planned, not available in version 1.6.2.

## Feature comparison

The table reflects public documentation reviewed on 7 September 2026. “Manual” means the capability can be assembled from configuration but is not presented as one guided product workflow. Validate each product before using it with sensitive credentials.

| Option | Multiple saved identities | Repository-scoped identity | Credential routing | Health/diagnostics | SSH/GPG depth | AI repository approval | Main trade-off |
|---|---|---|---|---|---|---|---|
| Git + GCM + `includeIf` | Manual | Yes | HTTPS by username/path; SSH by alias | Manual commands | Highly configurable | No | Most flexible foundation; requires careful configuration across several files/tools. |
| GitHub CLI | Yes | No; active account is selected per host | CLI and optional Git setup | `gh auth status` | SSH/HTTPS login options | No | Excellent CLI client, but `gh auth switch` changes the active account for a host. |
| VS Code account preferences | Yes | Per supporting extension preference | Does not itself control terminal Git credentials | Extension-specific | No | No | Useful for extension sessions; separate from commit identity and terminal Git authentication. |
| Git ID Switcher | Yes | Profile-based | Advertises GitHub/SSH profile switching | Product-specific | Advertises SSH, GPG and submodule support | Not advertised | Stronger published scope for signing, submodules and localization. |
| GitHub Accounts Switcher | Yes | Switch-based | Advertises VS Code authentication and GitHub CLI switching | Product-specific | Not its main documented focus | Not advertised | Convenient VS Code switching; public description emphasizes active switching. |
| Git Account Switcher by Revend | Yes | Switch-based | Advertises Git/CLI switching across several providers | Account validation | Multi-provider focus | Not advertised | Broader hosting support; global switching differs from concurrent repository assignment. |
| Git Identity Manager 1.6.2 | Yes | Explicit folder/remote mapping | HTTPS/GCM path isolation; SSH aliases; GitHub CLI strategy | Repository-aware token Health and diagnostics | Basic SSH alias support; no GPG workflow | Yes, read-only repository metadata | Windows-first and not yet Marketplace-distributed; full two-account/cross-platform evidence is pending. |

## What should differentiate this product

The durable product advantage should be **verified project context**, not the act of switching:

- Show the assigned identity, authentication state, and repository together.
- Prefer repository-local configuration over changing machine-wide state.
- Detect mismatches before a destructive or remote operation.
- Keep extension, desktop, CLI, and AI tools on the same profile and mapping data.
- Report limitations and verification status without implying unsupported isolation.

Areas where competitors currently set a useful benchmark include Marketplace distribution, SSH/GPG signing, submodule handling, localization, multi-provider support, and polished cloning workflows. These are candidates for product decisions, not automatic commitments.

## Sources

- [GitHub: Managing multiple accounts](https://docs.github.com/en/account-and-profile/how-tos/account-management/managing-multiple-accounts)
- [Git Credential Manager: Multiple users](https://github.com/git-ecosystem/git-credential-manager/blob/main/docs/multiple-users.md)
- [Git Credential Manager: `credential.useHttpPath`](https://github.com/git-ecosystem/git-credential-manager/blob/main/docs/configuration.md#credentialusehttppath)
- [Git: conditional includes and identity configuration](https://git-scm.com/docs/git-config)
- [GitHub CLI: `gh auth switch`](https://cli.github.com/manual/gh_auth_switch)
- [VS Code multiple GitHub account preference test plan](https://github.com/microsoft/vscode/issues/229420)
- [Git ID Switcher](https://marketplace.visualstudio.com/items?itemName=nullvariant.git-id-switcher)
- [GitHub Accounts Switcher](https://marketplace.visualstudio.com/items?itemName=xtawfik.gha-switcher)
- [Git Account Switcher by Revend](https://marketplace.visualstudio.com/items?itemName=RevendLtd.gitaccountswitcher)

For this project's current implementation and verification boundaries, see [README.md](README.md), [SECURITY.md](SECURITY.md), [ROADMAP.md](ROADMAP.md), and [VERIFICATION-CHECKLIST.md](VERIFICATION-CHECKLIST.md).
