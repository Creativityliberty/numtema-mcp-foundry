# Déploiement HTTPS d'une app ChatGPT

## Reverse proxy recommandé

Le runtime écoute localement :

```json
{
  "host": "127.0.0.1",
  "port": 8788,
  "mcp_path": "/mcp"
}
```

Caddy ou Coolify termine TLS et transmet vers `127.0.0.1:8788`. Le fichier `deploy/chatgpt-app/Caddyfile.example` fournit une base.

## Variables d'environnement

- les tokens fournisseurs référencés par `credentials.environment_by_handle`;
- aucune clé OAuth ou de signature dans une variable si les fichiers privés montés sont disponibles;
- permissions `0600` sur toutes les clés privées;
- volumes persistants pour `oauth-state`, `approval-state` et `ledger`.

## Vérifications avant connexion ChatGPT

```bash
foundry app inspect --config chatgpt-app-config.json
curl https://mcp.example.com/.well-known/oauth-protected-resource
curl https://mcp.example.com/.well-known/oauth-authorization-server
curl https://mcp.example.com/oauth/jwks
```

Le POST non authentifié vers `/mcp` doit répondre `401` avec un header `WWW-Authenticate` contenant `resource_metadata`.

## Rotation

- remplacer la clé OAuth en conservant temporairement l'ancienne clé publique si des tokens sont encore valides;
- révoquer les refresh tokens existants lors d'une compromission;
- utiliser des clés distinctes pour OAuth, policy, approval, dispatch et execution;
- ne jamais réutiliser les clés générées par la démonstration en production.
