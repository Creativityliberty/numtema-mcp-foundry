# Sprint 1.2 Verification — Foundry Studio & One-Click Deployment

**Date:** 2026-07-22  
**Version:** 1.2.0

## Scope verified

- Local-first Studio project creation and persistence
- OpenAPI 3.0/3.1 JSON and YAML import
- Kernel-backed inspection, mapping, contract compilation, adapter compilation, auth binding, and credential catalog generation
- Governed tool overrides with risk and approval downgrade rejection
- Provider/OAuth configuration without secret values in artifacts
- Approval widget preview and provider request dry-run simulation
- Loopback-only HTTP server, CSRF-protected writes, CSP, and traversal protection
- Self-contained Docker package for Coolify and generic VPS hosts
- Persistent runtime volume, required environment variables, and healthcheck
- First-start key generation with zero private keys in the generated deployment package
- npm global installation and Studio execution outside the source tree

## Automated verification

```text
Tests   144 passed
Suites   58 passed
Failed    0
```

The suite includes all previous Contract Kernel, OpenAPI, provider adapter, credential, preflight, Ledger, MCP runtime, OAuth, Apps SDK, and ChatGPT App tests.

## Studio-specific evidence

```text
Example operations       4
Generated capabilities   4
Generated tools          4
Generated adapters       4
Compiler warnings        0
Network executed         false
Secret material included false
Private deployment keys  false
```

## Distribution evidence

The npm installability test performs the following from an unrelated temporary directory:

1. packs the package;
2. installs it globally into an isolated npm prefix;
3. runs `foundry doctor`;
4. initializes a Studio project;
5. runs `foundry studio build`;
6. verifies four generated tools;
7. verifies that the deployment manifest contains no private key.

## Security checks

- A Studio descriptor cannot escape the project root.
- Source bodies larger than 2 MB are rejected.
- Non-loopback Studio binding is rejected.
- Studio write APIs reject missing or incorrect CSRF tokens.
- Risk and approval downgrades are rejected.
- Provider secret values are represented only by environment-variable names.
- The deployment package contains no `.pem` files.
- Keys are generated only in the persistent runtime volume on first start.

## Visual verification note

Functional HTML, responsive CSS, native controls, accessibility labels, API wiring, CSP, desktop breakpoints, and mobile breakpoints are covered by automated tests and live HTTP inspection. A Chromium screenshot comparison could not be completed in the execution sandbox because the installed headless Chromium process was blocked by GPU/runtime permission restrictions. No screenshot-fidelity claim is made for this release.

## Deliberate boundary

The release generates a deployment-ready Compose package but does not authenticate to the user's Coolify account or invoke the Coolify API. Remote creation, deployment polling, logs, health monitoring, and rollback remain a separate connector milestone.
