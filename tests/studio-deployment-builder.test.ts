import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createStudioProject, loadStudioProject } from '../src/studio/project-store.js';
import { buildDeploymentPackage } from '../src/studio/deployment-builder.js';

describe('Foundry Studio deployment package', () => {
  it('generates a self-contained Coolify/VPS package without private keys', async () => {
    const root = await mkdtemp(join(tmpdir(), 'studio-deploy-'));
    try {
      const directory = join(root, 'project');
      await createStudioProject(directory, { name: 'ProcuFlow MCP' });
      const manifest = await buildDeploymentPackage(directory);
      const rebuiltManifest = await buildDeploymentPackage(directory);
      assert.equal(manifest.private_keys_included, false);
      assert.equal(rebuiltManifest.private_keys_included, false);
      assert.ok(manifest.files.some((file) => file.path === 'Dockerfile'));
      assert.ok(manifest.files.some((file) => file.path === 'docker-compose.coolify.yml'));
      assert.ok(manifest.files.some((file) => file.path === 'runtime-package/dist/src/cli/foundry.js'));
      const project = await loadStudioProject(directory);
      const output = join(directory, project.paths.deployment_directory);
      const compose = await readFile(join(output, 'docker-compose.coolify.yml'), 'utf8');
      assert.match(compose, /\$\{PUBLIC_BASE_URL:\?\}/);
      assert.match(compose, /PROVIDER_API_TOKEN/);
      const all = await listFiles(output);
      assert.equal(all.some((name) => name.includes('runtime-package/examples/studio/project/deploy/package/runtime-package')), false);
      assert.equal(all.some((name) => name.endsWith('.pem')), false);
      const content = await readFile(join(output, 'bootstrap.mjs'), 'utf8');
      assert.equal(content.includes('demo-token'), false);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});

async function listFiles(root: string, prefix = ''): Promise<string[]> {
  const result: string[] = [];
  for (const name of await readdir(join(root, prefix))) {
    const relative = prefix ? `${prefix}/${name}` : name;
    try { result.push(...await listFiles(root, relative)); } catch { result.push(relative); }
  }
  return result;
}
