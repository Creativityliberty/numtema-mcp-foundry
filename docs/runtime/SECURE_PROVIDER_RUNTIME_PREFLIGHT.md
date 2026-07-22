# Secure Provider Runtime Preflight

## Purpose

Sprint 0.8 creates the final authorization gate before a provider dispatcher may perform network I/O. The gate is pure and deterministic: it reads existing artifacts, verifies them, and emits an `AuthorizedExecutionEnvelope`. It never contacts the provider and never resolves secret material.

```text
ProviderExecutionPlan
+ CredentialResolutionPlan
+ signed RuntimePolicyDecision
+ signed ApprovalProof when required
+ signed BudgetAuthorization when required
+ RuntimeTrustStore
→ AuthorizedExecutionEnvelope
```

## Fail-closed checks

The envelope is dispatchable only when every required check passes:

- execution and credential plans have valid canonical SHA-256 digests;
- both plans target the same tool and adapter revisions;
- the credential plan is ready, audience-valid, scope-complete, and tenant-bound;
- policy decision is `allow`, active, unexpired, correctly signed, and bound to the exact arguments and context;
- required approval is present, approved, single-use, nonce-bound, unexpired, correctly signed, and bound to tool, revision, arguments, context, risk, and cost;
- required budget is approved, unexpired, correctly signed, bound to the exact execution, and sufficient for both the maximum authorization and remaining amount;
- no secret-like field or value is present in the execution or credential plans.

Any failure produces an envelope with:

```json
{
  "dispatch_permitted": false,
  "network_executed": false,
  "redaction": {
    "secret_material_included": false,
    "credential_handle_only": true
  }
}
```

## Cryptographic model

Policy, approval, and budget artifacts use:

- canonical JSON with recursively sorted object keys;
- SHA-256 payload integrity excluding top-level `integrity` and `signature`;
- Ed25519 signatures over the hexadecimal digest;
- public keys selected from a `RuntimeTrustStore` by `key_id` and purpose;
- purpose separation between `policy`, `approval`, and `budget` keys;
- active, not-before, and expiry checks for trusted keys.

Private keys are not included in the repository, examples, bundle, logs, or final envelope.

## CLI

```bash
node dist/src/cli/foundry.js preflight \
  --execution-plan examples/runtime/provider-execution-plan.json \
  --credential-plan examples/runtime/credential-resolution-plan.json \
  --policy examples/runtime/runtime-policy-decision.json \
  --approval examples/runtime/approval-proof.json \
  --budget examples/runtime/budget-authorization.json \
  --trust-store examples/runtime/runtime-trust-store.json \
  --at 2026-07-22T16:01:00Z \
  --out examples/runtime/authorized-execution-envelope.generated.json
```

Exit codes:

```text
0  dispatch permitted
1  preflight completed but blocked
2  usage, loading, parsing, or configuration error
```

## Single-use boundary

The approval proof declares `single_use: true` and carries a nonce. Sprint 0.8 binds that nonce into the envelope but does not persist consumption. Durable nonce reservation and replay prevention belong to the subsequent dispatch ledger/runtime sprint. Until then, the envelope remains a verified authorization artifact, not proof that dispatch occurred.

## Explicit exclusions

- provider network execution;
- secret retrieval from a vault;
- live token or API-key injection;
- durable approval nonce consumption;
- budget debit or reservation;
- execution receipts and result normalization after a live request;
- MCP transport exposure.
