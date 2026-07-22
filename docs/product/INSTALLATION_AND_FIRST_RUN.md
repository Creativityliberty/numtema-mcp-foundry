# Installation et premier démarrage

## 1. Pré-requis

- Node.js 22 ou supérieur ;
- npm 10 ou supérieur recommandé ;
- aucun Docker, base de données ou compte fournisseur requis pour la démonstration.

Vérifier :

```bash
node --version
npm --version
```

## 2. Installer depuis le ZIP

Décompresser l’archive puis ouvrir un terminal dans le dossier.

### macOS / Linux

```bash
./scripts/install.sh
```

Le script exécute :

```bash
npm install --global <dossier-foundry>
foundry doctor
```

### Windows PowerShell

```powershell
.\scripts\install.ps1
```

### Installation manuelle

```bash
npm install --global .
foundry doctor
```

Aucune dépendance runtime n’est téléchargée. Le package installé contient le code JavaScript compilé, les JSON Schemas et l’OpenAPI de démonstration.

## 3. Vérifier l’installation

```bash
foundry doctor
```

Le diagnostic contrôle :

- Node.js 22+ ;
- le nom et la version du package ;
- la résolution du dossier d’installation ;
- les schemas fondamentaux ;
- l’OpenAPI de démonstration ;
- les droits d’écriture dans le dossier courant.

Sortie machine :

```bash
foundry doctor --json
```

Un diagnostic sain retourne le code `0`. Un environnement incomplet retourne `1`. Une mauvaise utilisation de commande retourne `2`.

## 4. Exécuter la démonstration

```bash
foundry demo
```

La démonstration embarquée exécute :

```text
OpenAPI
→ inspection
→ CapabilityMap
→ ToolContracts et policies
→ validation constitutionnelle
→ ProviderAdapterBundle
```

Pour conserver les artefacts :

```bash
foundry demo --out-dir ./demo-output
```

Fichiers produits :

```text
demo-output/
├── source-inspection.json
├── capability-map.json
├── contract-bundle.json
└── provider-adapters.json
```

Garanties :

```text
network_executed: false
secret_material_included: false
```

## 5. Créer un premier projet

```bash
foundry init mon-premier-mcp
cd mon-premier-mcp
npm run pipeline
```

Le projet généré contient :

```text
.gitignore
README.md
foundry.config.json
openapi.json
package.json
generated/
```

Il ne contient aucune dépendance. Les scripts utilisent la commande globale `foundry`.

Pour remplacer volontairement un dossier existant :

```bash
foundry init mon-premier-mcp --force
```

Sans `--force`, la Foundry refuse d’écraser un dossier non vide.

## 6. Utilisation sans installation globale

Depuis le dossier du package :

```bash
node dist/src/cli/foundry.js doctor
node dist/src/cli/foundry.js demo
node dist/src/cli/foundry.js init ./mon-premier-mcp
```

## 7. Désinstallation

```bash
npm uninstall --global @numtema/mcp-foundry
```

## 8. Ce que cette version ne fait pas encore

- connexion directe à ChatGPT ;
- serveur MCP HTTP ou stdio publié ;
- exécution réseau réelle des adapters ;
- récupération de secrets depuis un coffre ;
- installation desktop DMG/EXE ;
- réservation durable de nonce ou de budget.


## Tester le Ledger durable

Après avoir produit un `AuthorizedExecutionEnvelope`, initialisez un journal puis réservez le dispatch :

```bash
foundry ledger init ./dispatch-ledger --at 2026-07-22T16:01:00Z
foundry dispatch reserve --ledger ./dispatch-ledger --envelope ./authorized-execution-envelope.json --signing-key ./dispatcher-private.pem --key-id dispatcher-key-1 --at 2026-07-22T16:02:00Z
foundry ledger status --ledger ./dispatch-ledger --json
```

La clé privée reste hors des artefacts distribués.


## Premier runtime MCP v1.0

```bash
foundry mcp init ./numtema-mcp-runtime
cd ./numtema-mcp-runtime
```

Le scaffold génère localement trois clés Ed25519 de démonstration, un trust store, une configuration portable et un fournisseur mock. Les clés ne sont jamais contenues dans le package npm.

Terminal 1 :

```bash
CUSTOMER_API_TOKEN=demo-token node mock-provider.mjs
```

Terminal 2 :

```bash
CUSTOMER_API_TOKEN=demo-token foundry mcp smoke --config runtime-config.json --tool customer_get --args customer-get.arguments.json
```

Pour exposer le serveur :

```bash
CUSTOMER_API_TOKEN=demo-token foundry mcp serve --config runtime-config.json
```

Consulter `docs/runtime/MCP_SERVER_RUNTIME.md` pour le transport HTTP, l’Origin allowlist, le bearer du serveur et les limites OAuth de la v1.0.
