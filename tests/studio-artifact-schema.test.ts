import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createStudioProject } from '../src/studio/project-store.js';
import { buildStudioProject } from '../src/studio/pipeline-service.js';
import { buildDeploymentPackage } from '../src/studio/deployment-builder.js';
import { validateValueAgainstSchema } from '../src/validation/schema-validator.js';

describe('Studio artifact schemas', () => {
  it('validates the project descriptor and deployment manifest', async () => {
    const root = await mkdtemp(join(tmpdir(), 'studio-schema-'));
    try {
      const project = await createStudioProject(root, { name: 'Schema Studio' });
      await buildStudioProject(root);
      const manifest = await buildDeploymentPackage(root);
      const projectSchema = JSON.parse(await readFile('schemas/studio-project.schema.json', 'utf8')) as Record<string, unknown>;
      const deploymentSchema = JSON.parse(await readFile('schemas/deployment-package-manifest.schema.json', 'utf8')) as Record<string, unknown>;
      assert.deepEqual(validateValueAgainstSchema(projectSchema, project, 'studio_project', 'v1.2'), []);
      assert.deepEqual(validateValueAgainstSchema(deploymentSchema, manifest, 'deployment_package_manifest', 'v1.2'), []);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
