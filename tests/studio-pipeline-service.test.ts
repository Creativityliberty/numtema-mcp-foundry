import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createStudioProject, saveStudioOverrides } from '../src/studio/project-store.js';
import { buildStudioProject, readStudioGeneratedArtifact } from '../src/studio/pipeline-service.js';
import type { StudioToolOverride } from '../src/studio/types.js';

describe('Foundry Studio pipeline', () => {
  it('builds enriched contracts, adapters, auth bindings, and a redacted credential catalog', async () => {
    const root = await mkdtemp(join(tmpdir(), 'studio-pipeline-'));
    try {
      const directory = join(root, 'project');
      await createStudioProject(directory);
      const report = await buildStudioProject(directory);
      assert.equal(report.operation_count, 4);
      assert.equal(report.tool_count, 4);
      assert.equal(report.adapter_count, 4);
      const catalog = await readStudioGeneratedArtifact(directory, 'credential_catalog') as { accounts: Array<Record<string, unknown>> };
      assert.equal(catalog.accounts.length, 1);
      assert.equal(JSON.stringify(catalog).includes('PROVIDER_API_TOKEN'), true);
      assert.equal(JSON.stringify(catalog).includes('demo-token'), false);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('applies safe edits and rejects risk or approval downgrades', async () => {
    const root = await mkdtemp(join(tmpdir(), 'studio-overrides-'));
    try {
      const directory = join(root, 'project');
      await createStudioProject(directory);
      const overrides: StudioToolOverride[] = [{ source_operation_id: 'getCustomer', name: 'customer_profile_get', description: 'Read the exact customer profile.', required_scopes: ['audit:read'] }];
      await saveStudioOverrides(directory, overrides);
      await buildStudioProject(directory);
      const bundle = await readStudioGeneratedArtifact(directory, 'contract_bundle') as { tools: Array<{ name: string; required_scopes: string[] }> };
      const tool = bundle.tools.find((candidate) => candidate.name === 'customer_profile_get');
      assert.ok(tool);
      assert.equal(tool.required_scopes.includes('audit:read'), true);

      await saveStudioOverrides(directory, [{ source_operation_id: 'createCustomer', risk_class: 'R0', approval_mode: 'none' }]);
      await assert.rejects(() => buildStudioProject(directory), /STUDIO_RISK_DOWNGRADE_FORBIDDEN|STUDIO_APPROVAL_DOWNGRADE_FORBIDDEN/);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
