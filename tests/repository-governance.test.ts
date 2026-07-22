import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

const required = [
  'AGENTS.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  '.github/workflows/ci.yml',
  '.github/pull_request_template.md',
  'docs/deployment/COOLIFY_CONFIGURATION.md',
  'docs/deployment/GITHUB_PUBLISHING.md',
  'scripts/audit-secrets.sh',
  'scripts/publish-github.sh'
];

describe('repository governance and operations', () => {
  it('ships agent, GitHub, and Coolify operational contracts', async () => {
    for (const file of required) await access(file);
    const agents = await readFile('AGENTS.md', 'utf8');
    assert.match(agents, /No secret material/);
    assert.match(agents, /npm test/);
    const coolify = await readFile('docs/deployment/COOLIFY_CONFIGURATION.md', 'utf8');
    assert.match(coolify, /PUBLIC_BASE_URL/);
    assert.match(coolify, /foundry-data/);
    assert.match(coolify, /8788/);
  });
});
