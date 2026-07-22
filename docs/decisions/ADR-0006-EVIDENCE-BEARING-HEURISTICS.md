# ADR-0006 — Evidence-bearing heuristics

## Decision

All Source Inspector and Capability Mapper heuristics must emit human-readable evidence. Heuristics may raise risk but may not silently lower a risk established by method, security, response, or explicit metadata.

## Rationale

Capability generation is unsafe when the classifier's reasoning is invisible. Evidence enables human review, deterministic tests, later audit, and correction without coupling the Foundry to a particular model provider.

## Consequence

Every candidate remains provisional until reviewed or compiled through an explicit policy gate.
