# Sprint 1.0 Verification — MCP Server Runtime

**Version :** 1.0.0  
**Date :** 2026-07-22  
**Statut :** vérifié

## Portée livrée

- JSON-RPC MCP : `initialize`, `notifications/initialized`, `ping`, `tools/list`, `tools/call` ;
- registre déterministe de tools avec annotations MCP et métadonnées Foundry ;
- transports stdio et Streamable HTTP stateless ;
- chaîne gouvernée jusqu’à une vraie requête HTTP fournisseur ;
- injection finale bearer/API key/header/query/cookie depuis l’environnement ;
- Secure Preflight et réservation Durable Dispatch Ledger avant le réseau ;
- normalisation des succès, erreurs fournisseur et erreurs transport ;
- `SignedExecutionReceipt` Ed25519 avec redaction garantie ;
- configuration portable et `foundry mcp init` ;
- package npm sans dépendance runtime.

## Suite automatisée finale

```text
Tests    112 réussis
Suites   41 réussies
Échecs   0
JSON     81 sources recopiées dans bundle/json
```

Commandes :

```bash
npm run typecheck
npm test
```

## Installation globale isolée

Le package est créé avec `npm pack`, installé dans un préfixe npm vierge, puis exécuté depuis un dossier sans lien avec le dépôt.

Contrôles réalisés :

```text
foundry --version          1.0.0
foundry doctor             sain
foundry mcp init           runtime généré
foundry mcp inspect        4 tools, 4 adapters, 1 tool authentifié
secret material in config false
```

## Appel fournisseur réel local

Un fournisseur HTTP mock lié à `127.0.0.1:9797` a été démarré avec un bearer lu depuis `CUSTOMER_API_TOKEN`.

```bash
CUSTOMER_API_TOKEN=demo-token foundry mcp smoke \
  --config runtime-config.json \
  --tool customer_get \
  --args customer-get.arguments.json \
  --json
```

Résultat vérifié :

```text
initialize                         réussi
services/tools/list                4 tools
services/tools/call customer_get   réussi
HTTP fournisseur                   200
Ledger sequence                    2
reservation                        reserved puis dispatched
SignedExecutionReceipt             présent et signé
secret_material_included           false
credential_handle_included         false
```

## Cas négatifs automatisés

- méthode JSON-RPC inconnue ;
- tool inconnu et arguments invalides ;
- Origin non autorisé ;
- bearer MCP invalide ;
- Accept ou Content-Type invalide ;
- approval manquante pour un tool à risque ;
- credential non prêt ou secret absent ;
- réponse fournisseur 4xx/5xx ;
- timeout et panne transport ;
- replay nonce/idempotency ;
- journal altéré ;
- signature ou finalité de clé incorrecte.

## Invariants constatés

- aucun réseau avant la réussite du préflight et de la réservation ;
- aucun secret dans les artefacts, logs structurés ou reçus ;
- une réponse HTTP engage le dispatch, même en erreur fournisseur ;
- une erreur réseau libère la réservation ;
- le reçu d’exécution est lié au tool, adapter, arguments, tenant, réservation et reçu de dispatch ;
- aucune clé privée n’est distribuée dans les exemples ou le package npm.

## Limites assumées

- OAuth public et consentement navigateur non inclus ;
- widgets Apps SDK non inclus ;
- exécution multipart/Artifact Gateway non incluse ;
- transport HTTP stateless ;
- Ledger local sans consensus distribué.
