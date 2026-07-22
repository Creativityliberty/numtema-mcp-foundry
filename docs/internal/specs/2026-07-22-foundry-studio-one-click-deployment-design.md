# Foundry Studio & One-Click Deployment Design

## Goal

Deliver a local-first web Studio that drives the existing v1.1 Foundry kernel from OpenAPI import to a deployable ChatGPT App package, without duplicating compiler, OAuth, MCP, policy, ledger, or execution logic.

## Product flow

1. Create or open a Studio project.
2. Import or paste OpenAPI 3.0/3.1 JSON or YAML.
3. Inspect operations, risks, auth, pagination, media, and workflows.
4. Review the proposed capability map.
5. Rename, enable, disable, and edit tool descriptions and governance overrides.
6. Configure provider base URL, provider credential boundary, OAuth public URL, scopes, users, and workspaces.
7. Preview the approval widget for sensitive tools.
8. Run a conversation-style tool simulator using the real compiler and dry-run/runtime boundaries.
9. Build an autonomous ChatGPT App project.
10. Generate deployment packages for Coolify/Docker Compose and generic VPS.
11. Display health checks, MCP URL, OAuth metadata URLs, and exact ChatGPT connection steps.

## Architecture

### Studio frontend

A self-contained single-page application is shipped as static assets in `studio/`. It uses platform JavaScript, semantic HTML, CSS variables, native modules, and no CDN. The visual language is white, deep navy, sage green, rounded surfaces, restrained glass, compact typography, and dense but readable operational layouts.

Primary screens:

- Project dashboard
- Source import
- Inspection report
- Capability map and tool editor
- OAuth and provider credentials
- Approval widget preview
- Conversation simulator
- Build and deployment console

### Studio server

`src/studio/server.ts` serves static files and a local JSON API. It binds to loopback by default and uses a per-process CSRF token for write endpoints. It delegates all domain work to existing modules.

API groups:

- `/api/health`
- `/api/project/*`
- `/api/source/*`
- `/api/capabilities/*`
- `/api/build/*`
- `/api/simulate/*`
- `/api/deploy/*`

### Project format

Each Studio project is a directory containing:

- `studio-project.json`
- `source/openapi.json`
- `overrides/tool-overrides.json`
- `generated/source-inspection.json`
- `generated/capability-map.json`
- `generated/contract-bundle.json`
- `generated/provider-adapters.json`
- `generated/chatgpt-app/`
- `deploy/`

The project descriptor stores paths and non-secret configuration only. Secrets are represented by environment-variable names and never serialized.

### Tool editing

The Studio edits a deterministic override document rather than mutating generated contracts directly. Supported changes:

- display name and description
- enabled/disabled
- risk increase
- approval mode increase
- required scopes
- provider operation visibility

Risk and approval downgrades are rejected unless the existing compiler explicitly supports a documented, auditable override.

### Build output

The build action generates a standalone ChatGPT App directory by composing the v1.1 app initializer with current project artifacts. It includes:

- runtime and app configs
- generated contracts and adapters
- local key-generation script
- Dockerfile
- Docker Compose
- Coolify service definition and environment checklist
- health endpoint configuration
- deployment manifest
- ChatGPT connection guide

No generated private key is placed in downloadable release templates. Private keys are created at deployment initialization.

### One-click deployment

The Studio does not call a live Coolify API in v1.2. Instead it generates a deterministic deployment package that Coolify can deploy from Git or Docker Compose, plus a copyable environment-variable checklist. This avoids storing Coolify admin credentials in the Studio.

A later connector can add authenticated Coolify API deployment without changing the deployment package contract.

## Error handling

Every API response uses a stable envelope with `ok`, `data`, `issues`, and `trace_id`. User-correctable errors preserve the last valid generated artifacts. Files are written atomically using temporary files and rename.

## Security

- loopback binding by default
- CSRF token for writes
- configurable allowed origins
- no secrets in project JSON, logs, bundles, or browser storage
- path traversal protection
- bounded source size
- generated HTML escaped before display
- deployment environment variables represented by names only
- existing policy, approval, credential, and ledger gates remain authoritative

## Testing

- project store and atomic writes
- OpenAPI import and invalid-source rejection
- deterministic inspection/build artifacts
- override application and forbidden downgrade rejection
- Studio API authentication and path traversal protection
- static UI route and API smoke tests
- generated deployment package validation
- clean npm install, global CLI install, Studio startup, build, and package extraction

## Acceptance criteria

- `foundry studio init <dir>` creates a valid Studio project.
- `foundry studio serve --project <dir>` opens the operational Studio on loopback.
- Importing the rich example produces inspection, capability, contract, and adapter artifacts.
- Editing a tool creates an override and rebuilding applies it deterministically.
- The widget preview uses the real approval resource from v1.1.
- The simulator can dry-run and execute against the bundled mock provider.
- Build produces a standalone ChatGPT App and Coolify/VPS package.
- The deployment console provides the final MCP URL template and ChatGPT setup checklist.
- The complete historical test suite remains green.
