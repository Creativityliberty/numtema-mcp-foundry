# Security and Trust Model

## 1. Authorization baseline

For protected HTTP MCP servers, the Foundry targets OAuth 2.1 resource-server behavior with:

- Protected Resource Metadata;
- Authorization Server Metadata;
- PKCE for authorization code flows;
- resource indicators and audience validation;
- bearer token use in the Authorization header;
- 401 for absent, invalid, or expired authorization;
- 403 for valid identity with insufficient scope;
- step-up authorization for incremental scopes.

Stdio deployments use environment or host-managed credentials and do not pretend to implement HTTP OAuth semantics.

## 2. Token rules

- Never log tokens.
- Never place tokens in query strings.
- Never accept a token intended for another audience.
- Never pass the MCP access token to a downstream provider.
- Prefer short-lived access tokens.
- Rotate refresh tokens for public clients.
- Revoke provider bindings independently of MCP sessions.

## 3. Identity tuple

Every protected operation resolves:

```text
subject_id
client_id
workspace_id
provider_id
provider_account_id
scope_set
```

This tuple is included by reference in policy evaluation and receipts.

## 4. Risk model

| Class | Meaning | Default handling |
|---|---|---|
| R0 | Pure local/read-only | May execute under active authorization |
| R1 | Additive low-impact write | Contextual authorization |
| R2 | External communication or publish | Explicit confirmation |
| R3 | Destructive or sensitive-data write | Strong confirmation |
| R4 | Financial or credential/security change | Secure widget + exact approval binding |
| R5 | Irreversible critical action | Human approval, dual control where configured |

Risk is contextual. A normally low-risk tool can be elevated by high cost, large batch size, sensitive recipients, privileged workspace, or public visibility.

## 5. Approval security

Approval records contain no executable authority until signed by the Consent Gateway. Grants are:

- short-lived;
- single-use;
- bound to normalized arguments;
- bound to tool revision;
- bound to user, client, and workspace;
- invalidated by any material change.

The model cannot construct or alter a valid grant.

## 6. Confused-deputy defenses

- Audience-bound access tokens
- Exact redirect URI validation
- Per-client consent records
- Provider credential isolation
- No cross-workspace credential reuse
- State and nonce validation
- Explicit resource parameter
- No provider token passthrough

## 7. Tool and content trust

Tool annotations, tool descriptions, provider responses, web content, uploaded files, and widget messages are untrusted inputs. They are validated, normalized, and constrained before affecting policy or execution.

## 8. Evidence and privacy

Receipts store hashes and references by default rather than raw arguments or results. Sensitive values require explicit retention policy. Credentials are never part of receipts.
