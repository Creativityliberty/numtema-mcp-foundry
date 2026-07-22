# Nümtema MCP Foundry Constitution

## Article I — Mission

The Foundry exists to turn external systems into agent-usable capabilities without sacrificing user intent, security, interoperability, auditability, or operational clarity.

A capability is not valid merely because it can be called. It is valid only when its inputs, outputs, identity, permissions, side effects, failure modes, recovery path, and evidence obligations are defined.

## Article II — Core principles

### 1. Intent precedes invocation

No tool is executed outside a resolved user or system mission. Runtime convenience never expands authorization.

### 2. A schema is not a policy

JSON Schema validates shape. It does not establish permission, safety, ownership, consent, cost acceptance, or business validity.

### 3. Tool descriptions are operational contracts

Descriptions must state when to use the tool, when not to use it, prerequisites, side effects, asynchronous behavior, and recovery guidance. Marketing language and vague descriptions are rejected.

### 4. Secure defaults are pessimistic

Missing annotations or policies are interpreted conservatively: not read-only, potentially destructive, non-idempotent, and open-world until proven otherwise.

### 5. Hints never replace enforcement

MCP annotations help clients present and route tools. Server-side policy remains authoritative.

### 6. Least privilege is mandatory

Every action requests the smallest scope set required. Additional scopes are acquired through explicit step-up authorization.

### 7. Token passthrough is prohibited

The Foundry runtime never forwards a token intended for itself to another provider. Downstream credentials are separately resolved and audience-bound.

### 8. Tenancy is explicit

Every protected operation resolves a user, client, workspace, provider account, and scope context. A missing tenant context blocks execution.

### 9. Side effects are declared

Tools explicitly declare read/write behavior, destructiveness, external communication, financial effects, personal-data access, reversibility, and idempotency.

### 10. Approval is bound to the exact action

Approval tokens bind user, tool version, normalized arguments hash, workspace, expiry, nonce, and approved risk/cost. A changed argument invalidates approval.

### 11. Financial and irreversible actions require human consent

Models cannot self-authorize purchases, irreversible deletion, credential rotation, public publishing, or equivalent high-impact actions.

### 12. Retries require idempotency evidence

A runtime retries side-effecting work only when the tool contract and provider adapter establish safe idempotency.

### 13. Long work becomes a task

Pending operations return task identity and state. Clients observe rather than blindly resubmit.

### 14. Binary content travels by reference

Large files and media are uploaded through an artifact gateway. Tool arguments carry stable artifact references, not raw binary payloads.

### 15. Recovery is typed and constrained

Recovery directives are explicit transitions. They cannot silently increase scope, cost, risk, or side effects.

### 16. Version drift blocks stale execution

Invocation may require a manifest or contract revision. A changed contract causes re-description and re-evaluation before execution.

### 17. Every meaningful side effect produces evidence

The runtime emits a trace and, for governed actions, an immutable execution receipt containing hashes, identity context, timing, policy outcome, and result state.

### 18. Provider fallback is never silent for writes

Read-only calls may use an approved fallback when semantics remain equivalent. Writes require explicit contract support; financial or destructive writes never silently switch providers.

### 19. Data is minimized

Only fields required for the declared capability are collected, logged, retained, and exposed to models or widgets.

### 20. The core remains vendor-neutral

Provider, client, and framework-specific fields live in namespaced adapter extensions. Core semantics must survive a change of runtime or client.

## Article III — Normative execution chain

```text
Discover → Describe → Preflight → Authorize → Confirm → Invoke → Observe → Recover → Receipt
```

A stage may be skipped only by a contract-backed rule. For example, `Confirm` may be skipped for a trusted read-only operation under an active low-risk policy.

## Article IV — Constitutional gates

A capability cannot advance unless it passes:

1. Source Integrity Gate
2. Contract Completeness Gate
3. Schema Validation Gate
4. Auth Compatibility Gate
5. Policy and Risk Gate
6. Simulation Gate
7. Security Audit Gate
8. Packaging Gate
9. Deployment Readiness Gate

## Article V — Amendment rule

A constitutional change requires:

- an Architecture Decision Record;
- compatibility impact analysis;
- schema version decision;
- migration guidance;
- validation fixtures;
- explicit approval by the Foundry maintainer.
