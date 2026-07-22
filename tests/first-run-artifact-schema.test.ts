import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { runDemoPipeline } from '../src/cli/demo.js';
import { runDoctorChecks } from '../src/cli/doctor.js';
import { initializeProject } from '../src/cli/init-project.js';
import { resolvePackageAsset } from '../src/system/package-assets.js';
import { validateValueAgainstSchema } from '../src/validation/schema-validator.js';

describe('Sprint 0.8.1 first-run artifact schemas', () => {
  it('validates doctor, demo, and init reports', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'foundry-first-run-schema-'));
    try {
      const reports: Array<[string, unknown, string]> = [
        ['doctor', runDoctorChecks(workspace), 'foundry-doctor-report.schema.json'],
        ['demo', await runDemoPipeline(), 'foundry-demo-report.schema.json'],
        ['init', await initializeProject({ directory: join(workspace, 'starter'), name: 'starter' }), 'foundry-init-report.schema.json']
      ];
      for (const [kind, report, schemaFile] of reports) {
        const schema = JSON.parse(await readFile(resolvePackageAsset('schemas', schemaFile), 'utf8')) as Record<string, unknown>;
        const issues = validateValueAgainstSchema(schema, report, kind);
        assert.deepEqual(issues, []);
      }
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});
