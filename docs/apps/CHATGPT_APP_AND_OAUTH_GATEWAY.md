# ChatGPT App & OAuth Gateway — v1.1

## But

Nümtema MCP Foundry v1.1 transforme le runtime MCP v1.0 en application distante pouvant être enregistrée dans ChatGPT :

```text
ChatGPT
→ Protected Resource Metadata
→ OAuth 2.1 Authorization Code + PKCE S256
→ access token lié à l'audience MCP
→ subject + client + workspace
→ tools/list, resources/read, tools/call
→ scopes progressifs
→ approbation UI exacte
→ runtime gouverné + Ledger + reçu signé
```

## Premier démarrage

```bash
foundry app init ./numtema-chatgpt-app \
  --public-base-url https://mcp.example.com
cd ./numtema-chatgpt-app
```

La commande affiche une fois les identifiants de développement. Le mot de passe en clair n'est jamais stocké dans `chatgpt-app-config.json`; seul un hash scrypt est conservé.

```bash
CUSTOMER_API_TOKEN=demo-token node mock-provider.mjs
CUSTOMER_API_TOKEN=demo-token foundry app inspect --config chatgpt-app-config.json
CUSTOMER_API_TOKEN=demo-token foundry app serve --config chatgpt-app-config.json
```

## Endpoints publiés

- `POST /mcp` — Streamable HTTP MCP stateless.
- `GET /.well-known/oauth-protected-resource` — RFC 9728.
- `GET /.well-known/oauth-protected-resource/<mcp-path>` — metadata liée au chemin de ressource.
- `GET /.well-known/oauth-authorization-server` — RFC 8414.
- `GET /.well-known/openid-configuration` — discovery compatible.
- `GET /oauth/jwks` — clé publique Ed25519.
- `GET|POST /oauth/authorize` — connexion et consentement.
- `POST /oauth/token` — code et refresh token.
- `POST /oauth/register` — DCR optionnel.
- `POST /oauth/revoke` — révocation.
- `GET /oauth/userinfo` — identité courante.

## Garanties OAuth

- OAuth 2.1 Authorization Code.
- PKCE S256 obligatoire.
- redirect URI exacte.
- authorization code à usage unique.
- access token JWT Ed25519 court.
- `aud` exactement lié au MCP resource URI.
- refresh token opaque, rotatif et révocable.
- token non transféré au fournisseur métier.
- consentement lié à l'utilisateur et au workspace.
- 401 avec `resource_metadata` pour découverte.
- 403 `insufficient_scope` pour élévation progressive.

## Scopes

Le projet généré inclut :

- `mcp:tools` — découverte et usage général des tools.
- `mcp:resources` — lecture des resources UI.
- `mcp:approve` — préparation et confirmation des approbations.
- `offline_access` — maintien de connexion par refresh token.
- les scopes fournisseur issus des ToolContracts, par exemple `customer:read`.

Un token limité à `mcp:tools` peut lister les outils, mais reçoit un challenge `403 insufficient_scope` lorsqu'un tool demande `customer:read`.

## Apps SDK resources

Le serveur expose :

```text
ui://numtema/approval.html
```

MIME :

```text
text/html;profile=mcp-app
```

Les tools gouvernés portent les métadonnées UI `ui.resourceUri` et `openai/outputTemplate`. Une action sans approbation produit automatiquement un challenge exact, rendu par le widget. Le bouton confirme le challenge, puis rappelle le tool avec les mêmes arguments.

## Liaison exacte de l'approbation

Le challenge et la preuve finale sont liés à :

```text
subject
client
workspace
tool + revision
adapter + revision
arguments digest
risk summary
expiry
one-time nonce
```

Une modification des arguments ou un autre utilisateur invalide le challenge.

## Production

`public_base_url` doit être HTTPS, sauf pour localhost. Deux stratégies sont possibles :

1. terminer TLS directement dans Node avec `server.tls`;
2. garder Node sur `127.0.0.1:8788` et utiliser Caddy, Nginx, Coolify ou un tunnel MCP sécurisé.

Les templates sont sous `deploy/chatgpt-app/`.

## Enregistrement dans ChatGPT

1. Déployer l'app sur une URL distante HTTPS ou utiliser un tunnel MCP sécurisé.
2. Activer le mode développeur dans ChatGPT selon les droits du workspace.
3. Ouvrir `Settings/Workspace settings → Apps → Create`.
4. Saisir l'endpoint `https://votre-domaine/mcp`.
5. Choisir OAuth lorsque demandé.
6. Lancer `Scan Tools`, terminer le consentement, puis créer l'app en brouillon.
7. Tester les tools, resources et confirmations avant publication.

ChatGPT ne se connecte pas directement à `localhost`; le serveur doit être distant ou relié par un tunnel pris en charge.

## Limites v1.1

- serveur OAuth intégré adapté au développement, aux démonstrations et aux déploiements légers;
- pas encore de fédération SSO/SAML/SCIM;
- stockage OAuth et approbations local append/atomic, pas base distribuée;
- pas de portail d'administration graphique;
- aucune publication automatique dans le workspace ChatGPT, car cette action dépend du compte et des permissions de l'utilisateur.
