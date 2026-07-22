# Source Inspector + Capability Mapper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ingest OpenAPI 3.x documents and produce deterministic source-inspection and capability-map artifacts.

**Architecture:** Add a minimal OpenAPI loader, a pure inspector, and a pure mapper. Keep provider execution and MCP transport out of scope. Extend the existing zero-runtime-dependency CLI with `inspect` and `map` commands.

**Tech Stack:** Node.js 22, TypeScript 5.8 strict mode, `node:test`, existing controlled YAML parser, zero runtime dependencies.

## Global Constraints

- Preserve all Sprint 0.1 and Sprint 0.2 behavior.
- No remote `$ref` resolution.
- No runtime dependencies.
- All heuristics must return evidence and remain deterministic.
- JSON is the canonical OpenAPI input format; controlled YAML is supported within the existing parser limits.

---

### Task 1: OpenAPI domain types and loader

**Files:**
- Create: `src/inspection/types.ts`
- Create: `src/inspection/openapi-loader.ts`
- Test: `tests/openapi-loader.test.ts`
- Fixtures: `tests/fixtures/openapi-reference.json`, `tests/fixtures/openapi-reference.yaml`, `tests/fixtures/openapi-invalid.json`

**Interfaces:**
- Produces: `loadOpenApiDocument(path): Promise<OpenApiDocument>`
- Produces: `OpenApiLoadError`

- [ ] Write failing loader tests.
- [ ] Run the loader tests and confirm missing-module failure.
- [ ] Implement minimal JSON/YAML loading and OpenAPI 3.0/3.1 root checks.
- [ ] Run tests and commit.

### Task 2: Source Inspector

**Files:**
- Create: `src/inspection/source-inspector.ts`
- Test: `tests/source-inspector.test.ts`

**Interfaces:**
- Consumes: `OpenApiDocument`
- Produces: `inspectOpenApi(document, sourceRef): SourceInspectionArtifact`

- [ ] Write tests for operation extraction and signals.
- [ ] Verify RED.
- [ ] Implement deterministic extraction and evidence.
- [ ] Verify GREEN and commit.

### Task 3: Capability Mapper

**Files:**
- Create: `src/mapping/capability-mapper.ts`
- Test: `tests/capability-mapper.test.ts`

**Interfaces:**
- Consumes: `SourceInspectionArtifact`
- Produces: `mapCapabilities(inspection): CapabilityMapArtifact`

- [ ] Write tests for grouping, naming, risk, governance, collisions, and workflows.
- [ ] Verify RED.
- [ ] Implement mapper.
- [ ] Verify GREEN and commit.

### Task 4: CLI commands

**Files:**
- Modify: `src/cli/foundry.ts`
- Modify: `tests/cli.test.ts`

**Interfaces:**
- Produces: `foundry inspect <openapi> [--json] [--out <file>]`
- Produces: `foundry map <openapi> [--json] [--out <file>]`

- [ ] Add failing CLI tests.
- [ ] Verify RED.
- [ ] Implement command routing, rendering, and output writing.
- [ ] Verify GREEN and commit.

### Task 5: Schemas, examples, documentation, packaging

**Files:**
- Create: `schemas/source-inspection-artifact.schema.json`
- Create: `schemas/capability-map-artifact.schema.json`
- Create: `examples/openapi-reference.json`
- Create: `docs/pipeline/inspection/SOURCE_INSPECTOR.md`
- Create: `docs/pipeline/mapping/CAPABILITY_MAPPER.md`
- Modify: `README.md`, `package.json`, `MANIFEST.json`

- [ ] Add artifact schemas and examples.
- [ ] Update documentation and version metadata.
- [ ] Run typecheck, build, tests, CLI examples, schema parsing, and archive integrity checks.
- [ ] Generate checksums and cumulative ZIP.
