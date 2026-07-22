# Sprint 0.5 Verification Report

**Release:** Nümtema MCP Foundry v0.5.0  
**Date:** 2026-07-22

## Verified behavior

- OpenAPI 3.0/3.1 parameters are merged and retained.
- Local `#/components/...` references are resolved recursively.
- External references are recorded without network fetching.
- Request bodies retain required state, media type, and schema.
- Success, error, and other responses retain status, headers, media, and schema.
- Binary upload/download signals are derived from media and schema format.
- Cursor, page, and offset pagination metadata is retained.
- Enrichment survives SourceInspectionArtifact → CapabilityMapArtifact.
- ToolContracts receive exact input and success-output schemas.
- Errors remain separately normalized under Foundry response metadata.
- Legacy capability maps still receive conservative schema fallbacks.
- Policy, approval, auth, recovery, and receipt invariants remain active.

## Verification commands

```bash
npm run typecheck
npm test
npm run pipeline:schema-rich
node dist/src/cli/foundry.js validate examples/contract-bundle.schema-rich.generated.json
```

## Result

```text
42 tests
14 suites
0 failures
0 runtime dependencies
```
