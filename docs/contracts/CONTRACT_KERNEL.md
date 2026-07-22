# Contract Kernel — Sprint 0.2

## Purpose

The Contract Kernel is the first executable component of Nümtema MCP Foundry. It validates governed capability contracts before any MCP adapter, provider adapter, authentication server, or execution runtime is allowed to consume them.

The kernel is intentionally provider-neutral and has no production network calls.

## Runtime profile

- Node.js 22 or newer
- zero runtime dependencies
- TypeScript source with compiled JavaScript distribution
- built-in Node test runner
- controlled YAML and JSON input
- deterministic human-readable and JSON reports

TypeScript is a development dependency only. The compiled `dist/` directory can run directly with Node.js.

## Contract bundle

A bundle uses version `0.2` and contains all seven canonical collections:

```yaml
bundle_version: "0.2"
tools: []
auth: []
policies: []
approvals: []
recoveries: []
receipts: []
artifacts: []
```

See `examples/contract-bundle.yaml` for a complete valid example.

## CLI

Build and validate:

```bash
npm run build
node dist/src/cli/foundry.js validate examples/contract-bundle.yaml
```

JSON output:

```bash
node dist/src/cli/foundry.js validate examples/contract-bundle.yaml --json
```

Alternative schema directory:

```bash
node dist/src/cli/foundry.js validate bundle.yaml --schemas ./schemas
```

### Exit codes

| Code | Meaning |
|---:|---|
| `0` | Bundle loaded and passed all structural and semantic validation |
| `1` | Bundle loaded but contains validation issues |
| `2` | Usage, file loading, YAML/JSON parsing, or schema configuration error |

## Validation layers

### Structural validation

Every contract is validated against its JSON Schema. The zero-dependency evaluator supports the schema keywords currently used by the Foundry contract schemas:

- `type`
- `required`
- `properties`
- `additionalProperties`
- `enum`
- `const`
- `pattern`
- `minLength` and `maxLength`
- `minimum` and `maximum`
- `items`
- `uniqueItems`
- `contains`
- `allOf`
- `if` and `then`
- `format: uri`
- `format: date-time`

Unsupported keywords must not be added silently. A future schema evolution must first extend the evaluator and its tests.

### Semantic validation

The kernel currently enforces these constitutional rules:

1. Read-only tools cannot declare writes, destruction, financial effects, credential changes, or external communication.
2. Write tools must support or require idempotency.
3. Tools requiring task support cannot be synchronous-only.
4. Tool revisions are mandatory.
5. R3–R5 policies cannot allow by default or through an unconditional allow rule.
6. Financial tools require an R4 or R5 policy and an approval contract.
7. Destructive, externally communicative, financial, and credential-changing tools require approval.
8. Tool references to auth, policy, approval, and recovery contracts must resolve.
9. Scoped tools must reference auth contracts whose declared scopes cover the tool scopes.
10. OAuth 2.1 contracts require audience validation and PKCE.
11. Token passthrough remains forbidden.
12. Tenant-required credentials must bind at least subject and workspace.
13. Approval contracts must bind subject, tool revision, and arguments hash.
14. Recovery routes cannot increase risk, scopes, or cost.
15. Receipt hashes must be lowercase SHA-256 digests.
16. Receipt completion cannot precede start.
17. Receipt tool revisions must match the referenced tool contract.
18. Contract identifiers and tool names must be unique inside a bundle.

## YAML profile

The controlled YAML parser accepts the subset required by Foundry bundles:

- indentation-based mappings and sequences;
- quoted and plain strings;
- booleans, null, and numbers;
- JSON-compatible inline arrays and objects;
- comments beginning with `#` outside quoted values.

Anchors, aliases, tags, block scalars, merge keys, and executable extensions are deliberately unsupported. This reduces parser ambiguity and attack surface.

## Determinism

Validation issues contain:

```json
{
  "code": "TOOL_WRITE_IDEMPOTENCY_REQUIRED",
  "severity": "error",
  "path": "/tools/0/execution/idempotency",
  "message": "Write tools must support or require idempotency.",
  "contract_kind": "tool",
  "contract_id": "tool://procuflow/purchase-order-approve@1",
  "rule": "CONST-IDEMPOTENCY-001"
}
```

Issues are sorted deterministically so CI reports and evidence artifacts remain stable.

## Explicit non-goals

Sprint 0.2 does not:

- execute provider operations;
- start an MCP transport;
- implement OAuth endpoints;
- issue approval tokens;
- sign receipts cryptographically;
- generate tools from OpenAPI;
- publish a ChatGPT app;
- provide a Studio UI.
