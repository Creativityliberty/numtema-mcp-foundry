# Publishing to GitHub

Current delivery repository: `Creativityliberty/aimcp`.

The connected GitHub integration initialized this public repository with the governance documents and Coolify runbook. Rename it to `numtema-mcp-foundry` from GitHub **Settings → General → Repository name** when desired.

## Publish the complete source tree

Download and extract the v1.3 ZIP, then run from the project root:

```bash
./scripts/publish-github.sh Creativityliberty/aimcp
```

The script:

1. runs the secret audit;
2. runs TypeScript type checking;
3. runs the complete test suite;
4. creates or updates the `origin` remote;
5. renames the working branch to `main`;
6. pushes the complete repository.

After renaming the GitHub repository:

```bash
./scripts/publish-github.sh Creativityliberty/numtema-mcp-foundry
```

## Recommended GitHub settings

- Default branch: `main`.
- Require pull requests and the `CI / verify` check.
- Enable secret scanning and push protection.
- Enable private vulnerability reporting.
- Disable force pushes and branch deletion on `main`.
- Prefer squash merges and delete merged branches.
- Keep production `.env`, private keys, Ledger state, and generated OAuth users out of Git.

## Current bootstrap status

The GitHub repository already contains:

```text
README.md
AGENTS.md
CONTRIBUTING.md
SECURITY.md
.github/workflows/ci.yml
.github/pull_request_template.md
docs/deployment/COOLIFY_CONFIGURATION.md
docs/deployment/GITHUB_PUBLISHING.md
scripts/audit-secrets.sh
scripts/publish-github.sh
```

The complete source tree is distributed in the v1.3 ZIP and is pushed by the guarded script above.
