# Tool Contract Compiler Sprint 0.4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compile a CapabilityMapArtifact into a deterministic, validated ContractBundle.

**Architecture:** Add an isolated compiler package with a strict artifact loader, deterministic contract factories, workflow recovery linking, and a CLI command that validates its own output through the existing Contract Kernel.

**Tech Stack:** TypeScript strict, Node.js 22 built-ins, node:test, existing zero-dependency schema and semantic validators.

## Global Constraints

- Zero runtime dependencies.
- Preserve ContractBundle version `0.2` and CapabilityMap version `0.3`.
- No network calls or current timestamps during compilation.
- Generated high-risk capabilities must never default to `allow`.
- Every generated bundle must pass structural and semantic validation.

---

### Task 1: Capability map loader

**Files:**
- Create: `src/compiler/capability-map-loader.ts`
- Test: `tests/tool-contract-compiler.test.ts`

**Interfaces:**
- Produces: `loadCapabilityMap(path: string): Promise<CapabilityMapArtifact>`

- [ ] Write failing tests for JSON/YAML loading and stable rejection codes.
- [ ] Run tests and confirm missing-module failure.
- [ ] Implement the strict loader using the controlled YAML parser.
- [ ] Run tests and confirm loader cases pass.

### Task 2: Contract compiler

**Files:**
- Create: `src/compiler/types.ts`
- Create: `src/compiler/tool-contract-compiler.ts`
- Test: `tests/tool-contract-compiler.test.ts`

**Interfaces:**
- Produces: `compileCapabilityMap(map, options?): CompilationResult`

- [ ] Write failing tests for tool, auth, policy, approval, recovery, validity, and determinism.
- [ ] Verify expected failures.
- [ ] Implement minimal deterministic factories and workflow linking.
- [ ] Run focused tests and refactor while green.

### Task 3: CLI compile command

**Files:**
- Modify: `src/cli/foundry.ts`
- Modify: `tests/cli.test.ts`

**Interfaces:**
- Produces: `foundry compile` command with `--out`, `--json`, and `--schemas`.

- [ ] Write failing CLI tests.
- [ ] Verify usage failure.
- [ ] Implement compile argument parsing, output, validation, and report rendering.
- [ ] Run CLI tests and full test suite.

### Task 4: Documentation and release package

**Files:**
- Create: `docs/pipeline/compiler/TOOL_CONTRACT_COMPILER.md`
- Create: `docs/releases/verification/SPRINT_0.4_VERIFICATION.md`
- Modify: `README.md`, `CHANGELOG.md`, `package.json`, `MANIFEST.json`, `SOURCES.md`
- Create: `examples/contract-bundle.generated.json`

- [ ] Generate and validate the example bundle.
- [ ] Document limitations and exact commands.
- [ ] Run build, typecheck, tests, CLI validation, determinism check, checksum verification, and ZIP integrity test.
- [ ] Commit the cumulative sprint.
