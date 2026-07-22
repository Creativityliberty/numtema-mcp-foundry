# Nümtema MCP Foundry Sprint 0.3 Design

## Goal

Build a provider-neutral Source Inspector and Capability Mapper that ingests an OpenAPI 3.0/3.1 document, emits a deterministic inspection artifact, and derives governed capability candidates without generating executable MCP tools yet.

## Scope

Sprint 0.3 supports OpenAPI documents supplied as JSON and as the controlled YAML subset already supported by the Contract Kernel. It inspects operations, security, parameters, media types, response codes, tags, and names. It does not resolve remote `$ref` values, execute provider calls, infer business truth from response examples, or create OAuth credentials.

## Architecture

1. `openapi-loader` loads and performs minimal OpenAPI root validation.
2. `source-inspector` normalizes every HTTP operation into an `OperationInspection` and emits source-wide findings.
3. `capability-mapper` groups operations by domain, proposes stable capability names, assigns risk and governance recommendations, and detects simple workflow relations.
4. CLI commands `foundry inspect` and `foundry map` render human or JSON output and optionally write artifacts.

## Deterministic heuristics

- HTTP method is the primary effects signal.
- Explicit OpenAPI metadata takes priority over lexical heuristics.
- Lexical heuristics are conservative, explainable, and returned as evidence.
- Risk is never lowered by a heuristic. Destructive, financial, credential-changing, or personal-data operations raise governance requirements.
- Name collisions are resolved with method and stable numeric suffixes.
- Workflow hints are suggestions only and cannot authorize execution.

## Artifacts

- `SourceInspectionArtifact` version `0.3`
- `CapabilityMapArtifact` version `0.3`
- JSON Schemas for both artifact types
- Example OpenAPI source and generated examples

## Success criteria

- OpenAPI 3.0 and 3.1 roots are accepted.
- Unsupported roots fail with stable error codes.
- Operation extraction is deterministic.
- Auth, pagination, upload, async, risk, external communication, credential change, and personal-data signals are detected.
- Capability names are stable and unique.
- High-risk candidates receive non-allow governance recommendations.
- CLI exit codes remain `0` success, `2` load/usage failure.
- Existing Sprint 0.2 tests remain green.
