# Source Inspector

The Source Inspector converts an OpenAPI 3.0/3.1 document into a deterministic `SourceInspectionArtifact`.

## Command

```bash
node dist/src/cli/foundry.js inspect openapi.json
node dist/src/cli/foundry.js inspect openapi.json --json
node dist/src/cli/foundry.js inspect openapi.json --out inspection.json
```

## What it extracts

- API title, version, servers, and OpenAPI version
- operations, methods, paths, tags, summaries, and operation identifiers
- inherited and operation-level security requirements
- OAuth scopes declared by operation security requirements
- query/path/header/cookie parameters
- request and response media types
- response status codes
- pagination style and parameter names
- asynchronous, callback, upload, and download signals
- financial, destructive, credential, communication, and personal-data signals
- evidence explaining every important inference

## Signal precedence

1. HTTP method and explicit OpenAPI declarations
2. response codes, media types, security, callbacks, and parameters
3. conservative lexical heuristics over operation metadata

The inspector does not authorize execution. Its signals become reviewable evidence for the Capability Mapper and later compiler stages.

## Limitations

- Remote `$ref` resolution is excluded.
- The bundled YAML reader supports the Foundry controlled subset; JSON is canonical.
- Lexical classification can over-classify and must never silently lower risk.
- Provider state-machine semantics are not inferred as facts.
