# Credential Resolution & Provider Auth Bindings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compile provider authentication bindings from AuthContracts, resolve a credential account against subject/client/workspace/provider constraints, and emit a redacted preflight plan with no secret material.

**Architecture:** Add an isolated `src/auth/` module. `compileProviderAuthBindings()` turns ContractBundle auth definitions plus provider adapters into immutable binding contracts. `resolveCredentialPlan()` selects a matching credential descriptor and emits checks for mode, tenant, scopes, audience, account state, and injection strategy. The CLI exposes `auth-bindings` and `auth-plan` without executing a provider request.

**Tech Stack:** Node.js 22, TypeScript strict, `node:test`, JSON Schema Draft 2020-12, zero runtime dependencies.

## Global Constraints

- Never include access tokens, API keys, passwords, HMAC secrets, or resolved secret values in artifacts, logs, tests, or examples.
- Preserve deterministic ordering and SHA-256 revisions.
- Reject token passthrough and audience/scope mismatches before runtime.
- Keep provider network execution and MCP transport excluded.
- Reorganize Markdown documentation under `docs/` and include every project JSON file in a generated bundle catalog.

---

### Task 1: Auth binding contracts

**Files:**
- Create: `src/auth/types.ts`
- Create: `src/auth/provider-auth-binding-compiler.ts`
- Create: `tests/provider-auth-binding-compiler.test.ts`
- Create: `schemas/provider-auth-binding-bundle.schema.json`

**Interfaces:**
- Consumes: `ContractBundle`, `ProviderAdapterBundle`
- Produces: `compileProviderAuthBindings(bundle, adapters): ProviderAuthBindingBundle`

- [ ] Write failing tests for mode mapping, scopes, dimensions, audience enforcement, and determinism.
- [ ] Run the targeted test and verify missing-module failure.
- [ ] Implement the minimal compiler and stable digest.
- [ ] Validate generated artifacts against the new schema.
- [ ] Run targeted and full tests.

### Task 2: Credential resolution preflight

**Files:**
- Create: `src/auth/credential-resolver.ts`
- Create: `src/auth/loaders.ts`
- Create: `tests/credential-resolver.test.ts`
- Create: `schemas/credential-catalog.schema.json`
- Create: `schemas/credential-resolution-plan.schema.json`

**Interfaces:**
- Consumes: `ProviderAuthBindingContract`, `ProviderAdapterContract`, `CredentialCatalog`, `CredentialResolutionContext`
- Produces: `resolveCredentialPlan(...): CredentialResolutionPlan`

- [ ] Write failing tests for deterministic account selection, scope gaps, OAuth audience mismatch, tenant mismatch, inactive accounts, and redaction.
- [ ] Run the targeted test and verify missing-module failure.
- [ ] Implement account filtering and preflight checks.
- [ ] Emit only opaque `secret_locator` references and `secret_material_included: false`.
- [ ] Validate generated plans against JSON Schema.

### Task 3: CLI and examples

**Files:**
- Modify: `src/cli/foundry.ts`
- Modify: `tests/cli.test.ts`
- Create: `examples/contract-bundle.auth.generated.json`
- Create: `examples/provider-adapters.auth.generated.json`
- Create: `examples/provider-auth-bindings.generated.json`
- Create: `examples/credential-catalog.example.json`
- Create: `examples/credential-context.example.json`
- Create: `examples/credential-resolution-plan.generated.json`

**Interfaces:**
- Produces commands `foundry auth-bindings` and `foundry auth-plan`.

- [ ] Write failing CLI tests.
- [ ] Add argument parsing, loading, human reports, JSON output, and `--out` support.
- [ ] Generate authenticated example artifacts.
- [ ] Verify CLI exit codes and deterministic output.

### Task 4: Documentation and bundle organization

**Files:**
- Create: `docs/README.md`
- Create: `docs/auth/CREDENTIAL_RESOLUTION_AND_AUTH_BINDINGS.md`
- Create: `docs/releases/verification/SPRINT_0.7_VERIFICATION.md`
- Create: `scripts/build-json-bundle.mjs`
- Create: `bundle/index.json`
- Create: `bundle/json/**`
- Modify: `README.md`, `CHANGELOG.md`, `SOURCES.md`, `MANIFEST.json`, `package.json`
- Test: `tests/bundle-completeness.test.ts`

**Interfaces:**
- `npm run bundle:json` mirrors every JSON file outside `bundle/` into `bundle/json/<original-path>` and emits hashes in `bundle/index.json`.

- [ ] Move and classify Markdown documents under the canonical docs tree.
- [ ] Create a documentation index and update all internal links.
- [ ] Write a failing completeness test proving every source JSON is represented.
- [ ] Implement the bundle builder and generate the catalog.
- [ ] Run typecheck, all tests, pipeline commands, secret scans, checksum verification, and ZIP integrity checks.
