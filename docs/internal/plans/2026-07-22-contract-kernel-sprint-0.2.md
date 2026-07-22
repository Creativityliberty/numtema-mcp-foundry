# Contract Kernel Sprint 0.2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a typed Contract Kernel that validates Foundry contracts structurally and semantically through a CLI command named `foundry validate`.

**Architecture:** The kernel remains provider-neutral. JSON Schema handles structural validity; a separate semantic validator evaluates cross-contract invariants such as risk-to-approval consistency, scope coverage, token passthrough prohibition, manifest revision requirements, idempotency semantics, receipt integrity, and tenant binding. The CLI loads YAML or JSON bundles, validates them, and returns deterministic exit codes and machine-readable reports.

**Tech Stack:** Node.js 22, TypeScript 5, built-in `node:test`, zero-dependency JSON Schema subset validator, controlled YAML/JSON loader, zero-dependency CLI parser.

## Global Constraints

- Preserve all Sprint 0.1 constitutional documents and schemas.
- Core code must not contain provider credentials or provider-specific execution logic.
- Tool annotations are hints only and never authorize execution.
- Token passthrough remains prohibited.
- Every write capability must declare idempotency semantics.
- High-impact capabilities require an approval contract bound to subject, tool revision, and arguments hash.
- Validation output must be deterministic and usable by humans and CI.
- No production provider calls are allowed in Sprint 0.2.

---

## File Structure

- `package.json`: project scripts, CLI binary, dependencies.
- `tsconfig.json`: strict TypeScript compilation.
- `src/contracts/types.ts`: canonical TypeScript types for the seven fundamental contracts and bundle format.
- `src/contracts/contract-bundle.ts`: bundle loading and reference indexing.
- `src/schema/schema-registry.ts`: JSON Schema discovery and zero-dependency schema evaluation.
- `src/validation/issues.ts`: deterministic issue/result types.
- `src/validation/schema-validator.ts`: structural validation per contract kind using the schema subset exercised by Foundry schemas.
- `src/validation/semantic-validator.ts`: cross-contract constitutional rules.
- `src/validation/validate-bundle.ts`: validation orchestration.
- `src/cli/foundry.ts`: `foundry validate` command and exit codes.
- `tests/fixtures/*.yaml`: valid and invalid contract bundles.
- `tests/*.test.ts`: TDD coverage.
- `docs/contracts/CONTRACT_KERNEL.md`: public usage and validation rules.

### Task 1: Scaffold the TypeScript Kernel

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `src/contracts/types.ts`
- Test: `tests/types.test.ts`

**Interfaces:**
- Produces: `ContractBundle`, `ToolContract`, `AuthContract`, `PolicyContract`, `ApprovalContract`, `RecoveryContract`, `ReceiptContract`, `FoundryArtifact`.

- [ ] **Step 1: Write the failing type smoke test**

```ts
import { describe, expect, it } from 'vitest';
import type { ContractBundle } from '../src/contracts/types.js';

describe('ContractBundle', () => {
  it('supports the seven canonical contract collections', () => {
    const bundle: ContractBundle = {
      bundle_version: '0.2',
      tools: [], auth: [], policies: [], approvals: [], recoveries: [], receipts: [], artifacts: []
    };
    expect(Object.keys(bundle)).toContain('tools');
  });
});
```

- [ ] **Step 2: Run the test and verify module resolution fails**

Run: `npm test`
Expected: FAIL during TypeScript compilation because `src/contracts/types.ts` does not exist.

- [ ] **Step 3: Add strict package and TypeScript configuration plus canonical types**

Implement exact discriminated interfaces matching the existing JSON Schemas and a `ContractBundle` with seven arrays.

