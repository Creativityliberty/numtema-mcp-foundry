# Sources

## Primary standards

- Model Context Protocol, published specification 2025-11-25: https://modelcontextprotocol.io/specification/2025-11-25/
- MCP schema reference: https://modelcontextprotocol.io/specification/2025-11-25/schema
- MCP authorization: https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization
- OpenAI developer platform and Apps SDK entry point: https://developers.openai.com/

## Supplied reference

- `Texte collé(71).txt` — Higgsfield tool catalog supplied by the user on 2026-07-22.

The supplied catalog is used as an architectural reference for discovery/describe/invoke, visibility boundaries, confirmations, asynchronous jobs, upload-confirm flows, preflight cost, recovery directives, and widgets. Higgsfield-specific behavior is not copied into Foundry Core.

## Sprint 0.4 derivation note

The Tool Contract Compiler is an internal Nümtema design derived from the Foundry Constitution and the reviewed `CapabilityMapArtifact`. It introduces no new external runtime dependency and performs no network retrieval during compilation.

## Sprint 0.6 internal derivation

Provider Adapter Contracts are derived from the enriched ToolContract metadata produced by Sprints 0.4–0.5. Sprint 0.6 introduces no external provider SDK and performs no remote documentation fetch or network execution.

## Sprint 0.7 internal derivation

Credential Resolution & Provider Auth Bindings are derived from the Foundry AuthContract, tenant-binding invariants, provider adapter references, and the supplied Higgsfield separation between public tools, private confirmation actions, and user-bound execution. Sprint 0.7 adds no external auth SDK and does not retrieve, inject, log, or transmit secret material.

## Sprint 0.8 cryptographic basis

- Node.js built-in cryptography: Ed25519 public-key verification and SHA-256 hashing.
- No external cryptographic or runtime dependency.
- Private signing keys used to create static examples are not distributed.


## Sprint 0.8.1 installation basis

The installable CLI uses only Node.js and npm built-ins. Package-root discovery is based on the installed module location and package metadata, not on the caller's working directory. Installation verification uses a locally produced npm tarball and an isolated npm prefix; no external runtime library is introduced.

## Sprint 1.0 protocol basis

- MCP protocol baseline 2025-11-25 for JSON-RPC initialization, tools, and Streamable HTTP.
- OpenAI developer platform for ChatGPT Apps SDK interoperability over MCP.
- Node.js built-in HTTP, fetch, crypto, streams, and filesystem primitives.
- No external MCP SDK or runtime dependency is introduced in v1.0.

## Sprint 1.1 — ChatGPT App & OAuth Gateway

- OpenAI Help Center — Developer mode and MCP apps in ChatGPT (consulté le 22 juillet 2026).
- OpenAI Help Center — Build with the Apps SDK (consulté le 22 juillet 2026).
- Model Context Protocol Specification 2025-11-25 — Authorization, OAuth 2.1, RFC 9728, PKCE and progressive scopes.
- Model Context Protocol Apps extension conventions — `text/html;profile=mcp-app`, tool UI resource metadata and resource delivery.

## Sprint 1.2 — Foundry Studio & Deployment

- Coolify documentation — Docker Compose build pack and service deployment.
- Coolify documentation — environment variables and required-variable syntax.
- Coolify documentation — persistent storage and health checks.
- OpenAI Apps SDK and MCP documentation already cited for the v1.1 gateway and ChatGPT connection flow.

## Sprint 1.3 — GitHub Publishing & Coolify Operations

- Coolify documentation — Public Repository deployment.
- Coolify documentation — Docker Compose build pack and Compose as the source of truth.
- Coolify documentation — runtime versus build environment variables and build secrets.
- Coolify documentation — health checks and persistent storage.
- GitHub Actions built-in checkout and Node setup actions.
