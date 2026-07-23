# Tool Intelligence & Catalog Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic enrichment, quality scoring, audit commands, Studio artifacts, and a production build gate for every compiled tool.

**Architecture:** Keep the existing governed `ToolContract` compiler intact, then run an additive enrichment stage that derives model-facing schemas, descriptions, scopes, examples, normalized errors, approval copy, and quality evidence. Store enrichment under `extensions.foundry.tool_intelligence`, write catalog/report artifacts in Studio, and enforce an 85-point production threshold.

**Tech Stack:** TypeScript strict mode, Node.js 22+, Node test runner, JSON Schema Draft 2020-12, zero runtime dependencies.

## Global Constraints

- Preserve all existing policy, approval, OAuth, credential, Ledger, and execution gates.
- Never expose secret values or credential material.
- Never reduce a declared risk class, approval requirement, or scope.
- Keep existing MCP tool names and core ToolContract fields backward compatible.
- All enrichment is deterministic and offline.
- Production threshold: every enabled tool score must be at least 85; demo average must be at least 90.

---

### Task 1: Tool Intelligence Data Model

**Files:**
- Create: `src/tools/types.ts`
- Create: `schemas/tool-example-set.schema.json`
- Create: `schemas/tool-error-contract.schema.json`
- Create: `schemas/tool-quality-report.schema.json`
- Create: `schemas/tool-catalog.schema.json`
- Test: `tests/tool-intelligence-types.test.ts`

**Interfaces:**
- Produces: `ToolArgumentClassification`, `ToolExampleSet`, `ToolErrorContract`, `ToolIntelligence`, `ToolQualityEntry`, `ToolQualityReport`, `ToolCatalog`.

- [ ] Write schema validation tests for valid artifacts and rejection of missing required fields.
- [ ] Run the targeted test and confirm RED because schemas/types do not exist.
- [ ] Add exact TypeScript interfaces and JSON schemas.
- [ ] Run targeted tests and confirm GREEN.
- [ ] Commit `feat(tools): add tool intelligence artifact model`.

### Task 2: Argument Classification and Model Schema

**Files:**
- Create: `src/tools/argument-classifier.ts`
- Test: `tests/tool-argument-classifier.test.ts`

**Interfaces:**
- Produces: `classifyToolArguments(tool): ToolArgumentClassification[]` and `buildModelInputSchema(tool, classifications): Record<string, unknown>`.

- [ ] Write tests proving Authorization/API-key/cookie fields are credential-managed, trace/idempotency fields are runtime-managed, and business/pagination fields remain model arguments.
- [ ] Confirm RED.
- [ ] Implement case-insensitive header/name classification and schema filtering without mutating the original contract.
- [ ] Confirm targeted and regression GREEN.
- [ ] Commit `feat(tools): classify model and runtime arguments`.

### Task 3: Descriptions, Scopes, and Approval Copy

**Files:**
- Create: `src/tools/description-enricher.ts`
- Create: `src/tools/scope-inference.ts`
- Create: `src/tools/approval-presentation.ts`
- Test: `tests/tool-presentation.test.ts`

**Interfaces:**
- Produces: `enrichToolDescription`, `inferRequiredScopes`, `buildApprovalPresentation`.

- [ ] Write tests for customer read/write/delete scopes, specialized approve/refund scopes, property descriptions, bounded task-oriented copy, and human-readable approval summaries.
- [ ] Confirm RED.
- [ ] Implement deterministic domain/action inference; declared scopes always win.
- [ ] Confirm GREEN.
- [ ] Commit `feat(tools): enrich descriptions scopes and approval copy`.

### Task 4: Examples and Error Normalization

**Files:**
- Create: `src/tools/example-generator.ts`
- Create: `src/tools/error-normalizer.ts`
- Test: `tests/tool-examples-errors.test.ts`

**Interfaces:**
- Produces: `generateToolExamples` and `normalizeToolErrors`.

- [ ] Write tests requiring two schema-valid examples, one rejected example, no secret-like values, and mappings for 400/401/403/404/409/422/429/5xx.
- [ ] Confirm RED.
- [ ] Implement deterministic example synthesis from JSON Schema and normalized RFC7807-compatible error metadata.
- [ ] Confirm GREEN.
- [ ] Commit `feat(tools): generate examples and normalized errors`.

