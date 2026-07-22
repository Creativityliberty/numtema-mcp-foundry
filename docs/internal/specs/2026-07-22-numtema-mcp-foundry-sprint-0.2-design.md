# Nümtema MCP Foundry — Sprint 0.2 Contract Kernel

**Date:** 2026-07-22  
**Version:** 0.2.0  
**Status:** Implemented and verified

## 1. Goal

Turn the Sprint 0.1 constitutional contracts into an executable, provider-neutral validation kernel without introducing provider calls, MCP transport code, or an authorization server.

## 2. Selected architecture

The implementation separates four concerns:

1. canonical TypeScript contract models;
2. structural JSON Schema evaluation;
3. semantic constitutional rules;
4. a deterministic CLI boundary.

The package uses no runtime dependency. This decision was made after the package registry was unavailable during implementation, but it also reduces supply-chain surface and allows the compiled validator to run with Node.js alone.

## 3. Data flow

```text
YAML or JSON ContractBundle
→ controlled parser
→ bundle index
→ seven JSON Schemas
→ structural report
→ constitutional semantic rules
→ deterministic ValidationReport
→ human or JSON CLI output
```

Semantic validation runs only after structural validation passes, preventing malformed data from entering cross-contract logic.

## 4. Security properties

- No dynamic code execution is performed by the YAML parser.
- YAML anchors, tags, aliases, and merge behavior are unsupported.
- Unknown contract properties are rejected where schemas set `additionalProperties: false`.
- OAuth audience validation and PKCE are mandatory for `oauth2_1` contracts.
- Token passthrough is rejected.
- High-impact tools require explicit approval references.
- Approval contracts bind subject, tool revision, and arguments hash.
- Tenant-required auth binds subject and workspace.
- Recovery escalation is rejected.

## 5. Compatibility and revision model

Every executable ToolContract requires `revision`. Execution receipts refer to the exact tool revision. A mismatch is rejected as `RECEIPT_TOOL_REVISION_MISMATCH`, establishing the base for later `manifest_changed` execution protection.

## 6. Error model

The CLI differentiates:

- valid bundle: exit `0`;
- validation failure: exit `1`;
- loading or configuration failure: exit `2`.

Every validation issue has a stable code, JSON Pointer-like path, message, optional contract identity, and constitutional rule identifier.

## 7. Test coverage

The test suite covers:

- canonical type construction;
- YAML loading;
- duplicate IDs;
- structural validation;
- deterministic issue normalization;
- side-effect contradictions;
- idempotency semantics;
- task mode compatibility;
- risk and policy consistency;
- reference resolution;
- auth scope coverage;
- OAuth protections;
- tenant credential binding;
- approval binding;
- receipt integrity;
- tool revision consistency;
- recovery escalation;
- CLI exit codes and JSON output.

## 8. Deferred work

Sprint 0.3 will introduce the Source Inspection and Capability Mapping contracts. OpenAPI import remains deferred until those normalized artifacts exist, preserving the Contract-Kernel-First decision.

## 9. Self-review

- Placeholder scan: no unresolved placeholders.
- Internal consistency: the runtime, schemas, examples, tests, and CLI use bundle version `0.2`.
- Scope check: no provider execution or MCP transport was introduced.
- Ambiguity check: validation order, exit codes, YAML profile, and rule ownership are explicit.
