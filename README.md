# Nümtema MCP Foundry v1.5.0

> Transformez une API en application MCP gouvernée, testable, connectable à ChatGPT et déployable sur Coolify.

Nümtema MCP Foundry est une forge de capacités agentiques. Elle inspecte une source OpenAPI, transforme ses opérations techniques en tools compréhensibles par un agent, ajoute l’authentification, les scopes, les politiques, les approbations, les contrôles de qualité et produit un runtime MCP prêt à déployer.

La version 1.5 introduit le premier Provider Pack métier : **WhatsApp Business Platform Cloud API**.

```text
OpenAPI / Provider Pack
→ Source Inspector
→ Capability Mapper
→ Tool Contract Compiler
→ Tool Intelligence
→ OAuth / Policies / Approvals
→ Provider Adapters
→ Durable Dispatch Ledger
→ MCP Server / ChatGPT App
→ Coolify Deployment Package
```

## Ce que la Foundry construit

À partir d’une API OpenAPI 3.x, la Foundry produit :

- des tools MCP nommés par capacité métier ;
- des schémas JSON complets et adaptés au modèle ;
- des descriptions orientées sélection par ChatGPT ;
- des scopes de moindre privilège ;
- une classification des risques R0 à R5 ;
- des approbations exactes et à usage unique ;
- des adapters HTTP et une frontière de credentials ;
- OAuth 2.1 avec PKCE et isolation user/client/workspace ;
- un Ledger durable avec reçus Ed25519 ;
- un Studio local-first ;
- un package Docker Compose pour Coolify ou VPS.

## Provider Pack WhatsApp Cloud API

Le preset WhatsApp compile exactement dix capacités métier :

| Tool | Fonction | Risque |
|---|---|---:|
| `whatsapp_message_send_text` | Envoyer un message texte | R3 |
| `whatsapp_message_send_template` | Envoyer un template approuvé | R3 |
| `whatsapp_message_send_media` | Envoyer une image, vidéo, audio, document ou sticker | R3 |
| `whatsapp_message_send_interactive` | Envoyer une liste ou des boutons interactifs | R3 |
| `whatsapp_message_mark_read` | Marquer un message comme lu | R2 |
| `whatsapp_media_upload` | Préparer un média WhatsApp | R2 |
| `whatsapp_media_get` | Lire les métadonnées d’un média | R1 |
| `whatsapp_media_delete` | Supprimer un média Meta | R3 |
| `whatsapp_template_list` | Lister les templates du compte | R1 |
| `whatsapp_business_profile_get` | Lire le profil Business | R1 |

Les identifiants techniques suivants sont injectés uniquement à la frontière d’exécution :

```text
WHATSAPP_ACCESS_TOKEN
WHATSAPP_GRAPH_API_VERSION
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_BUSINESS_ACCOUNT_ID
```

Ils ne sont pas exposés dans les arguments que ChatGPT doit produire, ni dans les exemples, le Ledger ou les reçus.

## Qualité des tools

Le moteur Tool Intelligence enrichit chaque opération avant sa publication :

- description métier expliquant quand utiliser ou éviter le tool ;
- paramètres documentés ;
- headers, tokens, traces et identifiants runtime retirés du schéma modèle ;
- exemples valides et contre-exemple ;
- erreurs fournisseur normalisées ;
- scope et niveau de risque ;
- texte d’approbation compréhensible ;
- score de qualité sur 100.

Le preset WhatsApp livré obtient :

```text
Tools                     10
Score moyen              100/100
Score minimum            100/100
Tools Premium             10/10
Quality gate              validé
```

Audit :

```bash
foundry tools audit ./mon-studio
foundry tools audit ./mon-studio --json
```

Un build de production est bloqué si un tool actif obtient moins de 85/100. Le bypass suivant est réservé aux prototypes :

```bash
foundry studio build ./mon-studio --allow-incomplete
```

## Installation

Prérequis : Node.js 22 ou supérieur.

Depuis le tarball de release :

```bash
npm install --global ./release/numtema-mcp-foundry-1.5.0.tgz
foundry --version
foundry doctor
```

Depuis le projet :

```bash
npm install
npm run typecheck:v1.5
npm run test:v1.5
```

## Créer un projet WhatsApp

```bash
foundry studio init ./whatsapp-studio \
  --provider whatsapp \
  --public-base-url https://mcp.example.com

foundry tools audit ./whatsapp-studio
foundry studio build ./whatsapp-studio
```

Le package déployable est créé dans :

```text
whatsapp-studio/deploy/package
```

Le projet généré n’utilise pas l’ancienne API de démonstration Customers/Files.

## Lancer le Studio

```bash
foundry studio serve ./whatsapp-studio
```

Le Studio permet de :

- inspecter la source WhatsApp ;
- vérifier les risques et les scopes ;
- activer, désactiver ou renommer les tools ;
- prévisualiser les approbations ;
- auditer la qualité ;
- simuler les plans HTTP sans envoyer de requête ;
- produire le package Coolify/VPS.

## Configuration Coolify

Le dossier `deploy/package` contient :

```text
Dockerfile
docker-compose.coolify.yml
.env.example
bootstrap.mjs
healthcheck.mjs
deployment-manifest.json
runtime-package/
template/artifacts/
```

Variables principales :

```env
PUBLIC_BASE_URL=https://numtema-mcp-foundry.coolify.dallico.com
PROVIDER_BASE_URL=https://graph.facebook.com

WHATSAPP_ACCESS_TOKEN=secret
WHATSAPP_GRAPH_API_VERSION=v23.0
WHATSAPP_PHONE_NUMBER_ID=123456789
WHATSAPP_BUSINESS_ACCOUNT_ID=123456789
WHATSAPP_VERIFY_TOKEN=secret
META_APP_SECRET=secret

ADMIN_USERNAME=owner@example.com
ADMIN_PASSWORD=strong-password
HOST=0.0.0.0
PORT=8788
```

