# ADR-0004 — Bind Approval to Exact Arguments and Revision

**Status:** Accepted  
**Date:** 2026-07-22

## Decision

Approval grants bind to user, client, workspace, tool id, contract revision, normalized arguments hash, expiry, and nonce.

## Rationale

A generic confirmation can be replayed or applied to changed parameters. Exact binding prevents substitution and scope expansion.

## Consequence

Any material argument or revision change requires a new approval.
