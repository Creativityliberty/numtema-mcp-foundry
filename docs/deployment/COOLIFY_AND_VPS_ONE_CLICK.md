# Déploiement Coolify et VPS — v1.2

La commande suivante produit un répertoire autonome :

```bash
foundry studio build ./mon-studio
```

Sortie principale :

```text
mon-studio/deploy/package/
├── Dockerfile
├── docker-compose.coolify.yml
├── .env.example
├── bootstrap.mjs
├── healthcheck.mjs
├── deployment-manifest.json
├── COOLIFY.md
├── VPS.md
├── CHATGPT_CONNECT.md
├── runtime-package/
└── template/artifacts/
```

## Coolify

1. Placez le package dans un dépôt Git privé.
2. Créez une ressource **Docker Compose** dans Coolify.
3. Sélectionnez `docker-compose.coolify.yml`.
4. Affectez un domaine HTTPS au service `foundry-app`, port interne `8788`.
5. Saisissez les variables obligatoires :

```text
PUBLIC_BASE_URL=https://mcp.example.com
PROVIDER_BASE_URL=https://api.example.com
PROVIDER_API_TOKEN=...
ADMIN_USERNAME=owner@example.com
ADMIN_PASSWORD=...
```

6. Déployez et attendez le healthcheck.
7. Vérifiez :

```text
https://mcp.example.com/.well-known/oauth-protected-resource
https://mcp.example.com/.well-known/oauth-authorization-server
https://mcp.example.com/mcp
```

Le Compose utilise les variables obligatoires `${VAR:?}`, un volume persistant pour `/data`, un healthcheck et aucun port hôte fixe.

## VPS générique

```bash
cp .env.example .env
# renseigner les valeurs

docker compose \
  -f docker-compose.coolify.yml \
  --env-file .env \
  up -d --build
```

Placez Caddy, Nginx ou Traefik devant le port `8788` et faites correspondre `PUBLIC_BASE_URL` à l’origine HTTPS exacte.

## Premier démarrage

Au premier lancement, `bootstrap.mjs` :

1. initialise une app Foundry v1.1 dans le volume durable ;
2. génère localement les paires de clés Ed25519 ;
3. injecte les contrats et adapters produits par le Studio ;
4. configure le provider et l’utilisateur administrateur ;
5. démarre le gateway OAuth/MCP.

Aucune clé privée n’est incluse dans le package de déploiement.

## Connexion ChatGPT

Utilisez l’URL :

```text
https://mcp.example.com/mcp
```

Puis lancez la découverte des tools et terminez le consentement OAuth. Commencez par les tools de lecture avant de tester les opérations exigeant une approbation.
