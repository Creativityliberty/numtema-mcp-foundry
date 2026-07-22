# MCP Server Runtime Implementation Plan

> **For agentic workers:** Execute task-by-task with TDD and verify the complete suite after every task.

**Goal:** Build a zero-runtime-dependency MCP server that exposes governed tools and performs authorized provider HTTP execution with signed receipts.

**Architecture:** A pure MCP router delegates `tools/list` to a registry and `tools/call` to a Foundry execution runtime. stdio and Streamable HTTP are thin transports. All side effects remain behind Secure Preflight and the Durable Dispatch Ledger.

**Tech Stack:** Node.js 22, TypeScript strict, JSON-RPC 2.0, MCP 2025-11-25 compatible tool surface, Ed25519, append-only JSONL Ledger, global fetch.

## Global Constraints
- Zero runtime dependencies.
- Deterministic tool ordering and artifact hashing.
- No secret material in artifacts, output, traces, or receipts.
- Bind HTTP to localhost by default and validate Origin.
- Provider errors are MCP tool errors, not protocol errors.

### Task 1: MCP tool registry and JSON-RPC router
- [ ] Add failing tests for initialize, tools/list ordering, annotations, unknown methods, and unknown tools.
- [ ] Implement MCP types, registry, and router.
- [ ] Verify targeted tests.

### Task 2: Governed provider execution runtime
- [ ] Add failing tests for a successful read tool, provider error, missing approval, secret redaction, dispatch commit, and dispatch release.
- [ ] Implement dynamic policy signing, credential boundary, provider executor, and execution receipt signing.
- [ ] Verify targeted tests.

### Task 3: stdio and Streamable HTTP transports
- [ ] Add failing tests for newline-delimited stdio, HTTP POST, Origin rejection, bearer auth, Accept validation, and mirrored MCP headers.
- [ ] Implement transports and config loader.
- [ ] Verify targeted tests.

### Task 4: CLI, schemas, examples, documentation, and packaging
- [ ] Add `foundry mcp inspect`, `foundry mcp serve`, and `foundry mcp smoke`.
- [ ] Add JSON Schemas and a local mock-provider demo.
- [ ] Update package metadata, README, manifest, bundle, release report, npm tarball, and cumulative ZIP.
- [ ] Run typecheck, all tests, installability test, MCP smoke test, checksum validation, and ZIP integrity test.
