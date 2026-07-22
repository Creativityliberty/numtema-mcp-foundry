# Fundamental Contract Catalog

## 1. ToolContract

Defines an agent-facing capability.

Mandatory concerns:

- stable identity and version;
- operational description;
- input and output schemas;
- MCP-compatible annotations;
- side-effect profile;
- required scopes;
- preconditions;
- execution mode;
- idempotency semantics;
- linked auth, policy, approval, and recovery contracts;
- executable manifest revision.

## 2. AuthContract

Defines identity and authorization requirements.

It specifies:

- transport applicability;
- authorization mode;
- canonical resource URI;
- authorization server metadata;
- audience rules;
- required and optional scopes;
- step-up behavior;
- tenant resolution;
- provider credential binding;
- token storage and refresh policy.

## 3. PolicyContract

Defines server-side decisions for a capability and runtime context.

Normative decisions:

```text
allow
deny
require_scope
require_confirmation
require_widget
require_approver
```

A policy may consider risk class, data classification, recipients, cost, environment, tenant, actor role, time, and provider state.

## 4. ApprovalContract

Defines how consent is requested and verified.

An approval grant is bound to:

- subject;
- client;
- workspace;
- tool identifier and revision;
- normalized arguments hash;
- risk and cost summary;
- expiry;
- nonce;
- single-use state.

## 5. RecoveryContract

Defines typed recovery routes for blocked or failed actions.

A recovery route declares:

- trigger code;
- next capability;
- argument mapping;
- whether human interaction is required;
- maximum attempts;
- risk/scope/cost delta constraints.

## 6. ReceiptContract

Defines evidence emitted after governed execution.

It includes:

- trace, mission, job, and receipt identity;
- actor and tenant context;
- contract revision;
- normalized arguments hash;
- policy and approval references;
- provider and timing data;
- status and result hash;
- cost summary;
- signature metadata.

## 7. FoundryArtifact

Provides a common envelope for all build-time artifacts.

Required envelope fields:

- artifact id;
- artifact type;
- schema version;
- project id;
- revision;
- creation time;
- producer;
- inputs;
- integrity hash;
- lifecycle state.

## 8. Contract Kernel validation

Sprint 0.2 validates all seven contracts structurally and then applies cross-contract constitutional rules. `ToolContract.auth_ref` identifies the AuthContract whose declared required and optional scopes must cover every scope requested by the tool. Structural success is required before semantic validation begins.

## 9. Protocol projection rules

### MCP Tool mapping

- `ToolContract.name` → MCP tool name
- `description` → MCP description
- `input_schema` → MCP `inputSchema`
- `output_schema` → MCP `outputSchema`
- standard hints → MCP `annotations`
- async mode → MCP task support where available
- client-specific metadata → namespaced `_meta`

### Enforcement rule

Fields projected into MCP annotations remain advisory. Policy, approval, authorization, and tenancy are enforced by the server runtime.
