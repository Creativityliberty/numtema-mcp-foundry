import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createApprovalController } from '../src/apps/approval-tools.js';
import type { ContractBundle } from '../src/contracts/types.js';
import type { ProviderAdapterBundle } from '../src/adapters/types.js';
import { compileProviderAdapters } from '../src/adapters/provider-adapter-compiler.js';
import type { McpRequestContext } from '../src/mcp/types.js';

async function fixture() {
  const contracts = JSON.parse(await readFile('examples/contract-bundle.generated.json', 'utf8')) as ContractBundle;
  const adapters = compileProviderAdapters(contracts) as ProviderAdapterBundle;
  const pair = generateKeyPairSync('ed25519');
  const directory = await mkdtemp(join(tmpdir(), 'foundry-approval-store-'));
  const controller = createApprovalController({ contracts, adapters, directory,
    signer: { keyId: 'approval-key-1', privateKeyPem: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() },
    now: () => '2026-07-22T18:00:00.000Z' });
  const context: McpRequestContext = { auth: { subject_ref: 'user-1', client_ref: 'client-1', workspace_ref: 'workspace-1', scopes: ['mcp:tools'] } };
  return { directory, controller, context, contracts, adapters };
}

describe('Apps approval flow', () => {
  it('prepares and confirms a challenge, then mints one exact runtime approval proof', async () => {
    const f = await fixture();
    try {
      const target = f.contracts.tools.find((tool) => tool.approval_ref !== undefined);
      assert.ok(target);
      const args = { body: { value: 25 } };
      const prepared = await f.controller.callTool('foundry_approval_prepare', { target_tool: target.name, arguments: args }, f.context);
      assert.equal(prepared.isError, false);
      const challenge = prepared.structuredContent as { challenge_id: string };
      const confirmed = await f.controller.callTool('foundry_approval_confirm', { challenge_id: challenge.challenge_id, decision: 'approve' }, f.context);
      assert.equal(confirmed.isError, false);
      const adapter = f.adapters.adapters.find((entry) => entry.tool_name === target.name);
      assert.ok(adapter);
      const approval = await f.controller.resolveApproval({
        tool: target, adapter, argumentsHash: 'arguments-hash', contextHash: 'context-hash',
        tenant: { subject_ref: 'user-1', client_ref: 'client-1', workspace_ref: 'workspace-1' },
        riskSummaryHash: 'risk-hash', costSummaryHash: null, at: '2026-07-22T18:00:10.000Z', args
      });
      assert.ok(approval);
      const approvalContract = f.contracts.approvals.find((entry) => entry.id === target.approval_ref);
      assert.ok(approvalContract);
      assert.equal(approval.mode, approvalContract.mode);
      assert.equal(approval.binding.arguments_hash, 'arguments-hash');
      assert.equal(approval.binding.context_hash, 'context-hash');
      assert.equal(approval.binding.subject_ref, 'user-1');
      const second = await f.controller.resolveApproval({
        tool: target, adapter, argumentsHash: 'arguments-hash', contextHash: 'context-hash',
        tenant: { subject_ref: 'user-1', client_ref: 'client-1', workspace_ref: 'workspace-1' },
        riskSummaryHash: 'risk-hash', costSummaryHash: null, at: '2026-07-22T18:00:11.000Z', args
      });
      assert.equal(second, undefined);
    } finally { await rm(f.directory, { recursive: true, force: true }); }
  });

  it('rejects cross-user confirmation and altered arguments', async () => {
    const f = await fixture();
    try {
      const target = f.contracts.tools.find((tool) => tool.approval_ref !== undefined);
      assert.ok(target);
      const prepared = await f.controller.callTool('foundry_approval_prepare', { target_tool: target.name, arguments: { id: 'original' } }, f.context);
      const challenge = prepared.structuredContent as { challenge_id: string };
      const other: McpRequestContext = { auth: { subject_ref: 'user-2', client_ref: 'client-1', workspace_ref: 'workspace-1', scopes: ['mcp:tools'] } };
      const crossUser = await f.controller.callTool('foundry_approval_confirm', { challenge_id: challenge.challenge_id, decision: 'approve' }, other);
      assert.equal(crossUser.isError, true);
      await f.controller.callTool('foundry_approval_confirm', { challenge_id: challenge.challenge_id, decision: 'approve' }, f.context);
      const adapter = f.adapters.adapters.find((entry) => entry.tool_name === target.name);
      assert.ok(adapter);
      const altered = await f.controller.resolveApproval({
        tool: target, adapter, argumentsHash: 'other-hash', contextHash: 'context-hash',
        tenant: { subject_ref: 'user-1', client_ref: 'client-1', workspace_ref: 'workspace-1' },
        riskSummaryHash: 'risk-hash', costSummaryHash: null, at: '2026-07-22T18:00:10.000Z', args: { id: 'altered' }
      });
      assert.equal(altered, undefined);
    } finally { await rm(f.directory, { recursive: true, force: true }); }
  });
});
