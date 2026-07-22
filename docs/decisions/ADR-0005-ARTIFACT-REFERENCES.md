# ADR-0005 — Use Artifact References for Binary Content

**Status:** Accepted  
**Date:** 2026-07-22

## Decision

Tool contracts accept artifact identifiers for large media and files rather than raw bytes or arbitrary external URLs.

## Rationale

Artifact references support ownership checks, type validation, reuse, size controls, malware scanning, and auditability.

## Consequence

The future runtime requires prepare/upload/confirm/inspect/revoke operations.
