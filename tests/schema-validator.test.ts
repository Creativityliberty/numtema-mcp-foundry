import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createSchemaRegistry } from '../src/schema/schema-registry.js';
import { validateContract } from '../src/validation/schema-validator.js';

const validTool = {
  id: 'tool://procuflow/supplier-search@1',
  name: 'supplier_search',
  version: '0.2.0',
  revision: 'sha256:abc',
  description: 'Searches suppliers using governed filters without changing provider state.',
  input_schema: { type: 'object' },
  output_schema: { type: 'object' },
  annotations: {
    read_only: true,
    destructive: false,
    idempotent: true,
    open_world: false
  },
  effects: {
    writes: false,
    external_communication: false,
    financial: false,
    credential_change: false,
    personal_data: true,
    reversible: null
  },
  execution: {
    mode: 'synchronous',
    task_support: 'forbidden',
    idempotency: 'not_applicable'
  },
  required_scopes: ['supplier:read']
};

describe('schema validation', () => {
  it('accepts a structurally valid ToolContract', async () => {
    const registry = await createSchemaRegistry('schemas');
    const issues = validateContract(registry, 'tool', validTool);
    assert.deepEqual(issues, []);
  });

  it('normalizes missing and malformed fields into deterministic issues', async () => {
    const registry = await createSchemaRegistry('schemas');
    const issues = validateContract(registry, 'tool', {
      ...validTool,
      name: 'Supplier Search',
      description: 'too short',
      annotations: { read_only: true }
    });

    assert.deepEqual(
      issues.map((issue) => [issue.code, issue.path]),
      [
        ['SCHEMA_MIN_LENGTH', '/description'],
        ['SCHEMA_REQUIRED', '/annotations/destructive'],
        ['SCHEMA_REQUIRED', '/annotations/idempotent'],
        ['SCHEMA_REQUIRED', '/annotations/open_world'],
        ['SCHEMA_PATTERN', '/name']
      ]
    );
  });
});
