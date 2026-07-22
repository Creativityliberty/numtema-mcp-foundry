# Sprint 0.8.1 Verification — Installable CLI & First-Run Experience

**Date:** 2026-07-22  
**Version:** 0.8.1  
**Node:** 22.16.0  
**Runtime dependencies:** 0

## Verified capabilities

- Package-root discovery from the installed module location rather than `process.cwd()`.
- Default schema loading from the installed package.
- Global npm binary invocation through a symlinked `foundry` entrypoint.
- `foundry --help` and `foundry --version`.
- `foundry doctor` from an unrelated working directory.
- `foundry demo` with no provider network execution or secret material.
- Optional writing of four deterministic demo artifacts.
- `foundry init` dependency-free project generation.
- Safe refusal to overwrite a non-empty directory without `--force`.
- Generated starter project pipeline: inspect → map → compile → validate.
- macOS/Linux installation script using the packaged tarball when available.
- Static Windows PowerShell installer included.
- Exhaustive JSON bundle regenerated.

## Automated verification

```text
TypeScript strict       PASS
Tests                   88 passed
Suites                   32 passed
Failures                 0
JSON sources bundled     67
Runtime dependencies     0
```

The automated installability test performs:

```text
npm pack
→ npm install --global --prefix <isolated-prefix> <tarball>
→ invoke <prefix>/bin/foundry from another directory
→ foundry doctor --json
→ foundry demo --json
→ foundry init
→ foundry inspect generated starter OpenAPI
```

## Clean installation smoke test

```text
Installed version       0.8.1
Doctor healthy          true
Doctor checks           12/12
Demo valid              true
Demo tools              4
Demo adapters           4
Init files              5
Starter pipeline        valid, 0 errors, 0 warnings
Installer script        DOCTOR_OK
```

## npm package

```text
File                     release/numtema-mcp-foundry-0.8.1.tgz
Packed files             100
Compressed size          approximately 71 KB
SHA-256                  69827795f1bb1af991e9c98615f82d74caee2eb7208a0a775044af1f8742b493
```

The package contains the compiled CLI, required schemas, the bundled demo OpenAPI, installer scripts, manifest, changelog, sources and installation guide. It does not require the TypeScript source tree at runtime.

## Security boundaries retained

```text
provider network executed      false
live secret retrieval           false
secret material in reports      false
MCP transport exposed           false
durable nonce reservation       false
durable budget reservation      false
```

## Known limitations

- Node.js 22+ is mandatory.
- The PowerShell installer is included but was not executed in this Linux verification environment.
- The package is installable locally or from its tarball; publication to the public npm registry is not part of this sprint.
- This release remains a CLI/kernel, not a desktop application or ChatGPT-connected MCP server.
