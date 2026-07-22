# ADR-0003 — Tool Annotations Are Hints, Not Policy

**Status:** Accepted  
**Date:** 2026-07-22

## Decision

MCP annotations are projected from ToolContract but never used as the sole authorization or safety control.

## Rationale

Annotations are advisory and may be incomplete or untrusted. Enforcement requires server-side policy and authenticated context.

## Consequence

The Policy Engine must evaluate every protected or side-effecting invocation independently of client behavior.
