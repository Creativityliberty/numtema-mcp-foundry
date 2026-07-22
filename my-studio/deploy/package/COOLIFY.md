# Coolify deployment

1. Push this directory to a Git repository.
2. In Coolify, create a Docker Compose resource from the repository.
3. Use `docker-compose.coolify.yml` as the compose file.
4. Assign a public HTTPS domain to service `foundry-app` on port 8788.
5. Fill every required environment variable shown by Coolify.
6. Deploy and wait for the health check.
7. Verify `/.well-known/oauth-protected-resource` and `/mcp`.

Provider credential environment: `PROVIDER_API_TOKEN`.

The compose file is the source of truth. No host port is published directly.
