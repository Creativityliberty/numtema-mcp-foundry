# Sprint 1.1 — ChatGPT App & OAuth Gateway Design

## Goal

Turn the v1.0 remote MCP runtime into an OAuth-protected ChatGPT app server with user/workspace identity, progressive scopes, Apps SDK resources, and an interactive approval widget.

## Architecture

The HTTP process acts as both an MCP OAuth resource server and a compact OAuth 2.1 authorization server for self-hosted deployments. Inbound ChatGPT tokens are audience-bound to the canonical MCP resource and are never reused for provider APIs. Provider credentials remain behind the existing credential boundary.

## Components

1. `src/oauth/` — configuration, persistent store, PKCE authorization code flow, refresh tokens, JWT signing/verification, metadata endpoints, DCR and consent page.
2. `src/apps/` — Apps SDK resource registry, approval challenge store and standalone approval widget HTML.
3. `src/mcp/http-server.ts` — protected resource challenges, scope checks, request auth context propagation.
4. `src/mcp/jsonrpc-router.ts` — `resources/list`, `resources/read`, app metadata and request context.
5. `src/mcp/server-runtime.ts` — request-scoped subject/client/workspace context and dynamic approval resolution.
6. `src/cli/foundry.ts` — `foundry app init`, `foundry app inspect`, `foundry app serve`, and OAuth smoke tooling.

## Security invariants

- Authorization Code flow always requires PKCE S256.
- Redirect URI matching is exact.
- Tokens are issued for one canonical MCP resource and validated against that audience.
- Access tokens are short-lived; refresh tokens are opaque, hashed at rest, rotated on use, and revocable.
- Inbound MCP tokens never cross the provider credential boundary.
- Scope challenges use 401/403 with `WWW-Authenticate` and protected resource metadata.
- Approval challenges bind user, client, workspace, tool revision and arguments hash.
- Widget confirmation mints a one-time approval proof; it cannot alter the target arguments.
- Private signing keys are generated locally and excluded from distributed examples.

## Deliverable boundary

The release provides a production-shaped single-node gateway and a local end-to-end ChatGPT compatibility lab. Distributed consensus, external enterprise IdP federation and public hosting are outside Sprint 1.1.
