import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createStudioProject, importStudioSource, loadStudioProject, saveStudioProject } from '../src/studio/project-store.js';

describe('Foundry Studio project store', () => {
  it('creates and reloads a complete non-secret project layout', async () => {
    const root = await mkdtemp(join(tmpdir(), 'studio-project-'));
    try {
      const directory = join(root, 'project');
      const created = await createStudioProject(directory, { name: 'ProcuFlow MCP Studio' });
      assert.equal(created.artifact_version, '1.2');
      assert.equal(created.provider.credential_environment, 'PROVIDER_API_TOKEN');
      const loaded = await loadStudioProject(directory);
      assert.equal(loaded.name, 'ProcuFlow MCP Studio');
      assert.equal((await readFile(join(directory, 'overrides', 'tool-overrides.json'), 'utf8')).trim(), '[]');
      assert.equal(JSON.stringify(loaded).includes('demo-token'), false);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('imports YAML and rejects path traversal descriptors', async () => {
    const root = await mkdtemp(join(tmpdir(), 'studio-source-'));
    try {
      const directory = join(root, 'project');
      await createStudioProject(directory);
      const imported = await importStudioSource(directory, 'procuflow.yaml', 'openapi: 3.1.0\ninfo:\n  title: ProcuFlow\n  version: 1.0.0\npaths: {}\n');
      assert.equal(imported.source.file, './source/openapi.yaml');
      imported.paths.contract_bundle = '../escape.json';
      await assert.rejects(() => saveStudioProject(directory, imported), /STUDIO_PATH_TRAVERSAL/);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
