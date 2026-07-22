# Coolify Configuration — Nümtema MCP Foundry

This runbook covers manual deployment of a **generated Foundry MCP application package**, not public exposure of the local Studio editor.

## 1. Generate the deployable package

```bash
foundry studio build ./mon-foundry-studio
cd ./mon-foundry-studio/deploy/package
```

Commit this generated package to a dedicated deployment repository or subdirectory. It contains `Dockerfile`, `docker-compose.coolify.yml`, bootstrap scripts, runtime artifacts, and operator guides. It contains no private key.

## 2. Create the Coolify resource

For a public GitHub repository:

1. Project → **New Resource**.
2. Select **Public Repository**.
3. Paste the repository URL.
4. Select branch `main`.
5. Build Pack: **Docker Compose**.
6. Base Directory: the directory containing the generated package, for example `/deploy/package`; use `/` when the package is the repository root.
7. Docker Compose Location: `/docker-compose.coolify.yml` relative to the Base Directory.
8. Keep Raw Compose disabled unless you deliberately manage Traefik labels yourself.

For a private repository, connect the Coolify GitHub App or use a deploy key.

## 3. Domain and port

Assign one HTTPS domain to service `foundry-app`:

```text
https://mcp.example.com:8788
```

In the Coolify UI, the service listens internally on **8788**. Do not publish a host port manually. Coolify’s proxy provides TLS and routes the domain to the service.

The final endpoints are:

```text
https://mcp.example.com/mcp
https://mcp.example.com/.well-known/oauth-protected-resource
https://mcp.example.com/.well-known/oauth-authorization-server
https://mcp.example.com/oauth/jwks
```

## 4. Runtime environment variables

Create these as **runtime variables**. Disable “Build Variable” for all secrets.

| Variable | Required | Secret | Example | Purpose |
|---|---:|---:|---|---|
| `PUBLIC_BASE_URL` | yes | no | `https://mcp.example.com` | Exact public origin. No trailing slash. |
| `PROVIDER_BASE_URL` | yes | no | `https://api.provider.com/v1` | Upstream API origin. |
| `PROVIDER_API_TOKEN` | when provider auth is enabled | yes | generated/provider token | Name may differ; use the name shown in the deployment manifest. |
| `ADMIN_USERNAME` | yes | no | `owner@example.com` | Initial OAuth owner login. |
| `ADMIN_PASSWORD` | yes | yes | strong unique password | Initial OAuth owner password, minimum 8 characters. |
| `PORT` | optional | no | `8788` | Already set by Compose. |
| `HOST` | optional | no | `0.0.0.0` | Already set by Compose. |

Never add provider tokens as build arguments. Runtime-only variables avoid embedding secrets in image metadata or layers.

## 5. Persistent storage

Keep the named volume `foundry-data` mounted at:

```text
/data
```

It stores generated Ed25519 private keys, OAuth state, runtime configuration, approval data, and the durable dispatch ledger. Removing this volume resets identities and cryptographic continuity.

Use one active writer per volume. Do not mount the same ledger volume into multiple replicas.

## 6. Health check

The Compose file defines a healthcheck against:

```text
/.well-known/oauth-protected-resource
```

Expected result: HTTP `200`. Keep health checks enabled so Coolify routes traffic only after the app is ready.

Recommended values:

```text
interval: 20 seconds
timeout: 5 seconds
start period: 20 seconds
retries: 5
```

## 7. Deploy and verify

After deployment, verify:

```bash
curl -fsS https://mcp.example.com/.well-known/oauth-protected-resource
curl -fsS https://mcp.example.com/.well-known/oauth-authorization-server
```

Then inspect logs for:

```text
APP_READY
OAuth issuer matches PUBLIC_BASE_URL
MCP resource equals PUBLIC_BASE_URL + /mcp
healthcheck healthy
```

## 8. Connect ChatGPT

1. Enable Developer Mode in ChatGPT.
2. Open Apps → Create.
3. MCP URL: `https://mcp.example.com/mcp`.
4. Select OAuth.
5. Scan tools.
6. Sign in with `ADMIN_USERNAME` / `ADMIN_PASSWORD`.
7. Grant only the requested scopes.
8. Test read-only tools before write or approval-bound tools.

## 9. Automatic deployment

Enable automatic deployments for branch `main` after the first successful manual deploy. Keep pull-request previews disabled for production credentials unless each preview receives an isolated domain, volume, and provider account.

## 10. Failure checklist

- **502 / no available server:** confirm service port 8788 and a healthy container.
- **OAuth redirect mismatch:** `PUBLIC_BASE_URL` must exactly match the HTTPS domain.
- **401:** inspect token audience and OAuth metadata.
- **403 insufficient_scope:** reconnect and grant the requested scope.
- **Lost approvals or keys after redeploy:** verify `foundry-data` is still mounted at `/data`.
- **Provider 401:** verify the provider credential variable name and value.
