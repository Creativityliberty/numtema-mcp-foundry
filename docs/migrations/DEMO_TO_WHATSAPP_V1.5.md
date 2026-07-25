# Migration Customers/Files → WhatsApp v1.5

L’ancien déploiement était construit à partir de `examples/openapi-schema-rich.json` et exposait `customer_*` et `file_upload`.

## Nouvelle génération

```bash
foundry studio init ./numtema-whatsapp-mcp \
  --provider whatsapp \
  --public-base-url https://numtema-mcp-foundry.coolify.dallico.com \
  --force
foundry studio build ./numtema-whatsapp-mcp
foundry tools audit ./numtema-whatsapp-mcp
```

Déployez uniquement :

```text
numtema-whatsapp-mcp/deploy/package
```

Après le redéploiement, relancez `Scan Tools` dans ChatGPT. Les quatre tools de démonstration doivent disparaître et les dix tools WhatsApp doivent les remplacer.
