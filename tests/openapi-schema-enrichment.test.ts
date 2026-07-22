import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { compileCapabilityMap } from '../src/compiler/tool-contract-compiler.js';
import { loadOpenApiDocument } from '../src/inspection/openapi-loader.js';
import { inspectOpenApi } from '../src/inspection/source-inspector.js';
import { mapCapabilities } from '../src/mapping/capability-mapper.js';

describe('OpenAPI schema enrichment', () => {
  it('resolves local references and retains parameters, bodies, responses, media, pagination, and errors', async () => {
    const document = await loadOpenApiDocument('tests/fixtures/openapi-schema-rich.json');
    const inspection = inspectOpenApi(document, 'schema-rich');
    const getCustomer = inspection.operations.find((operation) => operation.operation_id === 'getCustomer');
    const listCustomers = inspection.operations.find((operation) => operation.operation_id === 'listCustomers');
    const uploadFile = inspection.operations.find((operation) => operation.operation_id === 'uploadFile');

    assert.ok(getCustomer?.schema);
    assert.equal(getCustomer.schema.parameters[0]?.name, 'customerId');
    assert.deepEqual(getCustomer.schema.parameters[0]?.schema, { type: 'string', format: 'uuid' });
    assert.equal(getCustomer.schema.error_responses[0]?.status, '404');
    assert.ok(listCustomers?.schema);
    assert.equal(listCustomers.schema.pagination.style, 'cursor');
    assert.deepEqual(listCustomers.schema.pagination.response_fields, ['next_cursor', 'total']);
    assert.ok(uploadFile?.schema);
    assert.equal(uploadFile.schema.request_body?.content[0]?.media_type, 'multipart/form-data');
    assert.equal(uploadFile.schema.media.binary_request, true);
    assert.equal(uploadFile.schema.success_responses[0]?.status, '202');
  });

  it('records external references without fetching them', async () => {
    const document = await loadOpenApiDocument('tests/fixtures/openapi-schema-rich.json');
    const customerPath = document.paths['/customers'] as Record<string, unknown>;
    const post = customerPath.post as Record<string, unknown>;
    post.requestBody = { content: { 'application/json': { schema: { $ref: 'https://schemas.example.test/customer.json' } } } };
    const operation = inspectOpenApi(document, 'external-ref').operations.find((candidate) => candidate.operation_id === 'createCustomer');
    assert.deepEqual(operation?.schema?.unresolved_refs, ['https://schemas.example.test/customer.json']);
  });

  it('preserves the schema envelope through the capability map', async () => {
    const document = await loadOpenApiDocument('tests/fixtures/openapi-schema-rich.json');
    const map = mapCapabilities(inspectOpenApi(document, 'schema-rich'));
    const capability = map.capabilities.find((candidate) => candidate.source_operation_id === 'createCustomer');

    assert.ok(capability?.schema?.request_body);
    assert.equal(capability.schema.request_body.required, true);
    assert.equal(capability.schema.success_responses[0]?.status, '201');
    assert.equal(capability.schema.error_responses[0]?.status, '422');
  });

  it('compiles real parameter, request, success, and error schemas into ToolContracts', async () => {
    const document = await loadOpenApiDocument('tests/fixtures/openapi-schema-rich.json');
    const map = mapCapabilities(inspectOpenApi(document, 'schema-rich'));
    const result = compileCapabilityMap(map, { version: '0.5.0' });
    const getTool = result.bundle.tools.find((tool) => tool.name === 'customer_get');
    const createTool = result.bundle.tools.find((tool) => tool.name === 'customer_create');
    const uploadTool = result.bundle.tools.find((tool) => tool.name === 'file_upload');

    assert.deepEqual(getTool?.input_schema, {
      type: 'object',
      properties: {
        customerId: { type: 'string', format: 'uuid', description: 'Customer UUID' },
        expand: { type: 'array', items: { type: 'string' } }
      },
      required: ['customerId'],
      additionalProperties: false
    });
    assert.deepEqual(createTool?.input_schema, {
      type: 'object',
      properties: { body: { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' }, name: { type: 'string', minLength: 1 } }, additionalProperties: false } },
      required: ['body'],
      additionalProperties: false
    });
    assert.equal((createTool?.output_schema as { type?: string }).type, 'object');
    assert.equal(((createTool?.extensions?.foundry as Record<string, unknown>).schema_fidelity), 'openapi_enriched');
    const responseContract = (createTool?.extensions?.foundry as { response_contract?: { errors?: unknown[] } }).response_contract;
    assert.equal(responseContract?.errors?.length, 1);
    assert.equal((uploadTool?.input_schema as { properties?: { body?: { properties?: { file?: { format?: string } } } } }).properties?.body?.properties?.file?.format, 'binary');
    assert.equal(result.warnings.some((warning) => warning.code === 'DRAFT_SCHEMA_FIDELITY' && warning.capability === 'customer_create'), false);
  });
});