Dans Coolify, marquez comme **Secret** et non comme **Build Variable** :

- `WHATSAPP_ACCESS_TOKEN` ;
- `WHATSAPP_VERIFY_TOKEN` ;
- `META_APP_SECRET` ;
- `ADMIN_PASSWORD`.

Conservez le volume persistant `/data`. Il stocke les clés générées au premier démarrage, les utilisateurs OAuth, les approbations, les refresh tokens, le Ledger et les reçus.

Documentation : [`docs/deployment/WHATSAPP_COOLIFY.md`](docs/deployment/WHATSAPP_COOLIFY.md)

## Connexion à ChatGPT

Après le déploiement HTTPS :

```text
URL MCP
https://numtema-mcp-foundry.coolify.dallico.com/mcp
```

Dans ChatGPT :

```text
Settings
→ Apps
→ Create ou ouvrir l’app existante
→ URL MCP
→ OAuth
→ Actualiser / Scan Tools
```

Après le redéploiement v1.5, le catalogue attendu contient les dix tools WhatsApp. Les anciennes actions `customer_*` et `file_upload` ne doivent plus apparaître.

## Approbations et widget

Les envois externes et suppressions sensibles utilisent un challenge exact :

```text
Demande utilisateur
→ tool WhatsApp R3
→ challenge lié aux arguments et au tenant
→ widget d’approbation
→ décision à usage unique
→ exécution
→ reçu signé
```

Le widget utilise la ressource versionnée :

```text
ui://numtema/approval/v1.5.html
```

Les helpers `foundry_approval_prepare` et `foundry_approval_confirm` sont marqués **app-only**. Ils ne constituent pas des capacités métier à choisir librement par le modèle.

## Sécurité

Invariants principaux :

- aucun secret dans les plans, exemples, traces ou reçus ;
- credentials injectés juste avant la requête fournisseur ;
- validation d’audience OAuth ;
- scopes progressifs ;
- contexte lié à `user + client + workspace + provider` ;
- approbations liées au tool, à sa révision et au hash des arguments ;
- nonce à usage unique ;
- réservation durable de l’idempotence et du budget ;
- aucune requête fournisseur avant les gates de sécurité ;
- clés Ed25519 générées au premier démarrage ;
- aucune clé privée dans les packages distribués ;
- zéro dépendance runtime.

## Vérification

Commandes de release :

```bash
npx tsc -p tsconfig.v1.5.json --noEmit
node --test tests/*.test.js
./scripts/audit-secrets.sh
```

Preuves v1.5 :

```text
Tests ciblés               22/22
Échecs                     0
Tools WhatsApp             10
Score moyen                100/100
Installation npm isolée    validée
Doctor                     19 contrôles
Secrets distribués         0
Dépendances runtime        0
```

Le test HTTP fournisseur utilise un serveur Meta simulé localement. Aucune action réelle n’a été envoyée à l’API Meta pendant la vérification de release.

## Architecture du dépôt

```text
src/contracts/          contrats fondamentaux
src/inspection/         analyse OpenAPI
src/mapping/            capacités métier et risques
src/compiler/           génération des contrats
src/tools/              Tool Intelligence et quality gate
src/providers/          Provider Packs
src/adapters/           plans HTTP fournisseur
src/auth/               bindings et résolution des credentials
src/runtime/            policy et preflight
src/dispatch/           Ledger durable
src/mcp/                protocole et exécution MCP
src/apps/               OAuth et resources Apps SDK
src/studio/             Studio et génération de déploiement
providers/              sources et manifestes des Provider Packs
tests/                  tests fonctionnels et sécurité
```

## Limites actuelles

La v1.5 n’inclut pas encore :

- le receiver de webhooks Meta ;
- les événements entrants et statuts de livraison ;
- le driver WAHA ;
- un appel réel à un compte Meta pendant la CI ;
- le déploiement automatique via l’API Coolify ;
- un Ledger distribué multi-réplicas.

Ces frontières sont explicites afin de ne pas confondre un pack vérifié localement avec une intégration Meta déjà validée sur un compte de production.

## Roadmap

```text
v1.5  WhatsApp Cloud API Provider Pack
v1.6  Webhooks, conversations et delivery events
v1.7  WAHA self-hosted driver
v1.8  Provider Pack SDK et registry
v2.0  Autonomous MCP Architect
```

## Documentation

- [WhatsApp Cloud API Provider Pack](docs/providers/WHATSAPP_CLOUD_API.md)
- [Déploiement WhatsApp sur Coolify](docs/deployment/WHATSAPP_COOLIFY.md)
- [Migration de la démo vers WhatsApp](docs/migrations/DEMO_TO_WHATSAPP_V1.5.md)
- [Tool Intelligence](docs/tools/TOOL_INTELLIGENCE_AND_QUALITY.md)
- [ChatGPT App & OAuth Gateway](docs/apps/CHATGPT_APP_AND_OAUTH_GATEWAY.md)
- [MCP Server Runtime](docs/runtime/MCP_SERVER_RUNTIME.md)
- [Rapport de vérification v1.5](docs/releases/verification/SPRINT_1.5_VERIFICATION.md)
- [Instructions agents](AGENTS.md)

## Licence

Copyright © Lionel TAGNE — Nümtema AI LABS.

Ce logiciel est propriétaire et distribué sous `UNLICENSED`. Tous droits réservés.
