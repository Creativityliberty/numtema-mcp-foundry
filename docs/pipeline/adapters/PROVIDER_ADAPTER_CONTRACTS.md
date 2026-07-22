# Provider Adapter Contracts — Sprint 0.6

## Purpose

Sprint 0.6 converts governed ToolContracts into deterministic HTTP bindings. It prepares provider execution but never performs a network request.

```text
ToolContract
→ ProviderAdapterContract
→ ProviderExecutionPlan (dry-run)
→ future credential injection and HTTP runtime
```

## Adapter contract

Each adapter binds one tool to:

- HTTP method and path template;
- path, query, header, and cookie parameters;
- body media type and encoding;
- idempotency requirements;
- expected success, error, and other response statuses;
- response normalizers;
- an `auth_ref` and required scopes, never credential values.

## Dry-run planning

`foundry plan` validates required arguments before producing an artifact. It substitutes path parameters, serializes query/header/cookie values, plans bodies, and emits a complete URL.

The artifact always contains:

```json
{
  "dry_run": true,
  "credential_requirement": {
    "secret_material_included": false
  }
}
```

No provider request is sent.

## Body encodings

| OpenAPI media | Plan encoding |
|---|---|
| `application/json` | `json` |
| `application/x-www-form-urlencoded` | `form_urlencoded` |
| `multipart/form-data` | `multipart_descriptor` |
| binary media | `artifact_reference` |
| `text/*` | `text` |
| unknown/mixed | `adaptive` |

Multipart output describes named parts and preserves artifact/media references. It does not materialize raw bytes.

## Idempotency

- `none`: no idempotency header;
- `optional`: a caller-supplied key is accepted;
- `required`: a supplied key is used, otherwise dry-run emits a deterministic `dryrun_<hash>` placeholder.

The placeholder is evidence for planning only. The future runtime must bind the final key to the logical execution attempt and ledger receipt.

## Response normalization

The normalizer preserves HTTP status and classifies bodies as `json`, `text`, `binary`, `empty`, or `adaptive`. Errors receive a stable category and retryability hint without hiding the provider payload.

## Security boundary

Sprint 0.6 does not resolve credentials, inject bearer tokens, perform OAuth, execute HTTP, retry requests, or sign receipts. These remain gated runtime responsibilities.
