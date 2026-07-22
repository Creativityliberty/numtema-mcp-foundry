# Durable Dispatch Authorization Ledger

## Purpose

Sprint 0.9 converts an authorized dry-run envelope into a durable reservation before any provider network request can be attempted. It closes the gap between “policy says this may run” and “the runtime is permitted to dispatch this exact operation once.”

```text
AuthorizedExecutionEnvelope
→ atomic ledger lock
→ journal verification
→ nonce reservation
→ idempotency reservation
→ budget reservation
→ signed reservation receipt
→ reserved
→ signed dispatch receipt
→ dispatched
```

No provider request is sent by this sprint.

## Storage model

A ledger is a directory:

```text
ledger/
├── ledger.meta.json
└── events.jsonl
```

`events.jsonl` is the sole source of truth. Each event contains:

- a contiguous sequence number;
- the digest of the previous event;
- its own canonical SHA-256 integrity digest;
- the authorization, execution nonce and optional approval nonce;
- the idempotency key;
- the tenant/tool/adapter binding;
- the reserved budget;
- the resulting state.

Every read and mutation verifies the complete chain. A broken sequence, digest, ledger identifier or transition fails closed with `LEDGER_CORRUPT`.

## Atomicity

Mutations use an atomic directory lock named `.dispatch-lock`. While the lock is held, the runtime:

1. reads and verifies the full journal;
2. reconstructs current reservations and budget totals;
3. evaluates replay, idempotency and budget constraints;
4. appends one canonical event;
5. calls `fsync` on the journal;
6. releases the lock.

This prevents two local Foundry processes from reserving the same nonce or overspending the same signed budget snapshot concurrently.

## Replay rules

- An execution nonce is permanently consumed after its first reservation.
- An approval nonce is permanently consumed when present.
- The same idempotency key plus the same envelope digest returns the existing active reservation without appending another event.
- The same idempotency key with a different envelope is rejected as `IDEMPOTENCY_CONFLICT`.
- A released or dispatched authorization cannot be reserved again.
- Releasing a reservation frees its budget amount but never makes its nonces reusable.

## State transitions

```text
authorized → reserved → dispatched
                    ↘ released
```

`released` accepts the explicit reasons:

- `cancelled`;
- `expired`.

An `expired` release is accepted only after the authorization expiry. A dispatched reservation cannot be released.

## Signed receipts

Each transition returns a `signed_dispatch_receipt`:

- `authorized_to_reserved`;
- `reserved_to_dispatched`;
- `reserved_to_released`.

The receipt is canonicalized, hashed with SHA-256 and signed with Ed25519. Its public key must appear in a `RuntimeTrustStore` entry whose purpose is `dispatch`. The private key is read only at mutation time and is never stored in the journal, receipt, snapshot, JSON bundle or examples.

## CLI

Initialize a ledger:

```bash
foundry ledger init ./dispatch-ledger \
  --ledger-id production-ledger-1 \
  --at 2026-07-22T16:01:00Z
```

Reserve an authorization:

```bash
foundry dispatch reserve \
  --ledger ./dispatch-ledger \
  --envelope ./authorized-execution-envelope.json \
  --signing-key ./dispatcher-private.pem \
  --key-id dispatcher-key-1 \
  --at 2026-07-22T16:02:00Z \
  --out ./reservation-receipt.json
```

Commit the dispatch transition:

```bash
foundry dispatch commit \
  --ledger ./dispatch-ledger \
  --reservation res_... \
  --signing-key ./dispatcher-private.pem \
  --key-id dispatcher-key-1 \
  --at 2026-07-22T16:03:00Z \
  --out ./dispatch-receipt.json
```

Release before dispatch:

```bash
foundry dispatch release \
  --ledger ./dispatch-ledger \
  --reservation res_... \
  --reason cancelled \
  --signing-key ./dispatcher-private.pem \
  --key-id dispatcher-key-1 \
  --at 2026-07-22T16:03:00Z
```

Inspect reconstructed state:

```bash
foundry ledger status --ledger ./dispatch-ledger --json
```

Verify a receipt:

```bash
foundry dispatch verify \
  --receipt ./dispatch-receipt.json \
  --trust-store ./runtime-trust-store.json \
  --at 2026-07-22T16:03:00Z
```

## Current boundary

The ledger authorizes and records the transition to `dispatched`, but Sprint 0.9 still performs no HTTP request. The next runtime must consume a reserved authorization, inject a credential through a protected boundary, send the request, normalize the response, and append a signed execution result without exposing secret material.
