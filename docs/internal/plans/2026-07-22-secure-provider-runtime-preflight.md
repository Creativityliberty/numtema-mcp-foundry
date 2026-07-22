# Secure Provider Runtime Preflight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a cryptographically verified, fail-closed AuthorizedExecutionEnvelope without performing network I/O.

**Architecture:** Add a pure runtime-preflight module that consumes existing redacted execution and credential plans plus signed governance artifacts. Verify canonical integrity, Ed25519 signatures, exact cross-artifact bindings, approval requirements, budget limits, expiration, and secret absence before emitting a deterministic envelope.

**Tech Stack:** Node.js 22, TypeScript strict, node:test, built-in node:crypto, zero runtime dependencies.

## Global Constraints

- Preserve all Sprint 0.7 behavior and tests.
- No network request or provider secret material in this sprint.
- All new JSON artifacts must be bundled under `bundle/json`.
- All Markdown remains classified under `docs/` except README, CHANGELOG, and SOURCES at project root.

---

### Task 1: Runtime artifact contracts

**Files:**
- Create: `src/runtime/types.ts`
- Create: `schemas/runtime-policy-decision.schema.json`
- Create: `schemas/approval-proof.schema.json`
- Create: `schemas/budget-authorization.schema.json`
- Create: `schemas/runtime-trust-store.schema.json`
- Create: `schemas/authorized-execution-envelope.schema.json`
- Test: `tests/runtime-artifact-schema.test.ts`

**Interfaces:**
- Produces: `RuntimePolicyDecision`, `ApprovalProof`, `BudgetAuthorization`, `RuntimeTrustStore`, `AuthorizedExecutionEnvelope`.

- [ ] Write schema validation tests that fail before the schemas and types exist.
- [ ] Implement the contracts and schemas.
- [ ] Run the focused tests and preserve zero runtime dependencies.

### Task 2: Signature and integrity verifier

**Files:**
- Create: `src/runtime/canonical.ts`
- Create: `src/runtime/signature-verifier.ts`
- Test: `tests/runtime-signature-verifier.test.ts`

**Interfaces:**
- Produces: `canonicalJson(value)`, `sha256(value)`, `verifySignedArtifact(artifact, trustStore, purpose)`.

- [ ] Write failing tests for valid signature, altered payload, unknown key, and wrong key purpose.
- [ ] Implement canonical digest and Ed25519 verification using Node crypto.
- [ ] Run focused tests.

### Task 3: Secure preflight engine

**Files:**
- Create: `src/runtime/secure-preflight.ts`
- Test: `tests/secure-preflight.test.ts`

**Interfaces:**
- Consumes: execution plan, credential plan, policy decision, optional approval, optional budget, trust store, current timestamp.
- Produces: `authorizeExecution(input): AuthorizedExecutionEnvelope`.

- [ ] Write failing tests for a valid R4 action and every fail-closed gate.
- [ ] Implement exact cross-artifact checks, signature checks, time checks, budget checks, approval checks, and redaction checks.
- [ ] Confirm deterministic output for identical inputs.

### Task 4: Loaders and CLI

**Files:**
- Create: `src/runtime/loaders.ts`
- Modify: `src/cli/foundry.ts`
- Modify: `package.json`
- Test: `tests/cli.test.ts`

**Interfaces:**
- Produces: `foundry preflight --execution-plan ... --credential-plan ... --policy ... --trust-store ... [--approval ...] [--budget ...] [--at ...] [--out ...]`.

- [ ] Write failing CLI tests for ready and blocked envelopes.
- [ ] Implement loaders, argument parsing, output, and exit codes 0/1/2.
- [ ] Run CLI tests.

### Task 5: Examples, docs, release proof

**Files:**
- Create signed examples under `examples/runtime/`.
- Create: `docs/runtime/SECURE_PROVIDER_RUNTIME_PREFLIGHT.md`
- Create: `docs/releases/verification/SPRINT_0.8_VERIFICATION.md`
- Modify: `README.md`, `CHANGELOG.md`, `MANIFEST.json`, `SOURCES.md`, `package.json`.

- [ ] Generate static signed examples without distributing private keys.
- [ ] Run typecheck, full tests, CLI pipeline, secret scan, deterministic checks, bundle rebuild, checksum verification, and ZIP integrity test.
- [ ] Package the cumulative Sprint 0.8 archive.
