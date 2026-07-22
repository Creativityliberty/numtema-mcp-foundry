# Nümtema MCP Foundry Sprint 0.8 Design

## Goal

Build a fail-closed Secure Provider Runtime Preflight that combines a provider execution plan, credential resolution plan, signed policy decision, signed approval proof when required, and signed budget authorization when required into one AuthorizedExecutionEnvelope. The preflight never performs network I/O and never includes credential secret material.

## Boundaries

- This sprint authorizes a dispatch envelope; it does not send provider requests.
- Every mutable runtime input is bound by hashes, tool revision, adapter revision, tenant context, and expiration.
- Policy, approval, and budget artifacts are verified with Ed25519 public keys from a runtime trust store.
- Approval is single-use by contract and carries a nonce, but durable nonce consumption belongs to a later runtime ledger sprint.
- The final envelope embeds the already-redacted provider and credential plans so a later dispatcher does not need to reconstruct or reinterpret them.

## Components

1. Runtime artifact types for policy, approval, budget, trust store, checks, and authorized envelope.
2. Runtime artifact loaders with structural guards.
3. Canonical hashing and Ed25519 signature verification.
4. Fail-closed preflight engine with consistency, time, signature, approval, budget, and secret-leak checks.
5. JSON Schemas for every new artifact.
6. `foundry preflight` CLI command.
7. Signed static examples and negative fixtures.
8. Documentation, verification report, manifest, JSON bundle, and cumulative ZIP.

## Security invariants

- `network_executed` is always false.
- `secret_material_included` is always false.
- A policy denial can never produce a ready envelope.
- Missing or invalid required approval blocks the envelope.
- Missing or insufficient required budget blocks the envelope.
- Every signed artifact must use a trusted key with the correct declared purpose.
- Tool, adapter, arguments, context, risk, and cost bindings must match exactly.
- Expired artifacts are rejected.
- An invalid digest or signature is rejected before authorization.
