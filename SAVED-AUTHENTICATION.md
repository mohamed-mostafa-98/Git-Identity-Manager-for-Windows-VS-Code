# Saved authentication (version 1.3.0)

Add each GitHub account once, then assign each repository to the account it should use.

1. Install the new VSIX and reload VS Code.
2. Run **GitHub: Add Account Profile**. Choose **Personal Access Token** and paste the token into the masked input, or choose browser OAuth. Token ownership is checked against GitHub before saving.
3. Open a project whose remote is `https://github.com/owner/repository.git`.
4. Open **GitHub: Open Control Panel Dashboard**, find the account, and click **Use for This Project**. This applies its Git identity and credentials and saves an exact repository mapping. Alternatively use **GitHub: Map Project to Account** for folder or organization rules.
5. Fetch, pull and push normally. With a valid saved token and repository permission, Git can reuse Windows Credential Manager without another browser login.

Existing profiles: use **GitHub: Save or Update Account Token**, or the dashboard's **Save / Update Token** button. Other mapped repositories receive the replacement when next opened or synchronized. Switching explicitly works even when automatic switching is disabled. A more specific folder assignment wins over a parent folder rule.

## Token access

Choose only the repositories and permissions you need. For a fine-grained token, Git reads require repository Contents read access and pushes require Contents write access. Updating workflow files can require Workflows permission. Organization approval or SSO authorization may also be required. See [GitHub's token documentation](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens) for your account's options.

Use the account **Health** button with a repository open to check token ownership, repository visibility, SSO/rate-limit responses, and whether GitHub accepts the token at the Git push-service endpoint. The check does not push. Branch rules, workflow-file permissions, and a different credential cached by terminal Git can still reject a particular push. Renew the token with the update command rather than repeatedly clearing all credentials.

## Storage and scope

Tokens live in VS Code SecretStorage and are passed to Git Credential Manager through standard input for storage in Windows Credential Manager. No token is placed in a remote URL, Git config, process arguments or profile metadata. Repository-local GitHub helper settings select GCM, the account username and path isolation. See [Git credential handling](https://git-scm.com/docs/gitcredentials) and [GCM credential stores](https://github.com/git-ecosystem/git-credential-manager/blob/main/docs/credstores.md).

This version supports saved tokens for GitHub.com HTTPS remotes on Windows with GCM installed. SSH and GitHub CLI retain their separate authentication methods. A multi-folder VS Code workspace still targets its first folder; open projects in separate windows for independent assignments. Creating an account alone does not assign the current project.

Removing an extension profile deletes its SecretStorage token and mappings; it does not revoke the token on GitHub or remove existing GCM entries. To revoke access, revoke the token in GitHub settings and remove the corresponding Windows credential if needed.

The existing push guard remains advisory: it does not intercept every Git push or enforce terminal push cancellation. This release improves reusable Git authentication, not the GitHub Actions workflow-management UI.

## Verification

`npm run test:unit` compiles and runs regression checks for token ownership/storage, GCM invocation and failures, unsafe credential destinations, stdin handling, folder mappings, and explicit account switching. Live two-account GitHub push/pull validation requires your accounts and has not been performed by the automated tests.
