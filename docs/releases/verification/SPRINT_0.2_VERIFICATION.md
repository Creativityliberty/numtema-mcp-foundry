# Sprint 0.2 Verification Report

**Release:** Nümtema MCP Foundry v0.2.0 — Contract Kernel  
**Verification date:** 2026-07-22

## Commands executed

```bash
npm test
npm run typecheck
npm run build
node dist/src/cli/foundry.js validate examples/contract-bundle.yaml
node dist/src/cli/foundry.js validate tests/fixtures/invalid-high-risk.yaml --json
node dist/src/cli/foundry.js validate tests/fixtures/invalid-auth.yaml --json
```

## Results

- Automated tests: **16 passed, 0 failed**
- Test suites: **5 passed, 0 failed**
- TypeScript typecheck: **passed**
- TypeScript build: **passed**
- Valid reference bundle: exit **0**, zero errors
- Invalid high-risk bundle: exit **1**, `POLICY_HIGH_RISK_ALLOW`
- Invalid OAuth/tenant bundle: exit **1**, three expected auth violations
- JSON parsing: all seven contract schemas and `MANIFEST.json` parsed successfully
- Runtime dependencies: **0**

## Covered constitutional controls

- annotations cannot override side-effect reality;
- writes require idempotency semantics;
- asynchronous task requirements are coherent;
- high-risk policies cannot default to allow;
- financial and destructive actions require governance;
- references and scopes resolve;
- OAuth audience and PKCE controls are present;
- token passthrough is prohibited;
- tenant credential bindings include subject and workspace;
- approval grants bind exact arguments and revisions;
- recovery cannot escalate risk, scopes, or cost;
- receipts preserve hashes, chronology, and tool revision integrity.

## Scope statement

No provider API calls, MCP transport, OAuth authorization server, approval-token issuer, or cryptographic signer is included in Sprint 0.2.
