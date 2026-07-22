import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import { loadOpenApiDocument } from '../src/inspection/openapi-loader.js';
import { inspectOpenApi } from '../src/inspection/source-inspector.js';
import { mapCapabilities } from '../src/mapping/capability-mapper.js';
import { validateValueAgainstSchema } from '../src/validation/schema-validator.js';

async function loadSchema(name: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(`schemas/${name}`, 'utf8')) as Record<string, unknown>;
}

describe('Sprint 0.3 artifact schemas', () => {
  it('validates generated source inspection and capability map artifacts', async () => {
    const document = await loadOpenApiDocument('tests/fixtures/openapi-reference.json');
    const inspection = inspectOpenApi(document, 'reference');
    const map = mapCapabilities(inspection);

    const inspectionIssues = validateValueAgainstSchema(
      await loadSchema('source-inspection-artifact.schema.json'),
      inspection,
      'source_inspection'
    );
    const richDocument = await loadOpenApiDocument('tests/fixtures/openapi-schema-rich.json');
    const richInspection = inspectOpenApi(richDocument, 'schema-rich');
    const richMap = mapCapabilities(richInspection);

    const mapIssues = validateValueAgainstSchema(
      await loadSchema('capability-map-artifact.schema.json'),
      map,
      'capability_map'
    );

    const richInspectionIssues = validateValueAgainstSchema(
      await loadSchema('source-inspection-artifact.schema.json'),
      richInspection,
      'source_inspection'
    );
    const richMapIssues = validateValueAgainstSchema(
      await loadSchema('capability-map-artifact.schema.json'),
      richMap,
      'capability_map'
    );

    assert.deepEqual(inspectionIssues, []);
    assert.deepEqual(mapIssues, []);
    assert.deepEqual(richInspectionIssues, []);
    assert.deepEqual(richMapIssues, []);
  });
});
