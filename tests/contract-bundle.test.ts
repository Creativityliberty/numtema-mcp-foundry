import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { indexContractBundle, loadContractBundle } from '../src/contracts/contract-bundle.js';

describe('contract bundle loading', () => {
  it('loads the controlled YAML bundle format', async () => {
    const bundle = await loadContractBundle('tests/fixtures/valid-bundle.yaml');
    assert.equal(bundle.bundle_version, '0.2');
    assert.equal(bundle.tools[0]?.name, 'supplier_search');
    assert.equal(bundle.auth[0]?.mode, 'oauth2_1');
    assert.equal(bundle.receipts[0]?.status, 'succeeded');
  });

  it('loads an equivalent JSON bundle', async () => {
    const bundle = await loadContractBundle('tests/fixtures/valid-bundle.json');
    assert.equal(bundle.tools[0]?.id, 'tool://procuflow/supplier-search@1');
    assert.equal(bundle.artifacts[0]?.state, 'validated');
  });

  it('rejects duplicate contract identifiers while indexing', async () => {
    const bundle = await loadContractBundle('tests/fixtures/valid-bundle.yaml');
    bundle.tools.push({ ...bundle.tools[0]!, name: 'supplier_search_duplicate' });

    assert.throws(
      () => indexContractBundle(bundle),
      /DUPLICATE_CONTRACT_ID.*tool:\/\/procuflow\/supplier-search@1/
    );
  });
});
