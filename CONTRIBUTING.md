# Contributing

Read `AGENTS.md` before modifying the project.

## Development

```bash
npm install
npm run typecheck
npm test
```

Pull requests must explain the affected contract boundary, include tests, preserve the zero-secret invariant, and update schemas/docs when public artifacts change.

## Pull request gate

- Full tests pass on Node.js 22.
- `npm pack --dry-run` contains no private keys, runtime state, or credentials.
- `./scripts/audit-secrets.sh` passes.
- New JSON artifacts appear in `bundle/index.json`.
