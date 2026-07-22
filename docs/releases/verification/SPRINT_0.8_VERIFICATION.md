# Sprint 0.8 Verification Report

## Scope

Secure Provider Runtime Preflight, signed governance proofs, public trust store, exact cross-artifact binding, budget enforcement, redaction, CLI, schemas, examples, JSON bundle, and cumulative packaging.

## Verification commands

```bash
npm run typecheck
npm test
npm run preflight:example
node dist/src/cli/foundry.js preflight ... --json
npm run bundle:json
```

## Verified behaviors

- canonical SHA-256 payload integrity;
- Ed25519 verification with purpose-separated public keys;
- altered payload rejection;
- unknown, inactive, expired, and wrong-purpose key rejection;
- exact tool, adapter, revision, arguments, context, subject, client, and workspace binding;
- policy denial rejection;
- missing or expired approval rejection;
- single-use approval nonce binding;
- risk and cost summary binding;
- missing, mismatched, or insufficient budget rejection;
- unready credential rejection;
- secret-like field and value rejection;
- deterministic authorization ID, execution nonce, and envelope digest;
- no network execution;
- no private key or credential secret in distributed artifacts.

## Test result

```text
81 tests
28 suites
0 failures
```

## Current boundary

A ready envelope authorizes a future dispatcher but does not execute a provider call. Approval nonce consumption and budget reservation are not yet durable and remain explicit next-sprint concerns.
