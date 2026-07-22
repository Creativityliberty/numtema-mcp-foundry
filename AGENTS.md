# AGENTS.md — Nümtema MCP Foundry

This file is the operating contract for coding agents working in this repository.

## Mission

Nümtema MCP Foundry transforms OpenAPI 3.x services into governed MCP/ChatGPT applications with OAuth 2.1, approval boundaries, durable dispatch, provider adapters, signed receipts, a local-first Studio, and deployable Coolify/VPS packages.

## Non-negotiable invariants

1. **No secret material in artifacts, logs, fixtures, commits, receipts, bundles, or MCP responses.**
2. **Never weaken risk or approval requirements silently.** Overrides may preserve or raise risk only.
3. **No provider network call before policy, credential, approval, budget, and durable-ledger gates pass.**
4. **Every write operation must be idempotent or explicitly rejected.**
5. **OAuth tokens must be audience-bound, scope-checked, short-lived, and isolated by user/client/workspace/provider account.**
6. **Private keys are generated at first run and stored only in runtime persistent storage.**
7. **Runtime dependencies remain zero unless an ADR explicitly justifies a change.**
8. **All JSON source artifacts must be represented in `bundle/index.json`.**
9. **A completion claim requires fresh typecheck and full test evidence.**

## Repository map

- `src/inspection/` — OpenAPI loading and source inspection.
- `src/mapping/` — capability mapping and risk evidence.
- `src/compiler/` — governed contract compilation.
- `src/adapters/` — provider adapter and request planning.
- `src/auth/` — auth bindings and credential resolution.
- `src/runtime/` — preflight, execution, MCP routing, receipts.
- `src/dispatch/` — durable append-only authorization ledger.
- `src/apps/` — OAuth gateway, Apps SDK resources, approval flow.
- `src/studio/` — Studio project store, pipeline, server, deployment builder.
- `schemas/` — JSON Schemas for public artifacts.
- `tests/` — `node:test` suites; tests mirror subsystem boundaries.
- `studio/` — code-native static Studio UI.
- `docs/` — architecture, product, security, deployment, plans, and verification.
- `bundle/` — exhaustive JSON mirror and checksum index.

## Required local commands

```bash
npm install
npm run typecheck
npm test
npm run bundle:json
npm pack --pack-destination ./release
```

Useful smoke commands:

```bash
foundry doctor
foundry demo
foundry studio init ./tmp-studio --force
foundry studio build ./tmp-studio
foundry app init ./tmp-app --public-base-url http://127.0.0.1:8788 --force
```

## Change workflow

1. Read the relevant contract/schema and adjacent tests first.
2. Add a failing regression test before a bug fix or behavior change.
3. Keep files focused; do not grow the CLI with business logic that belongs in a subsystem.
4. Preserve deterministic ordering, canonical JSON, hashes, and stable artifact versions.
5. Update schemas, docs, examples, `MANIFEST.json`, `CHANGELOG.md`, and bundle inventory when public artifacts change.
6. Run the full suite, not only targeted tests.
7. Run `./scripts/audit-secrets.sh` before any push or release.

## Security review checklist

Reject changes that:

- serialize bearer/API keys, passwords, refresh tokens, private PEM material, or vault locators;
- bypass approval because a model supplied `confirm: true`;
- trust caller-provided user/workspace identity without validating the OAuth token;
- accept a mismatched tool revision, adapter revision, argument hash, audience, tenant, or scope;
- call remote `$ref` URLs during OpenAPI inspection;
- write outside the selected project root;
- expose Studio publicly without an explicit security layer;
- mount the same local ledger directory into multiple active writers without a supported locking model.

## Documentation rules

Keep root Markdown limited to project-wide documents. Product-specific material belongs under `docs/`. Put release evidence under `docs/releases/verification/`, implementation designs under `docs/internal/specs/`, and plans under `docs/internal/plans/`.

## Commit style

Use Conventional Commit prefixes: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`, `security:`. Keep one coherent concern per commit.
