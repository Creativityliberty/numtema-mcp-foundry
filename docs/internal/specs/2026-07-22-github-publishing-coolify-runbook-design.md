# GitHub Publishing & Coolify Runbook Design

## Goal

Make Nümtema MCP Foundry safe for public GitHub collaboration and straightforward for a human operator to deploy manually on Coolify.

## Deliverables

- Root `AGENTS.md` with repository map, invariants, commands, security boundaries, and release protocol.
- GitHub Actions CI for Node.js 22 typecheck, tests, package inspection, and secret-file rejection.
- Contribution, security, issue, and pull-request templates.
- A public-safe GitHub publishing script that never pushes generated private keys or local secrets.
- An exact Coolify checklist for Docker Compose deployment, domains, runtime variables, storage, health checks, and ChatGPT connection.
- Regression fix preventing Studio deployment packages from recursively copying themselves on rebuild.

## Boundaries

- The repository contains no credentials, OAuth private keys, provider tokens, or generated runtime state.
- Coolify secrets are runtime-only variables and must not be build variables.
- `docker-compose.coolify.yml` remains the deployment source of truth for generated MCP apps.
- GitHub publishing must stop if secret-like files are detected.
