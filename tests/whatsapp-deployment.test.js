import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCli } from '../dist/src/cli/foundry-1.5.js';

const noopIo = { out() {}, error(value) { throw new Error(value); } };

test('WhatsApp deployment package declares every required Meta and Coolify variable', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'foundry-whatsapp-deploy-'));
  const directory = join(parent, 'studio');
  try {
    assert.equal(await runCli(['studio', 'init', directory, '--provider', 'whatsapp', '--public-base-url', 'https://numtema-mcp-foundry.coolify.dallico.com', '--force'], noopIo), 0);
    assert.equal(await runCli(['studio', 'build', directory], noopIo), 0);
    const packageDir = join(directory, 'deploy', 'package');
    const manifest = JSON.parse(await readFile(join(packageDir, 'deployment-manifest.json'), 'utf8'));
    const compose = await readFile(join(packageDir, 'docker-compose.coolify.yml'), 'utf8');
    const env = await readFile(join(packageDir, '.env.example'), 'utf8');
    const names = manifest.environment.map((item) => item.name);
    for (const name of ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_GRAPH_API_VERSION', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_BUSINESS_ACCOUNT_ID', 'WHATSAPP_VERIFY_TOKEN', 'META_APP_SECRET']) {
      assert.ok(names.includes(name), `${name} missing from manifest`);
      assert.match(compose, new RegExp(name));
      assert.match(env, new RegExp(name));
    }
    assert.equal(manifest.artifact_version, '1.5');
    assert.match(await readFile(join(packageDir, 'bootstrap.mjs'), 'utf8'), /foundry-1\.5\.js/);
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});
