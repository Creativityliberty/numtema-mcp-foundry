# Reference Architecture

## 1. Layer model

```text
Client Plane
  ChatGPT / MCP clients / Internal agents
        │
Access Plane
  Transport / session / authentication / client identity
        │
Governance Plane
  scopes / risk / consent / cost / tenancy / policy
        │
Capability Plane
  search / describe / version / contracts / registry
        │
Execution Plane
  invoke / jobs / idempotency / adapters / retries
        │
Evidence Plane
  traces / receipts / audit / metrics
```

## 2. Core components

### Source Inspector

Normalizes source material into `SourceInspectionArtifact`. It detects operations, schemas, security schemes, pagination, callbacks, rate limits, and asynchronous patterns.

### Capability Mapper

Groups technical operations into business capabilities. It may fuse several endpoints into one safe workflow tool or split an overloaded endpoint into several explicit actions.

### Contract Compiler

Produces the seven fundamental contracts and protocol-specific projections. It does not execute provider operations.

### Capability Registry

Stores immutable contract revisions and supports search, describe, deprecation, compatibility, and version resolution.

### Auth Gateway

Validates resource-server tokens, resolves subject and tenant context, and obtains provider credentials without token passthrough.

### Policy Engine

Evaluates declared risk, actual runtime context, scopes, cost, data classes, external recipients, and prior approvals.

### Consent Gateway

Creates human-readable approval requests and verifies short-lived, argument-bound approval grants.

### Artifact Gateway

Prepares uploads, confirms content, validates type and ownership, and returns stable artifact references.

### Durable Execution Runtime

Dispatches provider calls, assigns idempotency keys, manages tasks, applies safe retry rules, and normalizes results.

### Recovery Router

Turns typed recoverable failures into permitted next actions.

### Evidence Ledger

Stores append-only traces and signed receipts without leaking credentials or unnecessary payload data.

## 3. Adapter boundaries

### Source adapters

- OpenAPI
- GraphQL
- Postman
- Repository/code
- Database
- CLI/SDK
- Workflow DSL

### Protocol adapters

- MCP Streamable HTTP
- MCP stdio
- ChatGPT Apps metadata and widgets
- Future client-specific projections

### Provider adapters

- REST
- GraphQL
- SQL
- SDK
- Queue/workflow engine
- Laravel service container

Adapters may add namespaced extensions but cannot redefine core risk, approval, identity, or receipt semantics.

## 4. Dynamic marketplace pattern

The future marketplace surface follows:

```text
capabilities_search
→ capabilities_describe
→ capabilities_invoke
```

Invocation requires the described contract revision. A revision mismatch produces `contract_changed` and forces re-description.

## 5. Trust boundaries

1. Client to Access Plane: untrusted request and token validation.
2. Access to Governance Plane: authenticated identity is not automatic permission.
3. Governance to Execution Plane: only signed policy decisions cross.
4. Execution to Providers: provider credentials stay server-side.
5. Providers to Runtime: all output is untrusted and schema-validated.
6. Widgets to Runtime: widget data is validated exactly like model-generated arguments.
7. Evidence Plane: secrets and raw sensitive payloads are excluded by default.

## Sprint 0.3 inspection boundary

```text
OpenAPI source
  → OpenAPI Loader
  → SourceInspectionArtifact
  → Capability Mapper
  → CapabilityMapArtifact
  → human review / future ToolContract Compiler
```

Neither the inspector nor the mapper may execute provider operations, mint credentials, or create approvals. Their outputs are evidence-bearing proposals consumed by later governed stages.
