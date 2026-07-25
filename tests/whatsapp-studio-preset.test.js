import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCli } from '../dist/src/cli/foundry-1.5.js';

function ioCapture() {
  const output = [];
  const errors = [];
  return { output, errors, io: { out: (value) => output.push(value), error: (value) => errors.push(value) } };
}

test('studio init --provider whatsapp creates a WhatsApp-first project without demo tools', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'foundry-whatsapp-studio-'));
  const directory = join(parent, 'app');
  try {
    const capture = ioCapture();
    const code = await runCli([
      'studio', 'init', directory,
      '--provider', 'whatsapp',
      '--public-base-url', 'https://numtema-mcp-foundry.coolify.dallico.com',
      '--force'
    ], capture.io);
    assert.equal(code, 0, capture.errors.join('\n'));
    const project = JSON.parse(await readFile(join(directory, 'studio-project.json'), 'utf8'));
    const source = JSON.parse(await readFile(join(directory, 'source', 'openapi.json'), 'utf8'));
    assert.equal(project.provider.provider_ref, 'whatsapp-cloud-api');
    assert.equal(project.provider.base_url, 'https://graph.facebook.com');
    assert.equal(project.provider.credential_environment, 'WHATSAPP_ACCESS_TOKEN');
    assert.equal(project.chatgpt_app.public_base_url, 'https://numtema-mcp-foundry.coolify.dallico.com');
    assert.ok(source.paths['/{graph_api_version}/{phone_number_id}/messages/text']);
    assert.equal(JSON.stringify(source).includes('/customers'), false);
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});