- [ ] **Step 4: Run test and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS with zero TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json src/contracts/types.ts tests/types.test.ts
git commit -m "feat: scaffold typed contract kernel"
```

### Task 2: Register and Validate JSON Schemas

**Files:**
- Create: `src/schema/schema-registry.ts`
- Create: `src/validation/issues.ts`
- Create: `src/validation/schema-validator.ts`
- Test: `tests/schema-validator.test.ts`

**Interfaces:**
- Produces: `createSchemaRegistry(schemaDirectory: string): SchemaRegistry`
- Produces: `validateContract(kind: ContractKind, value: unknown): ValidationIssue[]`

- [ ] **Step 1: Write failing tests for valid and malformed ToolContract values**
- [ ] **Step 2: Run the tests and confirm missing implementation failures**
- [ ] **Step 3: Register all seven schemas and evaluate the JSON Schema keywords used by the Foundry contract schemas**
- [ ] **Step 4: Normalize schema evaluation errors into sorted `ValidationIssue` records**
- [ ] **Step 5: Run tests and typecheck**
- [ ] **Step 6: Commit**

### Task 3: Load YAML/JSON Bundles and Resolve References

**Files:**
- Create: `src/contracts/contract-bundle.ts`
- Create: `tests/fixtures/valid-bundle.yaml`
- Test: `tests/contract-bundle.test.ts`

**Interfaces:**
- Produces: `loadContractBundle(filePath: string): Promise<ContractBundle>`
- Produces: `indexContractBundle(bundle: ContractBundle): ContractIndex`

- [ ] **Step 1: Write failing YAML load and duplicate-ID tests**
- [ ] **Step 2: Verify failures**
- [ ] **Step 3: Implement extension-aware YAML/JSON loading and duplicate reference detection**
- [ ] **Step 4: Run tests and typecheck**
- [ ] **Step 5: Commit**

### Task 4: Implement Constitutional Semantic Rules

**Files:**
- Create: `src/validation/semantic-validator.ts`
- Create: `tests/fixtures/invalid-high-risk.yaml`
- Create: `tests/fixtures/invalid-auth.yaml`
- Test: `tests/semantic-validator.test.ts`

**Interfaces:**
- Produces: `validateSemantics(bundle: ContractBundle): ValidationIssue[]`

- [ ] **Step 1: Write failing tests for these exact rules**
  - read-only tool cannot declare writes or destructive effects;
  - writes require idempotency `supported` or `required`;
  - asynchronous required task support cannot use synchronous execution mode;
  - R3-R5 policies require non-allow decisions;
  - financial tools require `R4` or `R5`, a policy reference, and approval reference;
  - destructive/external communication/credential change tools require approval references;
  - referenced contracts must exist;
  - tool scopes must be included in the linked auth contract;
  - OAuth 2.1 requires audience validation and PKCE;
  - token passthrough must remain false;
  - approval bindings must include subject, tool revision, and arguments hash;
  - receipt completion cannot precede start and hashes must be valid;
  - tenant-required auth must bind credentials to subject and workspace;
  - recovery routes cannot increase risk, scopes, or cost.
- [ ] **Step 2: Verify failing tests**
- [ ] **Step 3: Implement minimal deterministic rule engine**
- [ ] **Step 4: Run full tests and typecheck**
- [ ] **Step 5: Commit**

### Task 5: Build Validation Orchestrator and CLI

**Files:**
- Create: `src/validation/validate-bundle.ts`
- Create: `src/cli/foundry.ts`
- Test: `tests/cli.test.ts`

**Interfaces:**
- Produces: `validateBundle(bundle, options): ValidationReport`
- CLI: `foundry validate <bundle> [--json] [--schemas <dir>]`
- Exit codes: `0` valid, `1` validation issues, `2` load/configuration error.

- [ ] **Step 1: Write failing CLI tests for valid, invalid, and unreadable files**
- [ ] **Step 2: Verify failures**
- [ ] **Step 3: Implement orchestrator, human renderer, JSON renderer, and exit codes**
- [ ] **Step 4: Run CLI tests, full suite, typecheck, and build**
- [ ] **Step 5: Commit**

### Task 6: Document, Audit, and Package Sprint 0.2

**Files:**
- Create: `docs/contracts/CONTRACT_KERNEL.md`
- Create: `docs/internal/specs/2026-07-22-numtema-mcp-foundry-sprint-0.2-design.md`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `MANIFEST.json`
- Modify: `SHA256SUMS.txt`

**Interfaces:**
- Produces: cumulative repository and ZIP archive `numtema-mcp-foundry-v0.2.0-sprint-0.2.zip`.

- [ ] **Step 1: Document CLI usage, validation rules, bundle format, and exit codes**
- [ ] **Step 2: Update version metadata and changelog**
- [ ] **Step 3: Run placeholder, schema, test, typecheck, build, and CLI smoke checks**
- [ ] **Step 4: Generate deterministic checksums excluding `.git`, `.worktrees`, `node_modules`, `dist`, and the checksum file itself**
- [ ] **Step 5: Commit all documentation and packaging metadata**
- [ ] **Step 6: Create and test cumulative ZIP**

## Self-Review

- Spec coverage: all Sprint 0.2 testing requirements map to Tasks 2–5.
- Placeholder scan: no unresolved placeholders are permitted in generated deliverables.
- Type consistency: all validators use `ValidationIssue`, `ValidationReport`, `ContractBundle`, and `ContractIndex` from their canonical modules.
- Scope: runtime execution, OAuth server implementation, marketplace, widgets, and provider calls remain excluded.
