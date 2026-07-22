# ADR-0002 — Protocol Baseline and Drift Policy

**Status:** Accepted  
**Date:** 2026-07-22

## Decision

Use the published MCP specification dated 2025-11-25 as the compatibility baseline. Track draft features behind capability flags and adapters.

## Rationale

The stable schema includes tool annotations and task-support metadata. Draft authorization features may evolve and must not silently alter core contracts.

## Consequence

Every protocol adapter declares its supported MCP revision and feature flags. Core contracts remain independent of protocol release dates.
