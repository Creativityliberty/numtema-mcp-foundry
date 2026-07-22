# Provider Adapter Contracts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build deterministic provider adapter contracts and dry-run HTTP execution plans from enriched ToolContracts.

**Architecture:** Keep the Contract Kernel immutable. Add an adapter layer that reads `extensions.foundry` metadata, compiles HTTP binding contracts, validates them, plans requests without network access, and normalizes simulated provider responses.

**Tech Stack:** Node.js 22, TypeScript strict, `node:test`, zero runtime dependencies, JSON Schema Draft 2020-12 subset.

## Global Constraints

- No network I/O.
- No token passthrough or secret values in artifacts.
- Preserve backward compatibility with v0.5 ContractBundles.
- All output ordering and hashes must be deterministic.

---

### Task 1: Adapter contract types and compiler

**Files:**
- Create: `src/adapters/types.ts`
- Create: `src/adapters/provider-adapter-compiler.ts`
- Test: `tests/provider-adapter-compiler.test.ts`

**Interfaces:**
- Consumes: `ContractBundle`, `ToolContract`
- Produces: `compileProviderAdapters(bundle): ProviderAdapterBundle`

- [ ] Write failing tests for HTTP bindings, body/media metadata, idempotency, and deterministic output.
- [ ] Run the focused test and confirm missing-module failure.
- [ ] Implement the minimal compiler.
- [ ] Run the focused test and full suite.

### Task 2: Dry-run request planner

**Files:**
- Create: `src/adapters/request-planner.ts`
- Test: `tests/request-planner.test.ts`

**Interfaces:**
- Consumes: `ProviderAdapterContract`, argument object, base URL
- Produces: `planProviderRequest(...): ProviderExecutionPlan`

- [ ] Write failing tests for path/query/header/cookie/body serialization and missing required values.
- [ ] Confirm RED.
- [ ] Implement deterministic request planning and idempotency headers.
- [ ] Confirm GREEN and no regressions.

### Task 3: Response normalizer

**Files:**
- Create: `src/adapters/response-normalizer.ts`
- Test: `tests/response-normalizer.test.ts`

**Interfaces:**
- Consumes: adapter contract and simulated HTTP response
- Produces: `normalizeProviderResponse(...): NormalizedProviderResponse`

- [ ] Write failing tests for JSON success, problem+json error, retryability, empty and binary responses.
- [ ] Confirm RED.
- [ ] Implement minimal normalization.
- [ ] Confirm GREEN.

### Task 4: Schemas and CLI

**Files:**
- Create: `schemas/provider-adapter-bundle.schema.json`
- Create: `schemas/provider-execution-plan.schema.json`
- Modify: `src/cli/foundry.ts`
- Modify: `tests/cli.test.ts`
- Create: `tests/provider-artifact-schema.test.ts`

**Interfaces:**
- Produces: `foundry adapters` and `foundry plan`

- [ ] Write failing CLI and schema tests.
- [ ] Confirm RED.
- [ ] Implement commands and artifact validation.
- [ ] Confirm GREEN.

### Task 5: Release evidence

**Files:**
- Modify: `package.json`, `README.md`, `CHANGELOG.md`, `MANIFEST.json`, `SHA256SUMS.txt`
- Create: `docs/pipeline/adapters/PROVIDER_ADAPTER_CONTRACTS.md`
- Create: `docs/releases/verification/SPRINT_0.6_VERIFICATION.md`
- Create: generated examples under `examples/`

- [ ] Generate deterministic examples.
- [ ] Run typecheck, full tests, negative cases, checksum validation, and ZIP integrity checks.
- [ ] Commit the release candidate and package the cumulative ZIP.
