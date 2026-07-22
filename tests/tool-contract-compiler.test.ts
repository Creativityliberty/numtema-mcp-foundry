import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadCapabilityMap, CapabilityMapLoadError } from '../src/compiler/capability-map-loader.js';
import { compileCapabilityMap } from '../src/compiler/tool-contract-compiler.js';
import { loadOpenApiDocument } from '../src/inspection/openapi-loader.js';
import { inspectOpenApi } from '../src/inspection/source-inspector.js';
import { mapCapabilities } from '../src/mapping/capability-mapper.js';
import { validateBundle } from '../src/validation/validate-bundle.js';

async function referenceMap() {
  const document = await loadOpenApiDocument('tests/fixtures/openapi-reference.json');
  return mapCapabilities(inspectOpenApi(document, 'tests/fixtures/openapi-reference.json'));
}

describe('Capability map loader', () => {
  it('loads a capability map JSON artifact', async () => {
    const artifact = await loadCapabilityMap('examples/capability-map.generated.json');
    assert.equal(artifact.artifact_type, 'capability_map');
    assert.equal(artifact.artifact_version, '0.3');
    assert.equal(artifact.capabilities.length, 8);
  });

  it('loads a controlled-YAML capability map artifact', async () => {
    const artifact = await loadCapabilityMap('tests/fixtures/minimal-capability-map.yaml');
    assert.equal(artifact.capabilities[0]?.name, 'health_get');
    assert.equal(artifact.summary.risk_counts.R0, 1);
  });

  it('rejects malformed capability maps against the artifact schema', async () => {
    await assert.rejects(
      () => loadCapabilityMap('tests/fixtures/invalid-capability-map.json'),
      (error: unknown) => error instanceof CapabilityMapLoadError && error.code === 'INVALID_CAPABILITY_MAP_SCHEMA'
    );
  });

  it('rejects unsupported artifacts with a stable code', async () => {
    await assert.rejects(
      () => loadCapabilityMap('examples/source-inspection.generated.json'),
      (error: unknown) => error instanceof CapabilityMapLoadError && error.code === 'INVALID_CAPABILITY_MAP'
    );
  });
});

describe('Tool Contract Compiler', () => {
  it('compiles one governed ToolContract per capability and validates the bundle', async () => {
    const result = compileCapabilityMap(await referenceMap());
    const report = await validateBundle(result.bundle);

    assert.equal(result.bundle.tools.length, 8);
    assert.equal(result.bundle.policies.length, 8);
    assert.equal(report.valid, true, JSON.stringify(report.issues, null, 2));
    assert.ok(result.bundle.tools.every((tool) => tool.revision?.match(/^[a-f0-9]{64}$/)));
    assert.ok(result.bundle.tools.every((tool) => tool.policy_ref));
  });

  it('generates exact auth, approval, and policy references for high-risk tools', async () => {
    const result = compileCapabilityMap(await referenceMap());
    const tools = new Map(result.bundle.tools.map((tool) => [tool.name, tool]));
    const approvals = new Map(result.bundle.approvals.map((approval) => [approval.id, approval]));
    const policies = new Map(result.bundle.policies.map((policy) => [policy.id, policy]));

    const refund = tools.get('payment_refund');
    assert.equal(refund?.effects.financial, true);
    assert.equal(policies.get(refund?.policy_ref ?? '')?.risk_class, 'R4');
    assert.equal(approvals.get(refund?.approval_ref ?? '')?.mode, 'secure_widget');
    assert.ok(approvals.get(refund?.approval_ref ?? '')?.binding.includes('cost_summary'));

    const deleteKey = tools.get('api_key_delete');
    assert.equal(deleteKey?.effects.credential_change, true);
    assert.equal(policies.get(deleteKey?.policy_ref ?? '')?.risk_class, 'R5');
    assert.equal(approvals.get(deleteKey?.approval_ref ?? '')?.mode, 'dual_control');

    assert.equal(result.bundle.auth.length, 1);
    assert.equal(result.bundle.auth[0]?.mode, 'host_managed');
    assert.equal(result.bundle.auth[0]?.token_passthrough, false);
    assert.ok(result.bundle.auth[0]?.required_scopes.includes('customers:read'));
  });

  it('compiles workflow hints into bounded RecoveryContracts', async () => {
    const result = compileCapabilityMap(await referenceMap());
    const renderCreate = result.bundle.tools.find((tool) => tool.name === 'render_create');
    const recovery = result.bundle.recoveries.find((candidate) => candidate.id === renderCreate?.recovery_ref);

    assert.ok(recovery);
    assert.equal(recovery?.routes[0]?.trigger, 'job_queued');
    assert.equal(recovery?.routes[0]?.next_capability, 'tool:render_status_get');
    assert.equal(recovery?.routes[0]?.allow_risk_increase, false);
    assert.equal(recovery?.routes[0]?.allow_scope_increase, false);
    assert.equal(recovery?.routes[0]?.allow_cost_increase, false);
  });

  it('omits authentication when no capability requires scopes', async () => {
    const map = await referenceMap();
    const unscoped = {
      ...map,
      capabilities: map.capabilities.map((capability) => ({ ...capability, required_scopes: [] }))
    };
    const result = compileCapabilityMap(unscoped);
    const report = await validateBundle(result.bundle);
    assert.equal(result.bundle.auth.length, 0);
    assert.ok(result.bundle.tools.every((tool) => tool.auth_ref === undefined));
    assert.equal(report.valid, true, JSON.stringify(report.issues, null, 2));
  });

  it('is deterministic for identical inputs and options', async () => {
    const map = await referenceMap();
    const first = compileCapabilityMap(map);
    const second = compileCapabilityMap(map);
    assert.deepEqual(first, second);
  });
});
