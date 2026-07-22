# ADR-0001 — Build the Contract Kernel Before the Runtime

**Status:** Accepted  
**Date:** 2026-07-22

## Decision

Build a vendor-neutral contract kernel before implementing an MCP server generator or execution gateway.

## Rationale

Direct endpoint generation creates irreversible coupling between source quirks and tool behavior. Contracts provide stable boundaries for protocol adapters, policy, testing, and multiple SDK targets.

## Consequence

Sprint 0.1 and Sprint 0.2 produce no production provider execution. Delivery is slower initially but safer and reusable.
