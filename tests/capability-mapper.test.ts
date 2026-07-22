import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadOpenApiDocument } from '../src/inspection/openapi-loader.js';
import { inspectOpenApi } from '../src/inspection/source-inspector.js';
import { mapCapabilities } from '../src/mapping/capability-mapper.js';

describe('Capability Mapper', () => {
  it('generates unique stable capability candidates grouped by domain', async () => {
    const document = await loadOpenApiDocument('tests/fixtures/openapi-reference.json');
    const map = mapCapabilities(inspectOpenApi(document, 'reference'));

    assert.equal(map.artifact_version, '0.3');
    assert.equal(map.capabilities.length, 8);
    assert.equal(new Set(map.capabilities.map((candidate) => candidate.name)).size, 8);
    assert.ok(map.domains.some((domain) => domain.name === 'Payments'));
    assert.ok(map.capabilities.some((candidate) => candidate.name === 'payment_refund'));
  });

  it('raises risk and governance requirements without silently authorizing actions', async () => {
    const document = await loadOpenApiDocument('tests/fixtures/openapi-reference.json');
    const map = mapCapabilities(inspectOpenApi(document, 'reference'));
    const byOperation = new Map(map.capabilities.map((candidate) => [candidate.source_operation_id, candidate]));

    assert.equal(byOperation.get('listCustomers')?.risk_class, 'R1');
    assert.equal(byOperation.get('createCustomer')?.risk_class, 'R2');
    assert.equal(byOperation.get('refundPayment')?.risk_class, 'R4');
    assert.equal(byOperation.get('refundPayment')?.governance.decision, 'require_widget');
    assert.equal(byOperation.get('deleteApiKey')?.risk_class, 'R5');
    assert.equal(byOperation.get('deleteApiKey')?.governance.decision, 'require_approver');
    assert.equal(byOperation.get('sendEmailMessage')?.governance.decision, 'require_confirmation');
  });

  it('detects create-status and upload-confirm workflow hints', async () => {
    const document = await loadOpenApiDocument('tests/fixtures/openapi-reference.json');
    const map = mapCapabilities(inspectOpenApi(document, 'reference'));

    assert.ok(map.workflow_hints.some((workflow) =>
      workflow.kind === 'async_create_status' &&
      workflow.steps.includes('createRender') &&
      workflow.steps.includes('getRenderStatus')
    ));
  });
});
