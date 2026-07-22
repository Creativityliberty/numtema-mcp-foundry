# Credential Resolution & Provider Auth Bindings

## Objectif

Le Sprint 0.7 sépare strictement quatre objets :

```text
AuthContract
→ ProviderAuthBindingContract
→ CredentialAccountDescriptor
→ CredentialResolutionPlan
```

Le Foundry ne résout jamais la valeur réelle d’un token, d’une clé API, d’un mot de passe ou d’un secret HMAC. Il produit uniquement un plan de préflight redacted.

## ProviderAuthBindingContract

Chaque AuthContract est compilé vers une description provider-neutral contenant :

- le mode `oauth2_1`, `bearer`, `api_key`, `basic`, `hmac`, `host_managed` ou `none` ;
- les adapters et tools concernés ;
- les scopes requis et optionnels ;
- les dimensions de liaison `subject`, `client`, `workspace`, `provider`, `provider_account`, `scope_set` ;
- les exigences d’audience, de resource URI et de PKCE ;
- la stratégie d’injection, sans matériel secret.

## CredentialCatalog

Un compte credential contient des métadonnées de sélection :

```text
credential_handle
subject_ref
client_ref
workspace_ref
provider_ref
provider_account_ref
mode
status
granted_scopes
audiences
expires_at
```

`secret_locator` peut exister dans le catalogue d’entrée afin de pointer vers un coffre. Il n’est jamais recopié dans le plan de résolution.

## Préflight fail-closed

La résolution refuse l’exécution lorsque :

- aucun compte actif et non expiré ne correspond ;
- le sujet, client, workspace ou compte fournisseur ne correspond pas ;
- le mode d’authentification diffère ;
- un scope requis manque ;
- l’audience OAuth ne correspond pas au `canonical_resource_uri` ;
- l’AuthContract autorise un token passthrough.

## Enveloppe redacted

Le plan final ne contient que :

```json
{
  "credential_handle": "credential-handle-customer-001",
  "secret_material_included": false
}
```

Il ne contient jamais le `secret_locator`, ni la valeur du secret.

## CLI

```bash
foundry auth-bindings contract-bundle.json --out provider-auth-bindings.json

foundry auth-plan contract-bundle.json \
  --tool customer_get \
  --credentials credential-catalog.json \
  --context credential-context.json \
  --out credential-resolution-plan.json
```

Codes de sortie pour `auth-plan` :

```text
0  préflight prêt
1  préflight bloqué par une règle de sécurité
2  erreur de chargement, usage ou configuration
```
