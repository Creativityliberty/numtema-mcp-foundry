import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadOpenApiDocument, OpenApiLoadError } from '../src/inspection/openapi-loader.js';

describe('OpenAPI loader', () => {
  it('loads OpenAPI 3.1 JSON documents', async () => {
    const document = await loadOpenApiDocument('tests/fixtures/openapi-reference.json');
    assert.equal(document.openapi, '3.1.0');
    assert.equal(document.info.title, 'Commerce Operations API');
  });

  it('loads OpenAPI 3.0 controlled YAML documents', async () => {
    const document = await loadOpenApiDocument('tests/fixtures/openapi-reference.yaml');
    assert.equal(document.openapi, '3.0.3');
    assert.ok('/contacts' in document.paths);
  });

  it('rejects Swagger 2 and malformed roots with a stable code', async () => {
    await assert.rejects(
      () => loadOpenApiDocument('tests/fixtures/openapi-invalid.json'),
      (error: unknown) => error instanceof OpenApiLoadError && error.code === 'UNSUPPORTED_OPENAPI_VERSION'
    );
  });
});
