import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadOpenApiDocument } from '../src/inspection/openapi-loader.js';
import { inspectOpenApi } from '../src/inspection/source-inspector.js';

describe('Source Inspector', () => {
  it('extracts operations and source-wide metadata deterministically', async () => {
    const document = await loadOpenApiDocument('tests/fixtures/openapi-reference.json');
    const artifact = inspectOpenApi(document, 'tests/fixtures/openapi-reference.json');

    assert.equal(artifact.artifact_version, '0.3');
    assert.equal(artifact.source.title, 'Commerce Operations API');
    assert.equal(artifact.summary.operation_count, 8);
    assert.equal(artifact.summary.security_scheme_count, 1);
    assert.deepEqual(artifact.summary.domains, ['Assets', 'Customers', 'Messaging', 'Payments', 'Rendering', 'Security']);
  });

  it('detects auth, pagination, async, upload, risk, communication, and credential signals', async () => {
    const document = await loadOpenApiDocument('tests/fixtures/openapi-reference.json');
    const artifact = inspectOpenApi(document, 'reference');
    const byId = new Map(artifact.operations.map((operation) => [operation.operation_id, operation]));

    assert.equal(byId.get('listCustomers')?.pagination.detected, true);
    assert.deepEqual(byId.get('createCustomer')?.auth.required_scopes, ['customers:write']);
    assert.equal(byId.get('refundPayment')?.signals.financial, true);
    assert.equal(byId.get('refundPayment')?.signals.asynchronous, true);
    assert.equal(byId.get('refundPayment')?.signals.callback_or_webhook, true);
    assert.equal(byId.get('sendEmailMessage')?.signals.external_communication, true);
    assert.equal(byId.get('deleteApiKey')?.signals.destructive, true);
    assert.equal(byId.get('deleteApiKey')?.signals.credential_change, true);
    assert.equal(byId.get('uploadAsset')?.signals.upload, true);
    assert.equal(byId.get('createCustomer')?.signals.personal_data, true);
    assert.ok((byId.get('refundPayment')?.evidence.length ?? 0) > 0);
  });
});
