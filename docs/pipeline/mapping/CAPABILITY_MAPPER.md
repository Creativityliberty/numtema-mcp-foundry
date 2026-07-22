# Capability Mapper

The Capability Mapper transforms a `SourceInspectionArtifact` into a governed `CapabilityMapArtifact`.

## Command

```bash
node dist/src/cli/foundry.js map openapi.json
node dist/src/cli/foundry.js map openapi.json --json
node dist/src/cli/foundry.js map openapi.json --out capability-map.json
```

## Outputs

Each candidate includes:

- a stable snake-case capability name
- source operation, method, path, and domain
- risk class `R0` through `R5`
- recommended policy decision and approval mode
- required scopes
- MCP-style annotations
- synchronous or asynchronous execution recommendation
- idempotency recommendation
- source evidence

## Risk mapping

```text
R0  no elevated effect signal
R1  authenticated or personal-data read
R2  write operation
R3  destructive, credential, or outbound communication operation
R4  financial operation
R5  destructive credential or critical access-state operation
```

The mapper never emits an executable ToolContract and never treats a heuristic as user consent.

## Workflow hints

Sprint 0.3 detects two conservative patterns:

- asynchronous create/start operation followed by a status GET
- upload operation followed by a confirmation operation

Workflow hints are advisory artifacts. The future workflow compiler must verify identifiers, argument mappings, provider states, and recovery behavior before execution.
