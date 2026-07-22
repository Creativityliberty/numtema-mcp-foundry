import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createAppToolCaller } from '../src/apps/app-assembly.js';

describe('Automatic approval widget handoff', () => {
  it('converts an approval-required runtime result into an exact approval challenge', async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const caller = createAppToolCaller(
      async () => ({ content: [{ type: 'text', text: 'approval required' }], structuredContent: { category: 'approval_required', code: 'APPROVAL_REQUIRED' }, isError: true }),
      async (name, args) => { calls.push({ name, args }); return { content: [{ type: 'text', text: 'challenge' }], structuredContent: { challenge_id: 'approval-1', target_tool: 'payment_refund', arguments: args.arguments as Record<string, unknown> }, isError: false }; }
    );
    const result = await caller('payment_refund', { body: { amount: 25 } });
    assert.equal(result.isError, false);
    assert.equal(calls[0]?.name, 'foundry_approval_prepare');
    assert.deepEqual(calls[0]?.args, { target_tool: 'payment_refund', arguments: { body: { amount: 25 } } });
  });
});
