import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { compileProviderAdapters } from '../src/adapters/provider-adapter-compiler.js';
import { planProviderRequest, ProviderPlanError } from '../src/adapters/request-planner.js';
import type { ProviderAdapterContract } from '../src/adapters/types.js';
import { loadContractBundle } from '../src/contracts/contract-bundle.js';

async function adapter(name: string) {
  const result = compileProviderAdapters(await loadContractBundle('examples/contract-bundle.schema-rich.generated.json'));
  const found = result.adapters.find((candidate) => candidate.tool_name === name);
  assert.ok(found, `missing adapter ${name}`);
  return found;
}

describe('Provider request planner', () => {
  it('serializes path and non-exploded query arrays deterministically', async () => {
    const plan = planProviderRequest(await adapter('customer_get'), {
      customerId: 'c 123',
      expand: ['orders', 'invoices']
    }, { baseUrl: 'https://api.example.test/v1' });

    assert.equal(plan.dry_run, true);
    assert.equal(plan.request.path, '/customers/c%20123');
    assert.deepEqual(plan.request.query, [{ name: 'expand', value: 'orders,invoices' }]);
    assert.equal(plan.request.url, 'https://api.example.test/v1/customers/c%20123?expand=orders%2Cinvoices');
  });

  it('serializes headers and JSON bodies without exposing credentials', async () => {
    const listPlan = planProviderRequest(await adapter('customer_list'), {
      'X-Trace-ID': 'trace-7', cursor: 'abc', limit: 25
    }, { baseUrl: 'https://api.example.test' });
    assert.deepEqual(listPlan.request.headers, [{ name: 'X-Trace-ID', value: 'trace-7' }]);
    assert.equal(listPlan.credential_requirement.auth_ref, null);
    assert.equal(JSON.stringify(listPlan).includes('Bearer '), false);

    const createPlan = planProviderRequest(await adapter('customer_create'), {
      body: { email: 'person@example.test', name: 'Ada' }
    }, { baseUrl: 'https://api.example.test' });
    assert.equal(createPlan.request.body?.content_type, 'application/json');
    assert.equal(createPlan.request.body?.encoding, 'json');
    assert.deepEqual(createPlan.request.body?.value, { email: 'person@example.test', name: 'Ada' });
    assert.match(createPlan.idempotency.key ?? '', /^dryrun_[a-f0-9]{32}$/);
    assert.ok(createPlan.request.headers.some((header) => header.name === 'Idempotency-Key'));
  });

  it('represents multipart uploads without materializing binary bytes', async () => {
    const plan = planProviderRequest(await adapter('file_upload'), {
      body: { file: { artifact_id: 'artifact:invoice-pdf' }, label: 'invoice' }
    }, { baseUrl: 'https://api.example.test', idempotencyKey: 'upload-42' });
    assert.equal(plan.request.body?.encoding, 'multipart_descriptor');
    assert.deepEqual(plan.request.body?.value, {
      parts: [
        { name: 'file', value: { artifact_id: 'artifact:invoice-pdf' } },
        { name: 'label', value: 'invoice' }
      ]
    });
    assert.equal(JSON.stringify(plan).includes('binary_bytes'), false);
  });

  it('fails before planning when a required argument is missing', async () => {
    const customerGet = await adapter('customer_get');
    assert.throws(
      () => planProviderRequest(customerGet, {}, { baseUrl: 'https://api.example.test' }),
      (error: unknown) => error instanceof ProviderPlanError && error.code === 'MISSING_REQUIRED_ARGUMENT'
    );
  });

  it('serializes cookie parameters into one Cookie header', () => {
    const synthetic: ProviderAdapterContract = {
      id: 'adapter:session_get', version: '0.6.0', revision: 'a'.repeat(64), provider_kind: 'http_openapi',
      tool_id: 'tool:session_get', tool_name: 'session_get', tool_revision: 'b'.repeat(64),
      credential: { auth_ref: null, required_scopes: [] },
      request: {
        method: 'GET', path_template: '/session',
        parameters: [{ argument_name: 'session', source_name: 'session', location: 'cookie', required: true, deprecated: false }],
        body: null,
        idempotency: { mode: 'none', header_name: 'Idempotency-Key' }
      },
      response: { success: [], errors: [], other: [] },
      integrity: { algorithm: 'sha256', digest: 'c'.repeat(64) }
    };
    const plan = planProviderRequest(synthetic, { session: 'a b' }, { baseUrl: 'https://api.example.test' });
    assert.deepEqual(plan.request.headers, [{ name: 'Cookie', value: 'session=a%20b' }]);
  });
});

