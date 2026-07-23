# Nümtema MCP Foundry v1.4.0

Transformez une API OpenAPI en application MCP gouvernée, testable, connectable à ChatGPT et pilotable depuis un **Studio local-first**.

```text
OpenAPI
→ Foundry Studio
→ inspection et CapabilityMap
→ édition gouvernée des tools
→ Tool Intelligence et audit qualité
→ OAuth / provider / approvals
→ simulation sans réseau
→ runtime MCP + ChatGPT App
→ package Docker Coolify/VPS
```

## Installation

Node.js 22 ou supérieur :

```bash
npm install --global ./release/numtema-mcp-foundry-1.4.0.tgz
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

Le Studio comprend : import OpenAPI JSON/YAML, inspection des risques, édition des tools et scopes, configuration provider/OAuth, aperçu du widget d’approbation, simulation dry-run et génération d’un package Coolify/VPS autonome.

```bash
foundry studio build ./mon-foundry-studio
```

Le package est créé dans `mon-foundry-studio/deploy/package`.

## Tool Intelligence v1.4

Chaque opération OpenAPI est enrichie avant sa publication MCP :

- description métier orientée sélection par ChatGPT ;
- arguments techniques et credentials retirés du schéma modèle ;
- scopes déterministes inférés sans affaiblir les scopes déclarés ;
- deux exemples valides et un contre-exemple ;
- erreurs fournisseur normalisées ;
- présentation d’approbation lisible ;
- score qualité sur 100 et statut `premium`, `ready`, `usable` ou `incomplete`.

```bash
foundry tools audit ./mon-foundry-studio
foundry tools audit ./mon-foundry-studio --json
foundry studio build ./mon-foundry-studio
```

Le build de production est bloqué lorsqu’un tool actif obtient moins de 85/100. Pour un prototype seulement :

```bash
foundry studio build ./mon-foundry-studio --allow-incomplete
```

## Runtime ChatGPT App

La v1.4 conserve OAuth 2.1 + PKCE, resources Apps SDK, widget sécurisé, scopes progressifs, Ledger durable et reçus Ed25519.

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
foundry tools audit
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

## GitHub et Coolify

- [Instructions agents](AGENTS.md)
- [Publication GitHub](docs/deployment/GITHUB_PUBLISHING.md)
- [Configuration Coolify](docs/deployment/COOLIFY_CONFIGURATION.md)

Avant publication :

```bash
./scripts/audit-secrets.sh
npm run typecheck
npm test
```

## Documentation

- [Tool Intelligence & Quality](docs/tools/TOOL_INTELLIGENCE_AND_QUALITY.md)
- [Foundry Studio](docs/studio/FOUNDRY_STUDIO.md)
- [Coolify & VPS](docs/deployment/COOLIFY_AND_VPS_ONE_CLICK.md)
- [ChatGPT App & OAuth Gateway](docs/apps/CHATGPT_APP_AND_OAUTH_GATEWAY.md)
- [MCP Server Runtime](docs/runtime/MCP_SERVER_RUNTIME.md)

## Frontière v1.4

La v1.4 produit des tools premium audités et un package prêt à importer dans Coolify ou à lancer sur un VPS. Elle ne se connecte pas encore directement à un compte Coolify et ne déclenche pas un déploiement distant avec votre token API.
