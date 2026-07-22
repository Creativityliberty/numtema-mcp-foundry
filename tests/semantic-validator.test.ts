import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ContractBundle } from '../src/contracts/types.js';
import { loadContractBundle } from '../src/contracts/contract-bundle.js';
import { validateSemantics } from '../src/validation/semantic-validator.js';

async function validBundle(): Promise<ContractBundle> {
  return loadContractBundle('tests/fixtures/valid-bundle.yaml');
}

function codes(bundle: ContractBundle): string[] {
  return validateSemantics(bundle).map((issue) => issue.code);
}

describe('constitutional semantic validation', () => {
  it('accepts the valid reference bundle', async () => {
    assert.deepEqual(validateSemantics(await validBundle()), []);
  });

  it('rejects contradictory effects, missing idempotency, and invalid task mode', async () => {
    const bundle = await validBundle();
    const tool = bundle.tools[0]!;
    tool.effects.writes = true;
    tool.annotations.destructive = true;
    tool.execution.idempotency = 'unsupported';
    tool.execution.task_support = 'required';
    tool.execution.mode = 'synchronous';

    const result = codes(bundle);
    assert.ok(result.includes('TOOL_READ_ONLY_EFFECT_CONFLICT'));
    assert.ok(result.includes('TOOL_WRITE_IDEMPOTENCY_REQUIRED'));
    assert.ok(result.includes('TOOL_TASK_MODE_CONFLICT'));
    assert.ok(result.includes('TOOL_APPROVAL_REQUIRED'));
  });

  it('requires governed high-risk and financial capabilities', async () => {
    const bundle = await validBundle();
    const tool = bundle.tools[0]!;
    const policy = bundle.policies[0]!;
    tool.annotations.read_only = false;
    tool.effects.financial = true;
    tool.effects.writes = true;
    tool.execution.idempotency = 'required';
    delete tool.approval_ref;
    policy.risk_class = 'R3';
    policy.default_decision = 'allow';

    const result = codes(bundle);
    assert.ok(result.includes('POLICY_HIGH_RISK_ALLOW'));
    assert.ok(result.includes('TOOL_FINANCIAL_RISK_TOO_LOW'));
    assert.ok(result.includes('TOOL_APPROVAL_REQUIRED'));
  });

  it('detects missing references and auth scope gaps', async () => {
    const bundle = await validBundle();
    const tool = bundle.tools[0]!;
    tool.policy_ref = 'policy://missing';
    tool.approval_ref = 'approval://missing';
    tool.required_scopes.push('supplier:write');

    const result = codes(bundle);
    assert.ok(result.includes('REFERENCE_NOT_FOUND'));
    assert.ok(result.includes('TOOL_SCOPE_NOT_AUTHORIZED'));
  });

  it('enforces OAuth and tenant credential binding', async () => {
    const bundle = await validBundle();
    const auth = bundle.auth[0]!;
    auth.audience_validation = false;
    auth.pkce_required = false;
    auth.credential_binding_dimensions = ['provider'];

    const result = codes(bundle);
    assert.ok(result.includes('AUTH_OAUTH_AUDIENCE_REQUIRED'));
    assert.ok(result.includes('AUTH_OAUTH_PKCE_REQUIRED'));
    assert.ok(result.includes('AUTH_TENANT_BINDING_REQUIRED'));
  });

  it('enforces approval bindings, receipt integrity, and tool revision consistency', async () => {
    const bundle = await validBundle();
    bundle.approvals.push({
      id: 'approval://procuflow/high-impact@1',
      version: '0.2.0',
      mode: 'chat_explicit',
      binding: ['subject'],
      ttl_seconds: 300,
      single_use: true
    });
    const receipt = bundle.receipts[0]!;
    receipt.arguments_hash = 'bad';
    receipt.started_at = '2026-07-22T10:00:02Z';
    receipt.completed_at = '2026-07-22T10:00:01Z';
    receipt.tool_revision = 'stale-revision';

    const result = codes(bundle);
    assert.ok(result.includes('APPROVAL_BINDING_REQUIRED'));
    assert.ok(result.includes('RECEIPT_HASH_INVALID'));
    assert.ok(result.includes('RECEIPT_TIME_ORDER_INVALID'));
    assert.ok(result.includes('RECEIPT_TOOL_REVISION_MISMATCH'));
  });

  it('forbids recovery escalation and requires tool revisions', async () => {
    const bundle = await validBundle();
    delete bundle.tools[0]!.revision;
    bundle.recoveries.push({
      id: 'recovery://procuflow/default@1',
      version: '0.2.0',
      routes: [{
        trigger: 'rate_limited',
        next_capability: 'supplier_search',
        human_interaction: false,
        max_attempts: 2,
        allow_risk_increase: true as false,
        allow_scope_increase: false,
        allow_cost_increase: false
      }]
    });

    const result = codes(bundle);
    assert.ok(result.includes('RECOVERY_ESCALATION_FORBIDDEN'));
    assert.ok(result.includes('TOOL_REVISION_REQUIRED'));
  });
});
