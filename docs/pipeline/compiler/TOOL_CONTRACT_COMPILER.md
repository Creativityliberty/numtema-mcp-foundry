# Tool Contract Compiler

## Purpose

The Tool Contract Compiler converts a reviewed `CapabilityMapArtifact` into a deterministic `ContractBundle`. It is the boundary between heuristic source analysis and executable protocol generation.

```text
CapabilityMapArtifact 0.3
→ ToolContract drafts
→ AuthContract draft
→ PolicyContract drafts
→ ApprovalContract drafts
→ RecoveryContract drafts
→ Contract Kernel validation
```

The compiler does not call providers, issue tokens, deploy an MCP server, or claim that generated request and response schemas are production-complete.

## Command

```bash
node dist/src/cli/foundry.js compile examples/capability-map.generated.json
node dist/src/cli/foundry.js compile examples/capability-map.generated.json --json
node dist/src/cli/foundry.js compile examples/capability-map.generated.json --out examples/contract-bundle.generated.json
node dist/src/cli/foundry.js compile examples/capability-map.generated.json --schemas schemas
```

The command always validates the generated bundle before returning success.

## Exit codes

```text
0  compilation completed and ContractBundle validation passed
1  compilation completed but ContractBundle validation failed
2  usage, artifact loading, parsing, or schema configuration failed
```

## Generated contracts

### ToolContract

One ToolContract is created for each capability candidate. The compiler preserves:

- stable tool name and title;
- source method, path, operation ID, and domain;
- risk class and governance rationale;
- read-only, destructive, idempotent, and open-world annotations;
- execution mode, task support, and idempotency requirements;
- required scopes;
- evidence from source inspection.

Each tool receives a deterministic SHA-256 revision based only on normalized contract-relevant input. No current timestamp participates in the revision.

### AuthContract

When at least one capability requires scopes, the compiler creates one draft `host_managed` AuthContract:

```text
id: auth:default
transport: http
mode: host_managed
tenant_resolution: required
token_passthrough: false
```

Scopes are the sorted union of capability scopes. Credentials bind to subject, client, workspace, provider, provider account, and scope set. The final OAuth, API-key, or provider-specific flow remains an Auth Foundry review decision.

When no capability requires scopes, no AuthContract or tool `auth_ref` is generated.

### PolicyContract

Every tool receives an exact policy, rather than sharing a broad policy with unrelated scopes. The policy keeps the reviewed risk class and decision from the capability map.

High-risk policies never compile to `allow`:

```text
R3 → require_confirmation
R4 → require_widget
R5 → require_approver
```

### ApprovalContract

Approval is generated only when the capability map requires it.

```text
R3 → chat_explicit
R4 → secure_widget
R5 → dual_control
```

Every approval binds:

```text
subject
client
workspace
tool_id
tool_revision
arguments_hash
risk_summary
nonce
```

R4 and R5 approvals additionally bind `cost_summary`.

### RecoveryContract

Workflow hints become bounded recovery routes:

```text
async_create_status:
  job_queued → status tool

upload_confirm:
  upload_completed → confirmation tool
```

Recovery routes cannot increase risk, scopes, or cost.

## Conservative schema drafts

CapabilityMapArtifact 0.3 does not retain complete OpenAPI request and response schemas. The compiler therefore generates conservative drafts:

- path parameters are explicit string properties;
- unknown query, header, and body properties remain permitted;
- asynchronous outputs expose `job_id` and `status`;
- synchronous outputs allow provider-specific properties.

Every tool records `extensions.foundry.schema_fidelity = conservative_draft`. The future Schema Enrichment sprint will replace these drafts with source-derived JSON Schemas.

## Determinism

For identical input and options, the compiler returns deeply equal output. Determinism is required for:

- stable manifest revisions;
- reproducible reviews;
- meaningful diffs;
- signed approval binding;
- receipt verification;
- CI and supply-chain evidence.

## Current boundary

Sprint 0.4 stops at a validated ContractBundle. The following remain excluded:

- provider HTTP execution;
- MCP transport and tool registration;
- OAuth authorization-server implementation;
- approval-token issuance;
- widget rendering;
- cryptographic receipt signing;
- full OpenAPI request/response schema preservation.
