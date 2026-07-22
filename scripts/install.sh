#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PACKAGE_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
INSTALL_TARGET=$PACKAGE_ROOT

for candidate in "$PACKAGE_ROOT"/release/numtema-mcp-foundry-*.tgz; do
  if [ -f "$candidate" ]; then
    INSTALL_TARGET=$candidate
    break
  fi
done

printf '%s\n' "Installing Nümtema MCP Foundry from $INSTALL_TARGET"
npm install --global --no-audit --no-fund "$INSTALL_TARGET"
printf '%s\n' "Running installation diagnostics"
foundry doctor
