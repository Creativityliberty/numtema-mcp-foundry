# MCP Server Runtime — Sprint 1.0

## Objectif

Le runtime expose les capacités compilées par Foundry au protocole MCP, tout en imposant la chaîne de gouvernance avant toute requête fournisseur.

```text
MCP initialize / tools/list / tools/call
→ validation des arguments
→ ProviderExecutionPlan
→ CredentialResolutionPlan
→ RuntimePolicyDecision
→ Secure Preflight
→ Durable Dispatch Ledger reservation
→ injection du secret à la frontière finale
→ requête HTTP fournisseur
→ normalisation
→ commit ou release du dispatch
→ SignedExecutionReceipt
```

## Démarrage local

```bash
foundry mcp init ./numtema-mcp-runtime
cd ./numtema-mcp-runtime
```

Terminal 1 :

```bash
CUSTOMER_API_TOKEN=demo-token node mock-provider.mjs
```

Terminal 2 :

```bash
CUSTOMER_API_TOKEN=demo-token foundry mcp inspect --config runtime-config.json
CUSTOMER_API_TOKEN=demo-token foundry mcp smoke --config runtime-config.json --tool customer_get --args customer-get.arguments.json
```

## Transport stdio

Dans `runtime-config.json` :

```json
{
  "server": {
    "name": "numtema-mcp",
    "version": "1.0.0",
    "protocol_version": "2025-11-25",
    "transport": { "type": "stdio" }
  }
}
```

Puis :

```bash
CUSTOMER_API_TOKEN=... foundry mcp serve --config runtime-config.json
```

Le transport utilise une requête JSON-RPC par ligne sur stdin et une réponse par ligne sur stdout. Les logs vont sur stderr.

## Streamable HTTP stateless

```json
{
  "server": {
    "name": "numtema-mcp",
    "version": "1.0.0",
    "protocol_version": "2025-11-25",
    "transport": {
      "type": "streamable_http",
      "host": "127.0.0.1",
      "port": 8787,
      "path": "/mcp",
      "allowed_origins": ["https://chatgpt.com"],
      "bearer_token_env": "MCP_SERVER_TOKEN",
      "require_mcp_headers": true
    }
  }
}
```

Démarrage :

```bash
MCP_SERVER_TOKEN=... CUSTOMER_API_TOKEN=... foundry mcp serve --config runtime-config.json
```

Le runtime HTTP :

- accepte uniquement POST sur le chemin configuré ;
- valide `Origin` contre la liste autorisée ;
- valide le bearer du serveur lorsque configuré ;
- impose `application/json` et vérifie les types acceptés ;
- peut exiger les en-têtes MCP miroirs ;
- ne conserve aucune session protocolaire côté serveur.

## Contrats et secrets

`runtime-config.json` ne contient que des chemins, identifiants de clés et noms de variables d’environnement. Les valeurs de credentials sont lues uniquement juste avant `fetch()` et ne sont jamais placées dans :

- le ProviderExecutionPlan ;
- le CredentialResolutionPlan ;
- l’AuthorizedExecutionEnvelope ;
- le Ledger ;
- le SignedExecutionReceipt ;
- le résultat MCP `_meta`.

## Gestion des erreurs

- méthode MCP inconnue ou requête JSON-RPC invalide : erreur JSON-RPC ;
- tool inconnu ou arguments invalides : erreur de protocole ;
- policy, approval, budget ou credential bloqué : résultat de tool avec `isError: true`, aucun réseau ;
- HTTP fournisseur 4xx/5xx : résultat de tool avec `isError: true`, dispatch engagé car une réponse fournisseur a été reçue ;
- panne réseau ou timeout : résultat de tool avec `isError: true`, réservation libérée.

## Limites de la v1.0

- serveur OAuth public et consentement navigateur non inclus ;
- widgets Apps SDK non inclus ;
- transport HTTP volontairement stateless ;
- corps multipart et Artifact Gateway non encore exécutés ;
- le Ledger reste local, sans consensus distribué ;
- le déploiement public et la soumission à une marketplace arrivent après le durcissement OAuth et hébergement.
