# Sprint 1.3 Verification — GitHub Publishing & Coolify Runbook

## Scope

- Root `AGENTS.md` for coding agents.
- GitHub CI and contribution/security templates.
- Guarded GitHub publication and secret-audit scripts.
- Exact Coolify field configuration and operator checklist.
- Studio deployment rebuild recursion fix.

## Fresh verification

```text
Node.js strict typecheck: pass
Automated tests: 145
Test suites: 59
Failures: 0
Runtime dependencies: 0
Secret audit: pass
Studio package built twice: pass
Recursive deployment package copy: absent
```

## Security evidence

- No `.pem`, `.env`, private-key file, GitHub token, OpenAI-style key, or private PEM block is distributed.
- Coolify secrets are documented as runtime-only values.
- Persistent cryptographic and ledger data is isolated in `/data`.
- The generated Compose healthcheck targets protected-resource metadata.

## GitHub publication status

The authenticated GitHub identity is `Creativityliberty`. The existing public repository `Creativityliberty/aimcp` was initialized on branch `main` with the project README, `AGENTS.md`, security/contribution rules, CI bootstrap, publication scripts, and the exact Coolify runbook. The connector cannot rename repositories, so the owner may rename it to `numtema-mcp-foundry` from GitHub settings. The guarded `publish-github.sh` command pushes the complete local source tree.

## Distribution verification

`@numtema/mcp-foundry@1.3.0` was packed and installed into an isolated npm prefix.

`foundry --version` returned `1.3.0` and `foundry doctor --json` reported `healthy: true` with 19 passed checks.

The final package and ZIP SHA-256 values are recorded in the external release handoff after the immutable archives are built.
