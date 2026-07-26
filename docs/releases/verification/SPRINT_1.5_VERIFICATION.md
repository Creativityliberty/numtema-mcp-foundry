# Sprint 1.5 Verification — WhatsApp Cloud API Provider Pack

Date de vérification : 26 juillet 2026.

## Périmètre

Le Sprint 1.5 remplace la source de démonstration Customers/Files par un provider pack WhatsApp Cloud API et ajoute :

- dix tools métier ;
- transformations vers les routes et payloads Graph API ;
- identifiants Meta résolus au runtime ;
- helpers d’approbation app-only ;
- widget MCP Apps versionné avec domaine et CSP ;
- preset Studio WhatsApp ;
- variables et package Coolify dédiés ;
- README et guides de migration.

## Vérifications exécutées

```text
TypeScript ciblé strict            réussi
Tests v1.5                          22/22
Échecs                              0
Audit secrets                       SECRET_AUDIT_OK
Tools WhatsApp                      10
Score moyen                         100/100
Score minimum                       100/100
Tools Premium                       10/10
Arguments Meta visibles au modèle   0
Installation npm globale isolée     validée
Doctor                              19 contrôles réussis
Studio init --provider whatsapp     validé
Tools audit                         validé
Studio build                        validé
Package Coolify                     513 fichiers
JSON distribution bundle            91 fichiers
Clés privées distribuées             0
Dépendances runtime                  0
```

## Preuve d’exécution fournisseur

Un serveur HTTP local a simulé la Graph API. Le runtime a vérifié :

- résolution de `WHATSAPP_GRAPH_API_VERSION` ;
- résolution de `WHATSAPP_PHONE_NUMBER_ID` ;
- injection du bearer `WHATSAPP_ACCESS_TOKEN` uniquement avant la requête ;
- appel de `/v23.0/{phone-number-id}/whatsapp_business_profile` ;
- absence du token et des identifiants Meta dans le résultat MCP ;
- blocage d’un envoi de message avant le réseau lorsque l’approbation manque.

Aucun appel réel vers le compte Meta de l’utilisateur n’a été effectué pendant cette vérification.

## Frontières de sécurité

- le token Meta n’est présent dans aucun contrat, exemple, Ledger ou reçu ;
- les IDs Meta sont absents du schéma visible par ChatGPT ;
- les envois et suppressions restent soumis au Policy Engine ;
- les approvals sont liés au tenant et aux arguments exacts ;
- `foundry_approval_prepare` et `foundry_approval_confirm` sont app-only ;
- le package ne contient aucun `.pem` ni `.env` secret.

## Limites restantes

- le receiver de webhooks Meta n’est pas encore inclus ;
- la validation `X-Hub-Signature-256` est prévue pour le sprint suivant ;
- aucun driver WAHA n’est inclus ;
- le redéploiement Coolify et le nouveau Scan Tools doivent être effectués par le propriétaire ;
- GitHub Actions reste bloqué par le problème de facturation affiché sur le compte GitHub.

## Commandes de reproduction

```bash
npx tsc -p tsconfig.v1.5.json --noEmit
node --test tests/*.test.js
./scripts/audit-secrets.sh

foundry studio init ./numtema-whatsapp-mcp \
  --provider whatsapp \
  --public-base-url https://numtema-mcp-foundry.coolify.dallico.com \
  --force
foundry tools audit ./numtema-whatsapp-mcp
foundry studio build ./numtema-whatsapp-mcp
```
