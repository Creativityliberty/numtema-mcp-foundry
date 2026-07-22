# Generic VPS deployment

`docker compose -f docker-compose.coolify.yml --env-file .env up -d --build`

Place Caddy, Nginx, or another TLS proxy in front of container port 8788. Set PUBLIC_BASE_URL to the exact HTTPS origin used by ChatGPT. Provider: provider-api.
