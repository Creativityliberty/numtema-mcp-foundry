# Documentation — Nümtema MCP Foundry

La documentation est classée par responsabilité. Aucun document de conception ou de vérification ne reste dispersé à la racine du projet.

## Produit

- `product/constitution/` — invariants et règles non négociables.
- `product/lifecycle/` — cycle de vie des capacités et portes de gouvernance.
- `product/INSTALLATION_AND_FIRST_RUN.md` — installation globale, diagnostic, démonstration et projet initial.

## Architecture et sécurité

- `architecture/` — architecture de référence et frontières des composants.
- `security/` — modèle de confiance, isolation et protection des secrets.
- `decisions/` — Architecture Decision Records.

## Contrats et pipeline

- `contracts/` — contrats canoniques et Contract Kernel.
- `pipeline/inspection/` — ingestion et enrichissement OpenAPI.
- `pipeline/mapping/` — transformation en CapabilityMap.
- `pipeline/compiler/` — compilation des ToolContracts.
- `pipeline/adapters/` — adapters HTTP et dry-run provider.
- `auth/` — bindings d’authentification et résolution des credentials.
- `runtime/` — serveur MCP, préflight signé, Ledger, preuves et reçus d’exécution.

## Releases et preuves

- `releases/verification/` — rapports de vérification par sprint.
- `internal/plans/` — plans d’implémentation détaillés.
- `internal/specs/` — spécifications de conception historiques.
- `references/` — références fournies ou extraites, dont Higgsfield.

## Bundle JSON

`bundle/index.json` recense chaque fichier JSON du projet. Chaque source est copiée sous `bundle/json/<chemin-original>` avec son SHA-256 et sa taille.

## MCP Runtime

- [MCP Server Runtime](runtime/MCP_SERVER_RUNTIME.md)

## Runtime durable

- [Durable Dispatch Authorization Ledger](runtime/DURABLE_DISPATCH_AUTHORIZATION_LEDGER.md)
- [Secure Provider Runtime Preflight](runtime/SECURE_PROVIDER_RUNTIME_PREFLIGHT.md)

## Vérifications récentes

- [Sprint 1.0 verification](releases/verification/SPRINT_1.0_VERIFICATION.md)
- [Sprint 0.9 verification](releases/verification/SPRINT_0.9_VERIFICATION.md)

## ChatGPT App v1.1

- [ChatGPT App & OAuth Gateway](apps/CHATGPT_APP_AND_OAUTH_GATEWAY.md)
- [Déploiement HTTPS](deployment/CHATGPT_APP_DEPLOYMENT.md)
- [Sprint 1.1 verification](releases/verification/SPRINT_1.1_VERIFICATION.md)

## Foundry Studio v1.2

- [Foundry Studio](studio/FOUNDRY_STUDIO.md)
- [Déploiement Coolify & VPS](deployment/COOLIFY_AND_VPS_ONE_CLICK.md)
- [Sprint 1.2 verification](releases/verification/SPRINT_1.2_VERIFICATION.md)

## Operations

- [`deployment/COOLIFY_CONFIGURATION.md`](deployment/COOLIFY_CONFIGURATION.md) — exact Coolify setup.
- [`deployment/GITHUB_PUBLISHING.md`](deployment/GITHUB_PUBLISHING.md) — repository publication and branch protection.
- [`../AGENTS.md`](../AGENTS.md) — instructions for coding agents.
