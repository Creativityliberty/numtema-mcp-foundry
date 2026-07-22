# Sprint 1.0 — MCP Server Runtime Design

## Goal
Expose governed Foundry ToolContracts over MCP and execute provider HTTP requests only after policy, credential, preflight, and durable dispatch checks complete.

## Supported protocol surface
- JSON-RPC 2.0 initialization (`initialize`, `notifications/initialized`, `ping`).
- `tools/list` in deterministic order with MCP tool annotations.
- `tools/call` returning text plus `structuredContent`.
- stdio transport.
- stateless Streamable HTTP POST transport with Origin, bearer-token, Accept, protocol-version, and MCP header checks.

## Runtime flow
1. Resolve tool and validate arguments.
2. Build ProviderExecutionPlan.
3. Resolve credential account and produce a redacted CredentialResolutionPlan.
4. Evaluate and sign a runtime policy decision.
5. Load exact pre-signed approval/budget artifacts when required.
6. Run Secure Provider Runtime Preflight.
7. Reserve nonce, idempotency key, and budget in Durable Dispatch Ledger.
8. Resolve credential material from an environment variable at the final boundary only.
9. Execute provider HTTP request.
10. Normalize the response.
11. Commit the durable dispatch or release it if no provider response was obtained.
12. Sign a redacted execution receipt and return MCP content.

## Scope boundaries
- No OAuth browser flow in this sprint; the credential catalog points to opaque handles, and runtime secrets come only from environment variables.
- High-risk tools require an exact signed approval artifact; the runtime never invents approval.
- Provider HTTP execution is real, but only after durable reservation.
- HTTP transport is stateless and does not mint MCP sessions.
- No Apps SDK widget UI in this sprint.

## Security invariants
- Secrets never enter plans, receipts, logs, MCP structured content, or Ledger events.
- Unknown tools and malformed protocol messages use JSON-RPC errors.
- Provider/business failures return a valid MCP tool result with `isError: true`.
- HTTP binds to `127.0.0.1` by default and validates Origin whenever present.
- Every POST validates mirrored `Mcp-Method`; `Mcp-Name` is validated for `tools/call` when supplied or required.
