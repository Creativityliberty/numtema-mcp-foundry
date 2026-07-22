# Sprint 0.4 Verification Report

## Release

```text
Product: Nümtema MCP Foundry
Version: 0.4.0
Sprint: 0.4 — Tool Contract Compiler
Date: 2026-07-22
Runtime dependencies: 0
Node minimum: 22
```

## Verified scope

The release compiles a validated `CapabilityMapArtifact 0.3` into a deterministic `ContractBundle 0.2` containing:

```text
8 ToolContracts
1 AuthContract
8 PolicyContracts
3 ApprovalContracts
1 RecoveryContract
0 ReceiptContracts
0 FoundryArtifacts
```

The empty receipt and artifact collections are intentional: Sprint 0.4 defines executable contract drafts but does not execute tools or sign evidence.

## Type safety

Command:

```bash
npm run typecheck
```

Result:

```text
PASS — TypeScript strict compilation completed with zero diagnostics.
```

## Automated tests

Command:

```bash
npm test
```

Result:

```text
38 tests
13 suites
38 passed
0 failed
0 skipped
```

Coverage includes:

- JSON and controlled-YAML CapabilityMap loading;
- CapabilityMap JSON Schema rejection;
- one tool and policy per capability;
- auth omission for unscoped APIs;
- R3, R4, and R5 approval generation;
- financial cost-summary binding;
- workflow recovery compilation;
- stable SHA-256 tool revisions;
- deep deterministic output;
- CLI success and failure exit codes;
- complete Contract Kernel regression suite.

## End-to-end pipeline

Commands:

```bash
foundry inspect examples/openapi-reference.json
foundry map examples/openapi-reference.json
foundry compile capability-map.json
foundry validate contract-bundle.json
```

Observed result:

```text
8 inspected operations
6 domains
1 security scheme
8 capability candidates
1 workflow hint
8 compiled tools
8 compiled policies
3 compiled approvals
1 compiled recovery
0 validation errors
0 validation warnings
```

## Determinism

The same capability map was compiled twice into independent files.

```text
SHA-256 A: 25121676ff80e0136dd1e0b638220d3ee68180b345101fb60ff1e5d158642685
SHA-256 B: 25121676ff80e0136dd1e0b638220d3ee68180b345101fb60ff1e5d158642685
Byte comparison: identical
```

No timestamp, random value, host-specific path, or network response participates in contract generation.

## Negative-path verification

```text
Malformed CapabilityMap artifact → exit 2
Constitutionally invalid high-risk ContractBundle → exit 1
Swagger 2.0 source → rejected
Missing bundle → exit 2
Duplicate contract identifiers → rejected
```

## JSON integrity

All files under `schemas/*.json`, plus `MANIFEST.json`, `package.json`, and the generated reference ContractBundle were parsed successfully as JSON.

## Contract Kernel verdict

```text
VALID examples/contract-bundle.generated.json
0 errors
0 warnings
```

## Explicit limitations

The release does not yet provide:

- exact OpenAPI request/response schema retention;
- provider HTTP execution;
- MCP transport or tool registration;
- OAuth authorization-server implementation;
- approval-token issuance;
- ChatGPT widgets;
- cryptographic receipt signing.

Generated schemas are marked `conservative_draft` and compiler warnings expose this limitation rather than hiding it.
