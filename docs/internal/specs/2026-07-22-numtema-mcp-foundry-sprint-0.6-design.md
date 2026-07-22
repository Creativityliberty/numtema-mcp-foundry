# Nümtema MCP Foundry Sprint 0.6 Design — Provider Adapter Contracts

## Goal

Compile enriched ToolContracts into deterministic HTTP provider adapter contracts and produce safe dry-run execution plans without performing network requests.

## Boundaries

The sprint plans provider calls but never sends them. Authentication remains a credential reference, never a bearer token. Binary and multipart bodies are represented as structured descriptors. Existing ContractBundle validation remains unchanged.

## Components

1. **Adapter compiler** — reads ToolContract source metadata and emits one `ProviderAdapterContract` per HTTP/OpenAPI tool.
2. **Request planner** — validates arguments, substitutes path variables, serializes query/header/cookie/body values, and adds idempotency metadata.
3. **Response normalizer** — classifies success/error responses and parses JSON/problem details without hiding provider status.
4. **CLI** — `foundry adapters` emits an adapter bundle; `foundry plan` emits a deterministic dry-run plan.
5. **Schemas** — adapter bundles and execution plans are validated by JSON Schema.

## Invariants

- No network I/O in Sprint 0.6.
- No secrets or live credentials in generated plans.
- Missing required arguments fail before a plan is emitted.
- Idempotency-required writes always produce an `Idempotency-Key` requirement.
- Path, query, header, cookie, and body serialization are deterministic.
- Provider errors preserve HTTP status and normalized retryability.
- Identical input produces byte-identical adapter and plan artifacts.
