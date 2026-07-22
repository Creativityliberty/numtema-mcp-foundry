# Nümtema MCP Foundry — Sprint 0.1 Design

**Date:** 2026-07-22  
**Scope:** Constitution, contracts, architecture, lifecycle, security baseline  
**Implementation status:** Not started by design

## 1. Problem

Most MCP generators stop at translating endpoint parameters into tool schemas. That produces technically callable tools but not reliable agent capabilities. The missing layers are operational descriptions, risk classification, authorization scopes, consent rules, idempotency, asynchronous execution, recovery, tenancy, evidence, and version governance.

Nümtema MCP Foundry must generate governed capabilities rather than thin endpoint wrappers.

## 2. Product definition

Nümtema MCP Foundry is a system that converts a source—API description, repository, workflow, database, SDK, CLI, or natural-language service definition—into a validated package containing:

1. capability contracts;
2. an MCP adapter;
3. authentication and authorization configuration;
4. policy and consent rules;
5. execution and recovery semantics;
6. test and audit evidence;
7. deployable and publishable packages.

## 3. Canonical operating loop

```text
Discover
→ Describe
→ Preflight
→ Authorize
→ Confirm
→ Invoke
→ Observe
→ Recover
→ Receipt
```

The sequence is normative. A build may omit stages only when the corresponding contract proves the stage unnecessary, such as confirmation for a read-only tool.

## 4. Architecture approach

Three approaches were considered:

### A. Direct OpenAPI-to-MCP generator

Fastest initial delivery, but it embeds provider quirks in generated tools and offers weak governance.

### B. Vendor-neutral contract kernel with adapters — selected

Sources compile into Foundry contracts. MCP, ChatGPT Apps, Laravel, TypeScript, Python, and provider integrations consume those contracts through adapters. This costs more initially but provides stable boundaries, testability, and long-term reuse.

### C. Dynamic universal gateway only

A single runtime discovers and invokes remote apps dynamically. Powerful for a marketplace, but too broad and risky as the first foundation.

**Decision:** Build B first, then add C as a marketplace/runtime layer. Use A only as one source adapter.

## 5. System boundaries

### Foundry Core

Owns canonical contracts, validation, artifact transitions, versioning, and compilation rules. It has no provider credentials and performs no external side effects.

### Source Adapters

Read OpenAPI, GraphQL, Postman, repositories, databases, CLIs, SDKs, or workflow specifications and produce a normalized source inspection.

### Protocol Adapters

Map Foundry contracts to MCP servers and client-specific metadata. They cannot weaken core policy requirements.

### Execution Runtime

Performs calls, queues jobs, applies idempotency, emits traces, and produces receipts. It is not part of Sprint 0.1.

### Governance Plane

Evaluates scopes, risk, consent, tenancy, cost, and approval. Policy evaluation is server-side and cannot rely solely on MCP annotations.

### Studio

Allows humans to inspect and change generated contracts. The UI is not part of Sprint 0.1.

## 6. Fundamental contracts

The first contract kernel contains:

1. `ToolContract`
2. `AuthContract`
3. `PolicyContract`
4. `ApprovalContract`
5. `RecoveryContract`
6. `ReceiptContract`
7. `FoundryArtifact`

Each contract is versioned independently and carries a stable identifier.

## 7. Security design

- HTTP MCP authorization follows OAuth 2.1 resource-server semantics.
- Tokens are audience-bound to the canonical MCP resource.
- Token passthrough to downstream providers is prohibited.
- Provider credentials are resolved by user, client, workspace, provider, and scope set.
- Authorization is least-privilege and supports step-up scopes.
- Destructive, financial, or externally communicative actions require explicit policy decisions.
- Approval tokens are short-lived, single-use, and bound to an exact arguments hash.
- Tool annotations are treated as hints, never enforcement.
- All external input and provider output are untrusted until validated.

## 8. Error and recovery design

Errors are typed into four classes:

- `invalid_request`
- `blocked_action`
- `transient_failure`
- `terminal_failure`

Recoverable errors may return a typed `RecoveryDirective`. The runtime may follow it automatically only when policy permits and no new side effect, scope, cost, or risk class is introduced.

## 9. Asynchronous execution

Long-running operations are modeled as tasks/jobs with explicit lifecycle states. A client must not resubmit the original operation merely because a result is pending. Idempotency keys and manifest revisions protect against duplicated or stale execution.

## 10. Testing strategy

Sprint 0.2 must test:

- JSON Schema validity;
- contract compatibility;
- risk-policy consistency;
- approval binding;
- scope minimization;
- manifest revision rejection;
- idempotency semantics;
- receipt integrity;
- tenant isolation fixtures.

Production provider calls remain out of scope until the Contract Kernel passes these tests.

## 11. Success criteria for Sprint 0.1

- No unresolved placeholders or undefined core terms.
- Every fundamental contract has a valid JSON Schema.
- Architecture boundaries prohibit provider leakage into core contracts.
- Security requirements distinguish hints from enforcement.
- The lifecycle defines mandatory artifacts and gates.
- A future implementation team can build Sprint 0.2 without inventing missing constitutional decisions.

## 12. Non-goals

- Building a running MCP server
- Creating an OAuth authorization server
- Publishing an app to ChatGPT
- Implementing a public marketplace
- Generating production code from OpenAPI
- Implementing widgets

## 13. Review result

Self-review completed:

- Placeholder scan: passed
- Internal consistency: passed
- Scope check: focused on the constitutional layer
- Ambiguity check: stable protocol baseline and adapter boundaries are explicit
