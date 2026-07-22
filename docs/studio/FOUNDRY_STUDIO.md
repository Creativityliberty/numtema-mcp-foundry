# Foundry Studio v1.2

Foundry Studio est l’interface locale de Nümtema MCP Foundry. Elle pilote le vrai kernel OpenAPI → MCP et ne repose pas sur des données simulées.

## Démarrage rapide

```bash
foundry studio init ./mon-studio --name "Mon MCP"
foundry studio serve ./mon-studio
```

Ouvrez l’URL affichée par la commande. Le serveur refuse par défaut toute écoute hors loopback et les écritures API utilisent un jeton CSRF injecté dans la page.

## Parcours

1. **Dashboard** — état du projet, source et dernière compilation.
2. **Importer** — OpenAPI 3.0/3.1 JSON ou YAML, limité à 2 Mo.
3. **Inspection** — opérations, domaines, auth, workflows et signaux de risque.
4. **Tools** — activation, renommage, descriptions, scopes, risque et approbation.
5. **OAuth & Provider** — URL fournisseur, mode d’auth, variable d’environnement et URL publique.
6. **Widget** — aperçu du challenge d’approbation pour les actions sensibles.
7. **Simulation** — plan HTTP dry-run, sans réseau et sans secret.
8. **Déploiement** — génération d’un package autonome Docker/Coolify/VPS.

## Commandes

```bash
foundry studio init [DIR] [--name NAME] [--empty] [--force]
foundry studio inspect [DIR] [--json]
foundry studio build [DIR] [--json]
foundry studio serve [DIR] [--host 127.0.0.1] [--port 4173]
```

`studio build` exécute le pipeline puis génère le package de déploiement. Les clés privées ne sont pas générées dans le projet Studio : elles sont créées au premier démarrage du conteneur dans son volume durable.

## Arborescence projet

```text
mon-studio/
├── studio-project.json
├── source/
│   └── openapi.json
├── overrides/
│   └── tool-overrides.json
├── generated/
│   ├── source-inspection.json
│   ├── capability-map.json
│   ├── contract-bundle.json
│   ├── provider-adapters.json
│   ├── provider-auth-bindings.json
│   └── credential-catalog.json
└── deploy/
    └── package/
```

## Règles de gouvernance

Le Studio permet d’augmenter le risque ou l’approbation, mais refuse leur abaissement silencieux. Les credentials sont représentés par un handle et un nom de variable d’environnement ; aucune valeur secrète n’est enregistrée dans les artefacts générés.

## Limites v1.2

Le Studio génère un package prêt à déployer, mais ne se connecte pas encore à l’API d’un compte Coolify. Le déploiement distant authentifié, le suivi des logs et la récupération automatique de l’URL seront ajoutés par un connecteur séparé.
