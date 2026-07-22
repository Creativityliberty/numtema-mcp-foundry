import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ContractBundle } from '../src/contracts/types.js';

describe('ContractBundle', () => {
  it('supports the seven canonical contract collections', () => {
    const bundle: ContractBundle = {
      bundle_version: '0.2',
      tools: [],
      auth: [],
      policies: [],
      approvals: [],
      recoveries: [],
      receipts: [],
      artifacts: []
    };

    assert.deepEqual(Object.keys(bundle), [
      'bundle_version',
      'tools',
      'auth',
      'policies',
      'approvals',
      'recoveries',
      'receipts',
      'artifacts'
    ]);
  });
});
