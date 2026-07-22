#!/usr/bin/env sh
set -eu
bad_files=$(find . -path './.git' -prune -o -path './node_modules' -prune -o -path './dist' -prune -o -type f \( -name '*.pem' -o -name '.env' -o -name '.env.local' -o -name '.env.production' -o -name '*private-key*' -o -name '*private_key*' \) -print)
if [ -n "$bad_files" ]; then
  echo "Secret-like files are forbidden:" >&2
  echo "$bad_files" >&2
  exit 1
fi
pem_hits=$(grep -RIlE --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=dist '^-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----$' . || true)
if [ -n "$pem_hits" ]; then
  echo "Private key material detected:" >&2
  echo "$pem_hits" >&2
  exit 1
fi
token_hits=$(grep -RIlE --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=dist --exclude='*.md' '(ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|sk-[A-Za-z0-9]{32,})' . || true)
if [ -n "$token_hits" ]; then
  echo "Potential live token detected:" >&2
  echo "$token_hits" >&2
  exit 1
fi
echo "SECRET_AUDIT_OK"
