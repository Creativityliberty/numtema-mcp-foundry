# Foundry Studio & One-Click Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Add a local-first Studio and deterministic deployment-package generator on top of the v1.1 Foundry kernel.

**Architecture:** A zero-runtime-dependency Node HTTP server exposes project, pipeline, simulation, and build APIs. A prebuilt static SPA calls those APIs. Existing compiler/runtime modules remain the single source of truth.

**Tech Stack:** Node.js 22, TypeScript strict, node:test, platform HTML/CSS/JavaScript, existing Foundry kernel.

## Global Constraints

- Preserve zero runtime npm dependencies.
- Never serialize provider secrets or generated private keys.
- Bind Studio to loopback by default.
- Keep generated artifacts deterministic.
- Keep root documentation limited to README, CHANGELOG, and SOURCES.
- Copy all JSON artifacts into the cumulative bundle.

---

### Task 1: Project Store and Studio Contracts

**Files:**
- Create: `src/studio/types.ts`
- Create: `src/studio/project-store.ts`
- Create: `schemas/studio-project.schema.json`
- Test: `tests/studio-project-store.test.ts`

**Produces:** `createStudioProject`, `loadStudioProject`, `saveStudioProject`, atomic project layout, and non-secret project descriptor.

- [ ] Write failing tests for creation, reload, atomic writes, and traversal rejection.
- [ ] Run targeted tests and confirm failure.
- [ ] Implement types and store.
- [ ] Run targeted tests and confirm pass.

### Task 2: Pipeline Service and Overrides

**Files:**
- Create: `src/studio/pipeline-service.ts`
- Create: `src/studio/tool-overrides.ts`
- Test: `tests/studio-pipeline-service.test.ts`

**Consumes:** OpenAPI loader, inspector, mapper, compiler, adapter compiler.

**Produces:** deterministic inspection/build pipeline and auditable tool override application.

- [ ] Write failing tests for import, build, rename, disable, and forbidden downgrade.
- [ ] Run targeted tests and confirm failure.
- [ ] Implement the minimal pipeline and override layer.
- [ ] Run targeted tests and confirm pass.

### Task 3: Deployment Package Generator

**Files:**
- Create: `src/studio/deployment-builder.ts`
- Create: `schemas/deployment-package-manifest.schema.json`
- Create: `studio/templates/deploy/`
- Test: `tests/studio-deployment-builder.test.ts`

**Produces:** standalone ChatGPT App runtime, Docker/Coolify/VPS files, environment checklist, health configuration, and connection guide.

- [ ] Write failing tests for required files, no private keys, environment placeholders, and deterministic manifest.
- [ ] Run targeted tests and confirm failure.
- [ ] Implement package generation using v1.1 app initialization primitives.
- [ ] Run targeted tests and confirm pass.

### Task 4: Studio HTTP API

**Files:**
- Create: `src/studio/server.ts`
- Create: `src/studio/api-router.ts`
- Test: `tests/studio-server.test.ts`

**Produces:** loopback HTTP server, CSRF-protected write APIs, static asset serving, and stable JSON response envelopes.

- [ ] Write failing tests for health, source import, build, traversal, body limits, and CSRF.
- [ ] Run targeted tests and confirm failure.
- [ ] Implement router and server.
- [ ] Run targeted tests and confirm pass.

### Task 5: Premium Static Studio UI

**Files:**
- Create: `studio/index.html`
- Create: `studio/assets/app.css`
- Create: `studio/assets/app.js`
- Create: `studio/assets/components.js`
- Test: `tests/studio-assets.test.ts`

**Produces:** dashboard, wizard navigation, inspection view, tool editor, auth form, widget preview, simulator, and deployment console.

- [ ] Write failing asset and accessibility smoke tests.
- [ ] Run targeted tests and confirm failure.
- [ ] Implement the complete static UI with responsive layouts and no external assets.
- [ ] Run targeted tests and confirm pass.

### Task 6: CLI Integration

**Files:**
- Modify: `src/cli/foundry.ts`
- Modify: `src/system/package-assets.ts`
- Modify: `package.json`
- Test: `tests/studio-cli.test.ts`

**Produces:** `foundry studio init`, `foundry studio serve`, `foundry studio inspect`, and `foundry studio build`.

- [ ] Write failing CLI tests from an external working directory.
- [ ] Run targeted tests and confirm failure.
- [ ] Add CLI handlers and packaged asset resolution.
- [ ] Run targeted tests and confirm pass.

### Task 7: Documentation, Examples, and Release

**Files:**
- Create: `docs/studio/FOUNDRY_STUDIO.md`
- Create: `docs/deployment/COOLIFY_AND_VPS_ONE_CLICK.md`
- Create: `docs/releases/verification/SPRINT_1.2_VERIFICATION.md`
- Modify: `README.md`, `CHANGELOG.md`, `SOURCES.md`, `MANIFEST.json`
- Create: `examples/studio/`

**Produces:** installable npm package, cumulative JSON bundle, verification report, and release ZIP.

- [ ] Regenerate examples and bundle.
- [ ] Run typecheck and full test suite.
- [ ] Build npm tarball and install globally in a clean prefix.
- [ ] Create a Studio project, build deployment package, and validate extraction.
- [ ] Scan package and ZIP for private keys and secret values.
- [ ] Generate checksums and final archives.
