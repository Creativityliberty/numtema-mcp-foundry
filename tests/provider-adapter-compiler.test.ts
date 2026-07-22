import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { compileProviderAdapters } from '../src/adapters/provider-adapter-compiler.js';
import { loadContractBundle } from '../src/contracts/contract-bundle.js';

async function richBundle() {
  return loadContractBundle('examples/contract-bundle.schema-rich.generated.json');
}

describe('Provider Adapter Compiler', () => {
  it('compiles HTTP parameter, body, response, and auth bindings from ToolContracts', async () => {
    const result = compileProviderAdapters(await richBundle());
    assert.equal(result.artifact_type, 'provider_adapter_bundle');
    assert.equal(result.adapters.length, 4);

    const adapters = new Map(result.adapters.map((adapter) => [adapter.tool_name, adapter]));
    const list = adapters.get('customer_list');
    assert.equal(list?.request.method, 'GET');
    assert.equal(list?.request.path_template, '/customers');
    assert.deepEqual(list?.request.parameters.map((binding) => [binding.argument_name, binding.location]), [
      ['cursor', 'query'],
      ['limit', 'query'],
      ['X-Trace-ID', 'header']
    ]);
    assert.equal(list?.credential.auth_ref, null);
    assert.equal(list?.response.success[0]?.status, '200');

    const create = adapters.get('customer_create');
    assert.equal(create?.request.body?.argument_name, 'body');
    assert.equal(create?.request.body?.preferred_content_type, 'application/json');
    assert.equal(create?.request.idempotency.mode, 'required');
    assert.equal(create?.request.idempotency.header_name, 'Idempotency-Key');
  });

  it('retains multipart and binary request requirements as structured bindings', async () => {
    const result = compileProviderAdapters(await richBundle());
    const upload = result.adapters.find((adapter) => adapter.tool_name === 'file_upload');
    assert.equal(upload?.request.body?.preferred_content_type, 'multipart/form-data');
    assert.equal(upload?.request.body?.binary, true);
    assert.equal(upload?.request.body?.encoding, 'multipart_descriptor');
  });

  it('is deterministic for identical ContractBundles', async () => {
    const bundle = await richBundle();
    assert.deepEqual(compileProviderAdapters(bundle), compileProviderAdapters(bundle));
  });
});
