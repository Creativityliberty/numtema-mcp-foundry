# WhatsApp Cloud API Provider Pack v1.5

## Objectif

Compiler la surface officielle WhatsApp Cloud API en dix tools MCP métier, gouvernés et compatibles ChatGPT, sans exposer les secrets ni les identifiants Meta au modèle.

## Provider

```text
provider_ref: whatsapp-cloud-api
base_url: https://graph.facebook.com
credential: environment://WHATSAPP_ACCESS_TOKEN
```

## Runtime bindings

| Argument interne | Variable |
|---|---|
| `graph_api_version` | `WHATSAPP_GRAPH_API_VERSION` |
| `phone_number_id` | `WHATSAPP_PHONE_NUMBER_ID` |
| `waba_id` | `WHATSAPP_BUSINESS_ACCOUNT_ID` |

Ces arguments sont ajoutés après la validation du schéma visible par le modèle.

## Routes

```text
POST   /{version}/{phone-number-id}/messages
POST   /{version}/{phone-number-id}/media
GET    /{version}/{media-id}
DELETE /{version}/{media-id}
GET    /{version}/{waba-id}/message_templates
GET    /{version}/{phone-number-id}/whatsapp_business_profile
```

## Gouvernance

- lectures : R1 ;
- upload et read-state : R2 ;
- communication externe et suppression : R3 ;
- envoi/suppression : approbation exacte à usage unique ;
- bearer Meta injecté uniquement avant `fetch()` ;
- aucune valeur secrète dans les plans, logs, Ledgers ou receipts.

## Limites

Le pack v1.5 ne reçoit pas encore les webhooks Meta et ne gère pas WAHA. Les variables de webhook sont toutefois réservées dans le package Coolify afin de préparer la prochaine extension.
