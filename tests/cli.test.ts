import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runCli, type CliIo } from '../src/cli/foundry.js';

function captureIo(): { io: CliIo; stdout: string[]; stderr: string[] } {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    io: {
      out: (value) => stdout.push(value),
      error: (value) => stderr.push(value)
    }
  };
}

describe('foundry validate CLI', () => {
  it('returns 0 for a valid bundle', async () => {
    const captured = captureIo();
    const exitCode = await runCli(['validate', 'tests/fixtures/valid-bundle.yaml'], captured.io);
    assert.equal(exitCode, 0);
    assert.match(captured.stdout.join('\n'), /VALID.*0 error/);
    assert.deepEqual(captured.stderr, []);
  });

  it('returns 1 and JSON issues for an invalid bundle', async () => {
    const captured = captureIo();
    const exitCode = await runCli(
      ['validate', 'tests/fixtures/invalid-high-risk.yaml', '--json'],
      captured.io
    );
    assert.equal(exitCode, 1);
    const report = JSON.parse(captured.stdout.join('')) as { valid: boolean; issues: Array<{ code: string }> };
    assert.equal(report.valid, false);
    assert.ok(report.issues.some((issue) => issue.code === 'POLICY_HIGH_RISK_ALLOW'));
  });

  it('returns 2 when the bundle cannot be loaded', async () => {
    const captured = captureIo();
    const exitCode = await runCli(['validate', 'tests/fixtures/missing.yaml'], captured.io);
    assert.equal(exitCode, 2);
    assert.match(captured.stderr.join('\n'), /LOAD_ERROR/);
  });
});

describe('foundry inspect and map CLI', () => {
  it('renders a source inspection artifact as JSON', async () => {
    const captured = captureIo();
    const exitCode = await runCli(['inspect', 'tests/fixtures/openapi-reference.json', '--json'], captured.io);
    assert.equal(exitCode, 0);
    const artifact = JSON.parse(captured.stdout.join('')) as { artifact_type: string; summary: { operation_count: number } };
    assert.equal(artifact.artifact_type, 'source_inspection');
    assert.equal(artifact.summary.operation_count, 8);
  });

  it('renders a capability map as JSON', async () => {
    const captured = captureIo();
    const exitCode = await runCli(['map', 'tests/fixtures/openapi-reference.json', '--json'], captured.io);
    assert.equal(exitCode, 0);
    const artifact = JSON.parse(captured.stdout.join('')) as { artifact_type: string; capabilities: unknown[] };
    assert.equal(artifact.artifact_type, 'capability_map');
    assert.equal(artifact.capabilities.length, 8);
  });
});


describe('foundry compile CLI', () => {
  it('compiles and validates a capability map as JSON', async () => {
    const captured = captureIo();
    const exitCode = await runCli(['compile', 'examples/capability-map.generated.json', '--json'], captured.io);
    assert.equal(exitCode, 0);
    const bundle = JSON.parse(captured.stdout.join('')) as { bundle_version: string; tools: unknown[]; policies: unknown[] };
    assert.equal(bundle.bundle_version, '0.2');
    assert.equal(bundle.tools.length, 8);
    assert.equal(bundle.policies.length, 8);
    assert.deepEqual(captured.stderr, []);
  });

  it('returns 2 for a non-capability artifact', async () => {
    const captured = captureIo();
    const exitCode = await runCli(['compile', 'examples/source-inspection.generated.json'], captured.io);
    assert.equal(exitCode, 2);
    assert.match(captured.stderr.join('\n'), /LOAD_ERROR.*INVALID_CAPABILITY_MAP/);
  });
});

describe('foundry provider adapter CLI', () => {
  it('compiles provider adapters from a ContractBundle', async () => {
    const captured = captureIo();
    const exitCode = await runCli(['adapters', 'examples/contract-bundle.schema-rich.generated.json', '--json'], captured.io);
    assert.equal(exitCode, 0);
    const artifact = JSON.parse(captured.stdout.join('')) as { artifact_type: string; adapters: unknown[] };
    assert.equal(artifact.artifact_type, 'provider_adapter_bundle');
    assert.equal(artifact.adapters.length, 4);
  });

  it('creates a dry-run provider execution plan for one tool', async () => {
    const captured = captureIo();
    const exitCode = await runCli([
      'plan', 'examples/contract-bundle.schema-rich.generated.json',
      '--tool', 'customer_get',
      '--base-url', 'https://api.example.test/v1',
      '--args', 'tests/fixtures/customer-get.arguments.json',
      '--json'
    ], captured.io);
    assert.equal(exitCode, 0);
    const plan = JSON.parse(captured.stdout.join('')) as { artifact_type: string; request: { url: string } };
    assert.equal(plan.artifact_type, 'provider_execution_plan');
    assert.equal(plan.request.url, 'https://api.example.test/v1/customers/customer%207?expand=orders%2Cinvoices');
  });

  it('rejects unknown tools before planning', async () => {
    const captured = captureIo();
    const exitCode = await runCli([
      'plan', 'examples/contract-bundle.schema-rich.generated.json',
      '--tool', 'missing_tool', '--base-url', 'https://api.example.test', '--args', 'tests/fixtures/customer-get.arguments.json'
    ], captured.io);
    assert.equal(exitCode, 2);
    assert.match(captured.stderr.join('\n'), /LOAD_ERROR.*UNKNOWN_TOOL/);
  });
});

