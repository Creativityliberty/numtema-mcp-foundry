# OpenAPI Schema Enrichment

Sprint 0.5 preserves the actual OpenAPI contract from source inspection through governed ToolContract compilation.

## Enriched operation envelope

Each inspected operation may now contain:

- merged path-level and operation-level parameters;
- parameter location, required flag, description, style, explode, deprecated state, and resolved schema;
- request body content by media type;
- success, error, and other responses with headers and schemas;
- binary request/response detection;
- pagination request parameters and response fields;
- unresolved external references.

Local JSON Pointer references under `#/...` are resolved deterministically. External references are recorded but never fetched automatically.

## Tool input compilation

Parameters are compiled as top-level tool arguments. A request body is exposed as `body`. Required OpenAPI inputs become JSON Schema `required` entries and `additionalProperties` is disabled for enriched tools.

If two parameters share the same name in different locations, the compiler prefixes the argument with its location, for example `header_id` and `query_id`.

## Tool output compilation

Success response schemas become the ToolContract `output_schema`. Multiple distinct success schemas become `oneOf`. A contentless `204` becomes `{ "type": "null" }`. When no success schema exists, the compiler retains the conservative asynchronous or generic fallback.

Error and non-success response contracts remain in:

```text
extensions.foundry.response_contract
```

They are not mixed into successful tool output because provider errors require a separate runtime normalization layer.

## Media and pagination

The compiler preserves media types, binary indicators, parameter serialization hints, and pagination metadata under `extensions.foundry`. This metadata will feed later Artifact Gateway and provider-adapter sprints.

## Security boundary

Schema enrichment changes data fidelity only. It cannot lower risk classes, bypass policies, remove approvals, expand scopes, fetch remote schemas, or execute provider requests.
