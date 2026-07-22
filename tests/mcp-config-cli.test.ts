import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { loadMcpAssembly } from '../src/mcp/config-loader.js';
import { runCli, type CliIo } from '../src/cli/foundry.js';

const cleanup: string[] = [];
afterEach(async () => { await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true }))); });

describe('MCP runtime config and CLI', () => {
  it('loads a portable runtime config and exposes deterministic tool metadata', async () => {
    const fixture = await createConfigFixture();
    const assembly = await loadMcpAssembly(fixture.configPath, { CUSTOMER_API_TOKEN: 'secret' });
    assert.equal(assembly.summary.tool_count, 4);
    assert.equal(assembly.summary.transport, 'stdio');
    const listed = await assembly.router.handle({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} });
    assert.equal(listed && 'result' in listed ? (listed.result as { tools: unknown[] }).tools.length : 0, 4);
  });

  it('supports foundry mcp inspect and smoke without provider execution', async () => {
    const fixture = await createConfigFixture();
    const output: string[] = [];
    const errors: string[] = [];
    const io: CliIo = { out: (value) => output.push(value), error: (value) => errors.push(value) };
    const previous = process.env.CUSTOMER_API_TOKEN;
    process.env.CUSTOMER_API_TOKEN = 'secret';
    try {
      assert.equal(await runCli(['mcp', 'inspect', '--config', fixture.configPath], io), 0);
      assert.match(output.join('\n'), /MCP_RUNTIME_READY/);
      output.length = 0;
      assert.equal(await runCli(['mcp', 'smoke', '--config', fixture.configPath], io), 0);
      assert.match(output.join('\n'), /tools listed: 4/);
      assert.equal(errors.length, 0);
    } finally {
      if (previous === undefined) delete process.env.CUSTOMER_API_TOKEN;
      else process.env.CUSTOMER_API_TOKEN = previous;
    }
  });
});

async function createConfigFixture(): Promise<{ configPath: string }> {
  const directory = await mkdtemp(join(tmpdir(), 'foundry-mcp-config-'));
  cleanup.push(directory);
  const policy = keyPair();
  const dispatch = keyPair();
  const execution = keyPair();
  await writeFile(join(directory, 'policy.pem'), policy.privateKey, 'utf8');
  await writeFile(join(directory, 'dispatch.pem'), dispatch.privateKey, 'utf8');
  await writeFile(join(directory, 'execution.pem'), execution.privateKey, 'utf8');
  await writeFile(join(directory, 'trust-store.json'), JSON.stringify({
    artifact_type: 'runtime_trust_store', artifact_version: '0.8', keys: [
      { key_id: 'policy-key', algorithm: 'ed25519', purpose: 'policy', status: 'active', public_key_pem: policy.publicKey },
      { key_id: 'dispatch-key', algorithm: 'ed25519', purpose: 'dispatch', status: 'active', public_key_pem: dispatch.publicKey },
      { key_id: 'execution-key', algorithm: 'ed25519', purpose: 'execution', status: 'active', public_key_pem: execution.publicKey }
    ]
  }, null, 2), 'utf8');
  const config = {
    artifact_type: 'mcp_runtime_config', artifact_version: '1.0',
    server: { name: 'fixture-server', version: '1.0.0', protocol_version: '2025-11-25', transport: { type: 'stdio' } },
    provider: { base_url: 'https://api.example.test', timeout_ms: 1000 },
    artifacts: {
      contract_bundle: resolve('examples/contract-bundle.auth.generated.json'),
      provider_adapter_bundle: resolve('examples/provider-adapters.auth.generated.json'),
      provider_auth_binding_bundle: resolve('examples/provider-auth-bindings.generated.json'),
      credential_catalog: resolve('examples/credential-catalog.example.json'),
      runtime_trust_store: './trust-store.json',
      ledger_directory: './ledger'
    },
    context: { subject_ref: 'user-001', client_ref: 'chatgpt-client', workspace_ref: 'workspace-001', provider_ref: 'customer-api', provider_account_ref: 'account-customer-001' },
    credentials: { environment_by_handle: { 'credential-handle-customer-001': 'CUSTOMER_API_TOKEN' } },
    signing: {
      policy: { key_id: 'policy-key', private_key_file: './policy.pem' },
      dispatch: { key_id: 'dispatch-key', private_key_file: './dispatch.pem' },
      execution: { key_id: 'execution-key', private_key_file: './execution.pem' }
    }
  };
  const configPath = join(directory, 'runtime-config.json');
  await writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
  return { configPath };
}

function keyPair(): { publicKey: string; privateKey: string } {
  const pair = generateKeyPairSync('ed25519');
  return { publicKey: String(pair.publicKey.export({ type: 'spki', format: 'pem' })), privateKey: String(pair.privateKey.export({ type: 'pkcs8', format: 'pem' })) };
}
