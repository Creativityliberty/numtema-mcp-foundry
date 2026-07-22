# ADR-0007 — Deterministic Draft Compilation

## Status

Accepted — 2026-07-22

## Context

Capability maps contain reviewed names, risks, governance decisions, scopes, execution hints, and source evidence, but version 0.3 does not preserve complete OpenAPI request and response schemas. The Foundry still needs stable contracts before implementing MCP transport.

## Decision

The Tool Contract Compiler produces conservative draft schemas and deterministic contract revisions.

- No current timestamp, random value, host path, or network result may affect compilation.
- Tool revisions are lowercase SHA-256 digests of normalized contract-relevant source fields.
- Missing schema fidelity is represented explicitly in extensions and compiler warnings.
- High-risk governance is preserved exactly and cannot be silently downgraded.
- Generated contracts are immediately passed through the Contract Kernel.

## Consequences

Positive:

- Repeatable output and meaningful diffs.
- Approval and receipt systems can bind to stable revisions.
- MCP adapters can consume a trusted intermediate representation.
- Missing source fidelity is visible rather than hallucinated.

Negative:

- Generated schemas are intentionally broad until schema enrichment exists.
- Provider-specific authentication still requires review.
- The compiler emits warnings even when the bundle is valid.
