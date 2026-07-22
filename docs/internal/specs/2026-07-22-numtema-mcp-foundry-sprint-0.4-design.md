# Nümtema MCP Foundry Sprint 0.4 — Tool Contract Compiler Design

## Goal

Compile a reviewed `CapabilityMapArtifact` into a deterministic and constitutionally valid `ContractBundle` containing Tool, Auth, Policy, Approval, and Recovery contracts.

## Scope

The sprint does not generate an MCP server or provider adapter. It compiles governance-ready drafts that the Contract Kernel can validate and later protocol adapters can consume.

## Inputs

- `CapabilityMapArtifact` version `0.3`, loaded from JSON or controlled YAML.
- Compiler options with project/version defaults.

## Outputs

- `ContractBundle` version `0.2`.
- One `ToolContract` per capability candidate.
- One exact `PolicyContract` per tool.
- One `ApprovalContract` for each tool requiring approval.
- One shared `AuthContract` when at least one scope exists.
- Recovery contracts derived from high-confidence workflow hints.
- Compilation summary and warnings.

## Determinism

The same normalized capability map and options must produce byte-equivalent contracts. Tool revisions are derived from a stable SHA-256 digest of contract-relevant source fields. Generated bundles contain no current timestamps.

## Tool contract rules

- Preserve candidate name, title, risk, annotations, execution mode, and scopes.
- Derive effects only from explicit mapper evidence and annotations.
- Generate conservative JSON Schema drafts because the capability map does not yet retain full OpenAPI request/response schemas.
- Store source operation, route, method, domain, risk, evidence, and draft fidelity under `extensions.foundry`.
- Attach policy, auth, approval, and recovery references only when the corresponding contracts exist.

## Governance rules

- Policy decision exactly matches the reviewed capability governance decision.
- R3 uses explicit chat confirmation, R4 uses a secure widget, R5 uses dual control.
- Approval bindings include `subject`, `client`, `workspace`, `tool_id`, `tool_revision`, `arguments_hash`, `risk_summary`, and `nonce`; financial tools also bind `cost_summary`.
- Scoped tools reference a host-managed authentication contract with token passthrough forbidden and tenant-aware credential binding.

## Recovery rules

- `async_create_status` creates a route from the create tool to the status tool.
- `upload_confirm` creates a route from the upload tool to the confirmation tool.
- Recovery routes cannot increase risk, scopes, or cost.

## CLI

`foundry compile <capability-map.json|yaml> [--out bundle.json] [--json] [--schemas dir]`

The command compiles and immediately validates the bundle. Exit codes:

- `0`: compiled bundle is valid.
- `1`: compiler produced an invalid bundle.
- `2`: source loading, parsing, or usage error.

## Testing

Tests cover deterministic compilation, constitutional validity, exact risk/approval mapping, recovery generation, source rejection, and CLI behavior.
