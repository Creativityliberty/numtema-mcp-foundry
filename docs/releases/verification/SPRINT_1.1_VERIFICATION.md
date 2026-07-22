# Sprint 1.1 Verification — ChatGPT App & OAuth Gateway

Date : 2026-07-22

## Périmètre

- OAuth 2.1 Authorization Code avec PKCE S256.
- Protected Resource Metadata RFC 9728.
- Authorization Server Metadata RFC 8414 et discovery OIDC.
- JWT Ed25519 liés à l'audience MCP.
- refresh tokens rotatifs, révocation et DCR.
- utilisateurs, clients, workspaces et scopes progressifs.
- resources Apps SDK et widget d'approbation.
- raccord au runtime MCP v1.0, au Ledger et aux reçus signés.
- CLI `foundry app init|inspect|smoke|serve`.
- configuration HTTPS directe ou reverse proxy.

## Commandes exécutées

```bash
npm test
```

Résultat :

```text
tests 135
suites 51
pass 135
fail 0
```

## Tests de sécurité

| Contrôle | Résultat |
|---|---|
| PKCE S256 correct | PASS |
| verifier PKCE incorrect | REJECTED |
| authorization code réutilisé | REJECTED |
| redirect URI différente | REJECTED |
| audience différente | REJECTED |
| access token expiré/révoqué | REJECTED |
| refresh token rotatif | PASS |
| refresh token remplacé réutilisé | REJECTED |
| client dynamique avec redirect non sûr | REJECTED |
| token absent sur `/mcp` | 401 + `resource_metadata` |
| scope fournisseur absent | 403 `insufficient_scope` |
| cross-user approval | REJECTED |
| arguments d'approbation altérés | REJECTED |
| approval nonce réutilisé | REJECTED |
| secret fournisseur dans résultat MCP | ABSENT |
| token OAuth transmis au fournisseur | ABSENT |

## Test HTTP end-to-end

Un serveur fournisseur local et le gateway ChatGPT ont été démarrés sur des ports éphémères. Le test a vérifié :

```text
GET protected-resource metadata      200
POST /mcp sans token                 401
POST tool sans scope fournisseur     403
OAuth PKCE + token complet           PASS
resources/read widget                200
provider tools/call                  200
Ledger reserved → dispatched         PASS
secret dans la réponse               false
```

## Frontière honnête

Le package est techniquement connectable à ChatGPT après déploiement sur une URL distante HTTPS ou via Secure MCP Tunnel. L'enregistrement dans le compte ou workspace ChatGPT de l'utilisateur n'est pas automatisé : il exige ses permissions, l'activation du mode développeur et l'action de créer/scanner l'app dans l'interface ChatGPT.

## Vérification du package npm

Un préfixe npm vierge a été créé, puis le tarball v1.1.0 a été installé globalement hors du dépôt :

```text
foundry --version                         1.1.0
foundry app init                          PASS
foundry app inspect                       PASS
foundry app smoke OAuth PKCE               PASS
tools exposés                             6
resources exposées                        1
refresh token émis                        true
fichiers .pem/.key dans le tarball         0
```
