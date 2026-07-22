# OpenAPI Schema Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve and compile real OpenAPI request, response, media, pagination, and error schemas into governed ToolContracts.

**Architecture:** Extend source inspection with a normalized operation schema envelope, carry it through CapabilityMapArtifact, then compile it into ToolContract input/output schemas and Foundry extensions. Keep runtime dependency-free and deterministic.

**Tech Stack:** Node.js 22, TypeScript strict, node:test, JSON Schema Draft 2020-12, zero runtime dependencies.

## Global Constraints

- Preserve backward compatibility for existing v0.4 artifacts.
- No runtime npm dependency.
- Compilation must remain deterministic byte-for-byte.
- OpenAPI references must resolve local `#/components/...` pointers without remote fetching.
- Tool contracts remain drafts until reviewed; enrichment must not weaken policy or approval controls.

---

### Task 1: Normalized OpenAPI schema extraction

**Files:**
- Create: `src/inspection/openapi-schema-extractor.ts`
- Modify: `src/inspection/types.ts`
- Modify: `src/inspection/source-inspector.ts`
- Test: `tests/openapi-schema-enrichment.test.ts`

**Interfaces:**
- Consumes: loaded OpenAPI document and operation/path items.
- Produces: `OperationSchemaEnvelope` with parameters, request body, responses, media, pagination, and errors.

- [ ] Write failing tests for parameter merging, local `$ref` resolution, request body, responses, media, pagination, and error extraction.
- [ ] Run tests and confirm failures are caused by missing enrichment.
- [ ] Implement local reference resolution and normalized schema extraction.
- [ ] Run focused tests and confirm they pass.

### Task 2: Carry enrichment through CapabilityMapArtifact

**Files:**
- Modify: `src/inspection/types.ts`
- Modify: `src/mapping/capability-mapper.ts`
- Modify: `schemas/source-inspection-artifact.schema.json`
- Modify: `schemas/capability-map-artifact.schema.json`
- Test: `tests/openapi-schema-enrichment.test.ts`
- Test: `tests/artifact-schema.test.ts`

**Interfaces:**
- Consumes: `OperationInspection.schema`.
- Produces: `CapabilityCandidate.schema` without loss.

- [ ] Add failing assertions for schema preservation and artifact validation.
- [ ] Run tests and confirm expected failure.
- [ ] Add compatible optional schema fields and update artifact schemas.
- [ ] Run focused tests and confirm pass.

### Task 3: Compile real ToolContract schemas

**Files:**
- Modify: `src/compiler/tool-contract-compiler.ts`
- Modify: `src/compiler/types.ts`
- Test: `tests/tool-contract-compiler.test.ts`
- Test: `tests/openapi-schema-enrichment.test.ts`

**Interfaces:**
- Consumes: enriched `CapabilityCandidate.schema`.
- Produces: true `input_schema`, `output_schema`, and schema fidelity metadata.

- [ ] Add failing tests for path/query/header/body input compilation and success/error output compilation.
- [ ] Run tests and confirm expected failure.
- [ ] Implement deterministic schema composition and conservative fallback.
- [ ] Run focused and full tests.

### Task 4: CLI, examples, documentation, and release proof

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `MANIFEST.json`
- Modify: `package.json`
- Create: `docs/pipeline/inspection/OPENAPI_SCHEMA_ENRICHMENT.md`
- Create: `docs/releases/verification/SPRINT_0.5_VERIFICATION.md`
- Create: `examples/openapi-schema-rich.json`
- Create: `examples/source-inspection.schema-rich.generated.json`
- Create: `examples/capability-map.schema-rich.generated.json`
- Create: `examples/contract-bundle.schema-rich.generated.json`

**Interfaces:**
- Consumes: completed enrichment pipeline.
- Produces: cumulative v0.5 release package.

- [ ] Add schema-rich example and generate all artifacts through CLI.
- [ ] Verify deterministic outputs, negative cases, typecheck, tests, checksums, and ZIP integrity.
- [ ] Document exact behavior and limitations.
- [ ] Package cumulative release.
