# GitHub Repository Smoke Test

This temporary audit document triggers the repository CI against the exact files published on GitHub.

Checks expected from `.github/workflows/ci.yml`:

- Node.js 22 installation
- TypeScript type checking
- complete automated test suite
- secret audit
- npm package dry run

This file should not be merged unless the audit record is intentionally retained.
