# Déployer le Provider Pack WhatsApp sur Coolify

## Ressource

```text
Build Pack: Docker Compose
Compose: /docker-compose.coolify.yml
Service: foundry-app
Port interne: 8788
Volume: foundry-data → /data
```

## Domaine

```text
https://numtema-mcp-foundry.coolify.dallico.com
```

## Variables

Utilisez `.env.example` comme inventaire. Les secrets doivent être définis au runtime et jamais pendant le build.

```env
PUBLIC_BASE_URL=https://numtema-mcp-foundry.coolify.dallico.com
PROVIDER_BASE_URL=https://graph.facebook.com
WHATSAPP_GRAPH_API_VERSION=v23.0
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_BUSINESS_ACCOUNT_ID=...
WHATSAPP_VERIFY_TOKEN=...
META_APP_SECRET=...
ADMIN_USERNAME=...
ADMIN_PASSWORD=...
```

## Contrôles après déploiement

```bash
curl -fsS https://numtema-mcp-foundry.coolify.dallico.com/.well-known/oauth-protected-resource
curl -fsS https://numtema-mcp-foundry.coolify.dallico.com/.well-known/oauth-authorization-server
```

Dans ChatGPT, actualisez ensuite le connecteur et relancez le scan des tools.
