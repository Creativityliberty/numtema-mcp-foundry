# ChatGPT App & OAuth Gateway Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an OAuth-protected, Apps SDK-capable remote MCP server that can be registered and tested as a custom ChatGPT app.

**Architecture:** Extend the v1.0 runtime with a zero-runtime-dependency OAuth 2.1 gateway, request-scoped identity, progressive scope challenges and MCP resource/widget support. Keep provider credentials separate from ChatGPT access tokens and preserve the existing preflight, Ledger and receipt chain.

**Tech Stack:** Node.js 22, TypeScript strict, built-in HTTP/crypto/filesystem APIs, JSON Schema 2020-12, MCP 2025-11-25.

## Global Constraints

- Zero runtime dependencies.
- OAuth Authorization Code + PKCE S256 only.
- Exact redirect URI and audience validation.
- No token passthrough.
- No private keys in distributed examples or bundles.
- Existing v1.0 tests must remain green.

---

### Task 1: OAuth contracts and cryptography

**Files:**
- Create: `src/oauth/types.ts`
- Create: `src/oauth/jwt.ts`
- Create: `src/oauth/pkce.ts`
- Test: `tests/oauth-crypto.test.ts`

**Interfaces:**
- Produces: `signAccessToken`, `verifyAccessToken`, `verifyPkceS256`, OAuth claim and config types.

- [ ] Write failing tests for valid and invalid PKCE, audience, expiry and signature.
- [ ] Run targeted tests and confirm RED.
- [ ] Implement minimal Ed25519 JWT and PKCE helpers.
- [ ] Run targeted tests and confirm GREEN.

### Task 2: Persistent OAuth store and authorization service

**Files:**
- Create: `src/oauth/store.ts`
- Create: `src/oauth/service.ts`
- Test: `tests/oauth-service.test.ts`

**Interfaces:**
- Consumes: OAuth crypto helpers.
- Produces: authorization codes, rotated refresh tokens, client registration, revocation and user/workspace identity.

- [ ] Write failing flow tests.
- [ ] Implement atomic JSON store and OAuth service.
- [ ] Verify code single-use, refresh rotation and scope narrowing.

### Task 3: OAuth HTTP gateway and resource protection

**Files:**
- Create: `src/oauth/http-gateway.ts`
- Modify: `src/mcp/http-server.ts`
- Modify: `src/mcp/jsonrpc-router.ts`
- Test: `tests/oauth-http-gateway.test.ts`

**Interfaces:**
- Produces: metadata, authorize, token, register, revoke, userinfo endpoints and request auth context.

- [ ] Write failing endpoint and challenge tests.
- [ ] Implement OAuth routes and MCP token enforcement.
- [ ] Verify 401, 403 insufficient_scope and authenticated routing.

### Task 4: Apps SDK resources and approval widget

**Files:**
- Create: `src/apps/resource-registry.ts`
- Create: `src/apps/approval-store.ts`
- Create: `src/apps/approval-widget.ts`
- Modify: `src/mcp/tool-registry.ts`
- Modify: `src/mcp/types.ts`
- Test: `tests/apps-sdk-resources.test.ts`
- Test: `tests/apps-approval-flow.test.ts`

**Interfaces:**
- Produces: `resources/list`, `resources/read`, widget metadata, approval preparation and confirmation tools.

- [ ] Test resource discovery/read and widget metadata.
- [ ] Test challenge binding and one-time approval confirmation.
- [ ] Implement registry, widget and approval store.

### Task 5: Request-scoped runtime identity and configuration

**Files:**
- Modify: `src/mcp/runtime-config.ts`
- Modify: `src/mcp/config-loader.ts`
- Modify: `src/mcp/server-runtime.ts`
- Create: `src/apps/app-assembly.ts`
- Test: `tests/app-assembly.test.ts`

**Interfaces:**
- Produces: OAuth-aware app assembly and dynamic approval resolution.

- [ ] Add config and schema tests.
- [ ] Implement user/workspace context propagation.
- [ ] Verify provider tokens remain separate.

### Task 6: CLI, templates and release verification

**Files:**
- Modify: `src/cli/foundry.ts`
- Create: `src/apps/init-app.ts`
- Create: `schemas/chatgpt-app-config.schema.json`
- Create: `docs/apps/CHATGPT_APP_AND_OAUTH_GATEWAY.md`
- Create: `docs/releases/verification/SPRINT_1.1_VERIFICATION.md`
- Test: `tests/app-cli.test.ts`
- Test: `tests/app-installability.test.ts`

**Interfaces:**
- Produces: `foundry app init|inspect|serve|smoke` and installable v1.1 package.

- [ ] Implement and test first-run commands.
- [ ] Run full suite, package installation and end-to-end OAuth/MCP smoke.
- [ ] Regenerate JSON bundle, checksums, npm tarball and ZIP.
