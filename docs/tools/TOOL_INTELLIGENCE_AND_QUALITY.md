# Tool Intelligence & Quality

Nümtema MCP Foundry v1.4 enrichit chaque `ToolContract` après compilation et avant exposition MCP.

## Pipeline

```text
ToolContract gouverné
→ classification des arguments
→ schéma modèle sécurisé
→ description métier
→ scopes effectifs
→ exemples
→ erreurs normalisées
→ présentation d’approbation
→ score qualité
→ ToolCatalog
```

L’enrichissement est déterministe, hors ligne et additif. Il ne modifie pas le chemin fournisseur original et ne peut pas réduire les scopes, le risque ou l’approbation déclarés.

## Arguments

Les arguments sont classés en cinq catégories : `model_argument`, `runtime_managed`, `credential_managed`, `server_default` et `hidden_internal`.

Le schéma MCP utilise uniquement les `model_argument`. Le contrat fournisseur complet reste disponible pour le request planner.

## Scopes

Lorsque l’OpenAPI ne fournit aucun scope, la Foundry infère un scope stable, par exemple `customers:read`, `customers:write`, `invoices:approve` ou `payments:refund`. Un scope déclaré reste prioritaire.

## Score qualité

Le score total est de 100. Les statuts sont `premium` (95–100), `ready` (85–94), `usable` (70–84), `needs_improvement` (50–69) et `incomplete` (0–49).

## Audit

```bash
foundry tools audit ./mon-foundry-studio
foundry tools audit ./mon-foundry-studio --json
foundry studio build ./mon-foundry-studio
```

Le build production exige 85/100 minimum pour chaque tool actif. Le bypass `--allow-incomplete` est réservé aux prototypes et ne désactive aucun contrôle de sécurité du runtime.

## Artefacts

Le Studio écrit `generated/tool-catalog.json`, `generated/tool-quality-report.json` et un `contract-bundle.json` enrichi sous `extensions.foundry.tool_intelligence`.