describe('foundry credential auth CLI', () => {
  it('compiles provider auth bindings from an authenticated ContractBundle', async () => {
    const captured = captureIo();
    const exitCode = await runCli(['auth-bindings', 'tests/fixtures/auth-contract-bundle.json', '--json'], captured.io);
    assert.equal(exitCode, 0);
    const artifact = JSON.parse(captured.stdout.join('')) as { artifact_type: string; bindings: unknown[] };
    assert.equal(artifact.artifact_type, 'provider_auth_binding_bundle');
    assert.equal(artifact.bindings.length, 1);
    assert.deepEqual(captured.stderr, []);
  });

  it('creates a redacted credential resolution plan for one tool', async () => {
    const captured = captureIo();
    const exitCode = await runCli([
      'auth-plan', 'tests/fixtures/auth-contract-bundle.json',
      '--tool', 'customer_get',
      '--credentials', 'tests/fixtures/credential-catalog.json',
      '--context', 'tests/fixtures/credential-context.json',
      '--json'
    ], captured.io);
    assert.equal(exitCode, 0);
    const artifact = JSON.parse(captured.stdout.join('')) as {
      artifact_type: string;
      ready: boolean;
      injection_envelope: { secret_material_included: boolean };
    };
    assert.equal(artifact.artifact_type, 'credential_resolution_plan');
    assert.equal(artifact.ready, true);
    assert.equal(artifact.injection_envelope.secret_material_included, false);
    assert.equal(captured.stdout.join('').includes('vault://'), false);
  });

  it('returns 1 when credential preflight fails closed', async () => {
    const captured = captureIo();
    const exitCode = await runCli([
      'auth-plan', 'tests/fixtures/auth-contract-bundle.json',
      '--tool', 'customer_get',
      '--credentials', 'tests/fixtures/credential-catalog-missing-scope.json',
      '--context', 'tests/fixtures/credential-context.json',
      '--json'
    ], captured.io);
    assert.equal(exitCode, 1);
    const artifact = JSON.parse(captured.stdout.join('')) as { ready: boolean; errors: Array<{ code: string }> };
    assert.equal(artifact.ready, false);
    assert.ok(artifact.errors.some((error) => error.code === 'INSUFFICIENT_SCOPES'));
  });
});

describe('foundry secure runtime preflight CLI', () => {
  it('returns 0 and an authorized envelope for valid signed proofs', async () => {
    const captured = captureIo();
    const exitCode = await runCli([
      'preflight',
      '--execution-plan', 'tests/fixtures/runtime/provider-execution-plan.json',
      '--credential-plan', 'tests/fixtures/runtime/credential-resolution-plan.json',
      '--policy', 'tests/fixtures/runtime/runtime-policy-decision.json',
      '--approval', 'tests/fixtures/runtime/approval-proof.json',
      '--budget', 'tests/fixtures/runtime/budget-authorization.json',
      '--trust-store', 'tests/fixtures/runtime/runtime-trust-store.json',
      '--at', '2026-07-22T16:01:00Z', '--json'
    ], captured.io);
    assert.equal(exitCode, 0);
    const artifact = JSON.parse(captured.stdout.join('')) as { artifact_type: string; dispatch_permitted: boolean; network_executed: boolean };
    assert.equal(artifact.artifact_type, 'authorized_execution_envelope');
    assert.equal(artifact.dispatch_permitted, true);
    assert.equal(artifact.network_executed, false);
  });

  it('returns 1 when a required approval is omitted', async () => {
    const captured = captureIo();
    const exitCode = await runCli([
      'preflight',
      '--execution-plan', 'tests/fixtures/runtime/provider-execution-plan.json',
      '--credential-plan', 'tests/fixtures/runtime/credential-resolution-plan.json',
      '--policy', 'tests/fixtures/runtime/runtime-policy-decision.json',
      '--budget', 'tests/fixtures/runtime/budget-authorization.json',
      '--trust-store', 'tests/fixtures/runtime/runtime-trust-store.json',
      '--at', '2026-07-22T16:01:00Z', '--json'
    ], captured.io);
    assert.equal(exitCode, 1);
    const artifact = JSON.parse(captured.stdout.join('')) as { dispatch_permitted: boolean; errors: Array<{ code: string }> };
    assert.equal(artifact.dispatch_permitted, false);
    assert.ok(artifact.errors.some((error) => error.code === 'APPROVAL_REQUIRED'));
  });
});
