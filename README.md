# Nümtema MCP Foundry v1.3.0

Transformez une API OpenAPI en application MCP gouvernée, testable, connectable à ChatGPT et désormais pilotable depuis un **Studio local-first**.

```text
OpenAPI
→ Foundry Studio
→ inspection et CapabilityMap
→ édition gouvernée des tools
→ OAuth / provider / approvals
→ simulation sans réseau
→ runtime MCP + ChatGPT App
→ package Docker Coolify/VPS
```

## Installation

Node.js 22 ou supérieur :

```bash
npm install --global ./release/numtema-mcp-foundry-1.3.0.tgz
foundry doctor
```

Depuis le ZIP :

```bash
./scripts/install.sh
```

Windows PowerShell :

```powershell
.\scripts\install.ps1
```

## Lancer le Studio

```bash
foundry studio init ./mon-foundry-studio --name "Mon MCP"
foundry studio serve ./mon-foundry-studio
```

Ouvrez ensuite l’URL locale affichée par la commande. Le Studio comprend :

- import OpenAPI JSON/YAML ;
- inspection et classification des risques ;
- édition des tools et scopes ;
- configuration provider et OAuth ;
- aperçu du widget d’approbation ;
- simulation HTTP dry-run ;
- génération d’un package Docker/Coolify/VPS autonome.

Pour générer sans interface :

```bash
foundry studio build ./mon-foundry-studio
```

Le package est créé dans :

```text
mon-foundry-studio/deploy/package
```

## Runtime ChatGPT App

La v1.3 conserve le gateway v1.1 : OAuth 2.1 + PKCE, resources Apps SDK, widget sécurisé, scopes progressifs, Ledger durable et reçus Ed25519.

```bash
foundry app init ./numtema-chatgpt-app \
  --public-base-url https://mcp.example.com
```

## Commandes principales

```text
foundry doctor / demo / init
foundry inspect / map / compile / validate
foundry adapters / plan
foundry auth-bindings / auth-plan / preflight
foundry ledger / dispatch
foundry mcp init / inspect / smoke / serve
foundry app init / inspect / smoke / serve
foundry studio init / inspect / build / serve
```

## Sécurité

- aucune valeur de credential dans les plans, traces ou reçus ;
- credentials injectés uniquement à la frontière HTTP ;
- risk/approval downgrade refusé par le Studio ;
- serveur Studio limité au loopback et écritures protégées par CSRF ;
- package de déploiement sans clé privée ;
- clés Ed25519 générées au premier démarrage dans un volume durable ;
- nonce, idempotence et budget réservés dans le Ledger ;
- zéro dépendance runtime.


## GitHub and Coolify

- Agent instructions: [`AGENTS.md`](AGENTS.md)
- GitHub publication: [`docs/deployment/GITHUB_PUBLISHING.md`](docs/deployment/GITHUB_PUBLISHING.md)
- Exact Coolify settings: [`docs/deployment/COOLIFY_CONFIGURATION.md`](docs/deployment/COOLIFY_CONFIGURATION.md)

Before publishing:

```bash
./scripts/audit-secrets.sh
npm run typecheck
npm test
```

## Documentation

- [Foundry Studio](docs/studio/FOUNDRY_STUDIO.md)
- [Coolify & VPS](docs/deployment/COOLIFY_AND_VPS_ONE_CLICK.md)
- [ChatGPT App & OAuth Gateway](docs/apps/CHATGPT_APP_AND_OAUTH_GATEWAY.md)
- [MCP Server Runtime](docs/runtime/MCP_SERVER_RUNTIME.md)
- [Index documentaire](docs/README.md)

## Frontière v1.3

La v1.3 produit un package prêt à importer dans Coolify ou à lancer sur un VPS. Elle ne se connecte pas encore directement à un compte Coolify et ne déclenche pas un déploiement distant avec votre token API.