### Task 5: Quality Scoring and Catalog Builder

**Files:**
- Create: `src/tools/quality-scorer.ts`
- Create: `src/tools/catalog-builder.ts`
- Create: `src/tools/enrichment-engine.ts`
- Test: `tests/tool-quality-catalog.test.ts`

**Interfaces:**
- Produces: `enrichToolBundle(bundle)`, `scoreToolQuality(tool)`, and `buildToolCatalog(bundle)`.

- [ ] Write tests for the 100-point rubric, status thresholds, aggregate averages, missing-item diagnostics, and additive `extensions.foundry.tool_intelligence` metadata.
- [ ] Confirm RED.
- [ ] Implement the orchestrator and immutable bundle transformation.
- [ ] Confirm demo tools score at least 85 with average at least 90.
- [ ] Commit `feat(tools): build quality-scored tool catalog`.

### Task 6: Studio Pipeline Artifacts

**Files:**
- Modify: `src/studio/pipeline-service.ts`
- Modify: `src/studio/types.ts`
- Modify: `src/studio/api-router.ts`
- Test: `tests/studio-tool-intelligence.test.ts`

**Interfaces:**
- Consumes: `enrichToolBundle` and `buildToolCatalog`.
- Produces: `generated/tool-catalog.json` and `generated/tool-quality-report.json` plus API summary fields.

- [ ] Write a failing Studio build test asserting both files exist and technical headers are absent from model schemas.
- [ ] Confirm RED.
- [ ] Insert the enrichment stage after compilation and before deployment generation.
- [ ] Confirm targeted and Studio regression GREEN.
- [ ] Commit `feat(studio): generate tool intelligence artifacts`.

### Task 7: CLI Audit and Production Quality Gate

**Files:**
- Modify: `src/cli/foundry.ts`
- Modify: `src/studio/deployment-builder.ts`
- Test: `tests/tools-audit-cli.test.ts`
- Test: `tests/studio-quality-gate.test.ts`

**Interfaces:**
- Produces: `foundry tools audit <project> [--json]` and `foundry studio build <project> [--allow-incomplete]`.

- [ ] Write RED tests for successful audit, non-zero incomplete audit, JSON output, blocked production build, and explicit prototype bypass.
- [ ] Implement argument parsing, human report, exit codes, and deployment threshold check.
- [ ] Confirm GREEN without bypassing any existing security gate.
- [ ] Commit `feat(cli): audit tools and enforce production quality`.

### Task 8: Studio UI Tool Quality Panel

**Files:**
- Modify: `studio/assets/app.js`
- Modify: `studio/assets/components.js`
- Modify: `studio/assets/app.css`
- Test: `tests/studio-assets.test.ts`

**Interfaces:**
- Consumes: Studio API tool catalog and quality report.
- Produces: quality badge, score breakdown, scope list, argument classifications, examples, and normalized errors in the Tools screen.

- [ ] Write asset tests for required labels and rendering hooks.
- [ ] Add the quality panel without adding a frontend runtime dependency.
- [ ] Confirm responsive asset tests GREEN.
- [ ] Commit `feat(studio): show tool quality intelligence`.

### Task 9: Release, Installation, and Documentation

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `AGENTS.md`
- Create: `docs/tools/TOOL_INTELLIGENCE_AND_QUALITY.md`
- Create: `docs/releases/verification/SPRINT_1.4_VERIFICATION.md`
- Test: `scripts/test-installed-package.mjs`

**Interfaces:**
- Produces: package version `1.4.0`, installable tarball, cumulative release archive, and documented operator workflow.

- [ ] Update package contents and version.
- [ ] Run typecheck, all tests, secret audit, JSON bundle, npm pack, isolated global install, `foundry tools audit`, Studio build, and archive integrity checks.
- [ ] Record exact counts and SHA-256 values in the verification report.
- [ ] Commit `release: publish Nümtema MCP Foundry 1.4.0`.
