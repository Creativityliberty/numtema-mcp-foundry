# Installable CLI & First-Run Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `@numtema/mcp-foundry` installable from its folder or npm tarball and usable from any working directory through `foundry doctor`, `foundry demo`, and `foundry init`.

**Architecture:** A package-asset resolver locates the installed package root from `import.meta.url`, removing all current-working-directory assumptions. First-run commands consume only bundled assets and emit deterministic reports or starter projects. Installation is proven by packing the project, installing the tarball into an isolated prefix, and invoking the global binary from an unrelated directory.

**Tech Stack:** Node.js 22, TypeScript 5.8, `node:test`, npm pack/install, zero runtime dependencies.

## Global Constraints

- Keep zero runtime dependencies.
- Do not execute provider network requests.
- Do not include credentials or secret material in reports or generated projects.
- Preserve every existing CLI command and all 81 baseline tests.
- Store internal plans under `docs/internal/plans/` and release evidence under `docs/releases/verification/`.
- Include all project JSON files in the cumulative `bundle/json/` mirror.

---

### Task 1: Portable package asset resolution

**Files:**
- Create: `src/system/package-assets.ts`
- Modify: `src/schema/schema-registry.ts`
- Modify: `src/validation/validate-bundle.ts`
- Modify: `src/compiler/capability-map-loader.ts`
- Modify: `src/auth/loaders.ts`
- Test: `tests/package-assets.test.ts`

**Interfaces:**
- Produces: `getPackageRoot(): string`, `resolvePackageAsset(...segments: string[]): string`, `getPackageMetadata(): PackageMetadata`.
- Consumers: CLI doctor/demo and all default schema loaders.

- [ ] Write tests that change the process working directory and still locate `package.json`, `schemas/`, and the bundled demo OpenAPI file.
- [ ] Run the focused test and verify failure because the package asset module does not exist.
- [ ] Implement upward package-root discovery from `import.meta.url` and use it for every default schema path.
- [ ] Run the focused test and all existing tests.

### Task 2: Doctor, help, and version commands

**Files:**
- Create: `src/cli/doctor.ts`
- Modify: `src/cli/foundry.ts`
- Test: `tests/first-run-cli.test.ts`

**Interfaces:**
- Produces: `runDoctor(): Promise<DoctorReport>` and CLI commands `foundry doctor`, `foundry --help`, `foundry --version`.

- [ ] Write failing tests for healthy doctor output from an unrelated working directory, JSON output, help, and version.
- [ ] Implement checks for Node 22+, package metadata, schemas, demo assets, and writable current directory.
- [ ] Verify healthy exit code `0`, unhealthy exit code `1`, and usage exit code `2`.

### Task 3: Deterministic first-run demo

**Files:**
- Create: `src/cli/demo.ts`
- Modify: `src/cli/foundry.ts`
- Test: `tests/first-run-cli.test.ts`

**Interfaces:**
- Produces: `runDemoPipeline(options): Promise<DemoReport>` and CLI command `foundry demo [--json] [--out-dir DIR]`.

- [ ] Write a failing test proving the demo runs outside the package directory.
- [ ] Compile the bundled OpenAPI through inspect, map, contract compile, validation, and provider-adapter compilation.
- [ ] When `--out-dir` is provided, write four deterministic artifacts without network execution.
- [ ] Verify the report exposes operation, capability, tool, policy, adapter, error, and warning counts.

### Task 4: Starter project initialization

**Files:**
- Create: `src/cli/init-project.ts`
- Modify: `src/cli/foundry.ts`
- Test: `tests/first-run-cli.test.ts`

**Interfaces:**
- Produces: `initializeProject(options): Promise<InitProjectReport>` and CLI command `foundry init [directory] [--name NAME] [--force] [--json]`.

- [ ] Write failing tests for a new project, refusal to overwrite a non-empty directory, and forced replacement.
- [ ] Generate `foundry.config.json`, `openapi.json`, `package.json`, `README.md`, and `.gitignore`.
- [ ] Keep the project dependency-free and provide scripts that call the globally installed `foundry` binary.
- [ ] Verify the generated OpenAPI passes `foundry inspect`, `map`, and `compile`.

### Task 5: npm package and clean-install proof

**Files:**
- Modify: `package.json`
- Create: `scripts/install.sh`
- Create: `scripts/install.ps1`
- Create: `tests/installability.test.ts`
- Modify: `README.md`

**Interfaces:**
- Produces: npm tarball containing `dist/`, `schemas/`, bundled demo assets, installer scripts, and documentation; globally available `foundry` binary.

- [ ] Write an integration test that runs `npm pack`, installs the tarball into an isolated npm prefix, and invokes `foundry doctor` and `foundry demo` from another directory.
- [ ] Add package `files`, version `0.8.1`, install scripts, and first-run npm scripts.
- [ ] Verify the packed tarball has no runtime dependencies and does not require the source tree.
- [ ] Verify Unix and PowerShell installer scripts call local-folder global installation and then `foundry doctor`.

### Task 6: Release evidence and cumulative bundle

**Files:**
- Create: `docs/releases/verification/SPRINT_0.8.1_VERIFICATION.md`
- Create: `docs/product/INSTALLATION_AND_FIRST_RUN.md`
- Modify: `docs/README.md`
- Modify: `CHANGELOG.md`
- Modify: `MANIFEST.json`
- Regenerate: `bundle/index.json`, `bundle/json/**`, `SHA256SUMS.txt`

**Interfaces:**
- Produces: verified cumulative v0.8.1 ZIP and npm tarball.

- [ ] Run typecheck, build, full tests, bundle completeness, npm pack, isolated global install, doctor, demo, and init smoke tests.
- [ ] Record exact commands, counts, hashes, and known limitations.
- [ ] Regenerate the exhaustive JSON mirror and checksums.
- [ ] Create and test the cumulative ZIP.
