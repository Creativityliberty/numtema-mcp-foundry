# Sprint 0.9 Verification Report

## Release

- Product: Nümtema MCP Foundry
- Version: 0.9.0
- Sprint: Durable Dispatch Authorization Ledger
- Date: 2026-07-22
- Runtime dependencies: 0
- Provider network requests performed by the Ledger: 0

## Verified behavior

The release was verified against the complete sequence:

```text
typecheck → build → 96 tests → JSON bundle → npm pack → isolated global install → doctor → ledger init → dispatch reserve → dispatch commit → receipt verify → ledger status
```

The isolated installation used the produced npm tarball and an unrelated working directory. It reached ledger sequence 2 with one reservation in `dispatched` state and 25 EUR counted as active/dispatched budget.

## Automated verification

- Test suites: 35
- Tests: 96
- Passed: 96
- Failed: 0
- TypeScript strict typecheck: passed
- npm global install in isolated prefix: passed
- Global symlink execution: passed
- `foundry doctor`: 12/12 checks passed
- `foundry ledger init`: passed
- `foundry dispatch reserve`: passed
- `foundry dispatch commit`: passed
- `foundry dispatch verify`: passed
- `foundry ledger status`: passed

## Ledger security tests

- Exact idempotent retry appends no second event: passed
- Idempotency key with altered envelope: rejected
- Execution nonce reuse: rejected
- Approval nonce reuse: rejected by the same durable reservation path
- Concurrent budget oversubscription: one reservation accepted, one rejected
- Dispatch from non-reserved state: rejected
- Release after dispatch: rejected
- Released budget becomes inactive: passed
- Released nonce remains permanently consumed: passed
- Corrupted event digest: rejected before read or mutation
- Ed25519 dispatch receipt verification: passed
- Private signing key absent from distributed examples: passed
- Secret-pattern scan across installed test output and examples: passed

## Durable storage evidence

- Journal format: append-only JSON Lines
- Example journal events: 2
- Lock primitive: atomic directory creation
- Mutation durability: journal file `fsync` before lock release
- Chain integrity: contiguous sequence + previous-event digest + event SHA-256
- Source of truth: `events.jsonl`; snapshots are reconstructed

## Distributed JSON bundle

- JSON source files mirrored: 76
- Index: `bundle/index.json`
- Each entry includes source path, bundle path, byte size and SHA-256

## npm package

- File: `release/numtema-mcp-foundry-0.9.0.tgz`
- Size: 81782 bytes
- SHA-256: `b46e3d803d0ff44ff21e5625525ec4b06bdab8addc2c94590e13322f1dc0e8d1`

## Generated public examples

- Reservation receipt SHA-256: `800a823568e1963069e1dfaf5bd8194c86363fcdb4dcc47eb6c9059f84a9c8dd`
- Dispatch receipt SHA-256: `7cc6a94926c2a22b581bdbcae7a5fc8c590c5ea08434b37ad5ccb9eafcb6bc85`
- Ledger snapshot SHA-256: `6de1f46f9c9ebcf39241f6359d02b832ea7ba2e5aa59950842b50eb384f19b47`
- Private signing keys distributed: none

## Explicit boundary

Sprint 0.9 provides durable local single-host authorization and replay prevention. It does not provide distributed consensus across multiple machines, provider HTTP execution, live credential retrieval/injection, or MCP transport. Those remain subsequent runtime layers.
