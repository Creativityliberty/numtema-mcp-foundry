import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ContractBundle } from '../src/contracts/types.js';
import type { ProviderAdapterBundle } from '../src/adapters/types.js';
import { createMcpToolRegistry } from '../src/mcp/tool-registry.js';
import { createMcpRouter } from '../src/mcp/jsonrpc-router.js';

const bundle: ContractBundle = {
  bundle_version: '0.2',
  tools: [
    {
      id: 'tool:zeta', name: 'zeta', version: '1.0.0', revision: 'rev-z', description: 'Zeta tool',
      input_schema: { type: 'object', properties: {}, additionalProperties: false },
      output_schema: { type: 'object' },
      annotations: { read_only: false, destructive: true, idempotent: false, open_world: true },
      effects: { writes: true, external_communication: true, financial: false, credential_change: false, personal_data: false },
      execution: { mode: 'synchronous', task_support: 'forbidden', idempotency: 'unsupported' },
      required_scopes: [], policy_ref: 'policy:zeta', approval_ref: 'approval:zeta',
      extensions: { foundry: { risk_class: 'R3' } }
    },
    {
      id: 'tool:alpha', name: 'alpha', version: '1.0.0', revision: 'rev-a', title: 'Alpha', description: 'Alpha tool',
      input_schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false },
      output_schema: { type: 'object' },
      annotations: { read_only: true, destructive: false, idempotent: true, open_world: false },
      effects: { writes: false, external_communication: false, financial: false, credential_change: false, personal_data: true },
      execution: { mode: 'synchronous', task_support: 'forbidden', idempotency: 'not_applicable' },
      required_scopes: ['alpha:read'], policy_ref: 'policy:alpha',
      extensions: { foundry: { risk_class: 'R1' } }
    }
  ],
  auth: [], policies: [], approvals: [], recoveries: [], receipts: [], artifacts: []
};
const adapters: ProviderAdapterBundle = {
  artifact_type: 'provider_adapter_bundle', artifact_version: '0.6', source_bundle_version: '0.2',
  adapters: [], summary: { adapter_count: 0, authenticated_count: 0, idempotency_required_count: 0, body_binding_count: 0, binary_binding_count: 0, skipped_tool_count: 0 }, warnings: [],
  integrity: { algorithm: 'sha256', digest: 'x' }
};

describe('MCP JSON-RPC router', () => {
  it('initializes with deterministic tool capability metadata', async () => {
    const registry = createMcpToolRegistry(bundle, adapters);
    const router = createMcpRouter({ registry, serverName: 'numtema-test', serverVersion: '1.0.0', callTool: async () => ({ content: [], isError: false }) });
    const response = await router.handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'test', version: '1' } } });
    assert.equal(response?.jsonrpc, '2.0');
    assert.equal(response?.id, 1);
    const result = response && 'result' in response ? response.result as Record<string, unknown> : {};
    assert.equal(result.protocolVersion, '2025-11-25');
    assert.deepEqual(result.capabilities, { tools: { listChanged: false } });
  });

  it('lists tools in deterministic name order with MCP annotations', async () => {
    const registry = createMcpToolRegistry(bundle, adapters);
    const router = createMcpRouter({ registry, serverName: 'numtema-test', serverVersion: '1.0.0', callTool: async () => ({ content: [], isError: false }) });
    const response = await router.handle({ jsonrpc: '2.0', id: 'list', method: 'tools/list', params: {} });
    const result = response && 'result' in response ? response.result as { tools: Array<Record<string, unknown>> } : { tools: [] };
    assert.deepEqual(result.tools.map((tool) => tool.name), ['alpha', 'zeta']);
    assert.deepEqual(result.tools[0]?.annotations, { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false });
    assert.equal((result.tools[0]?._meta as Record<string, unknown>).riskClass, 'R1');
  });

  it('routes tool calls and reports exceptional protocol errors separately', async () => {
    const registry = createMcpToolRegistry(bundle, adapters);
    const router = createMcpRouter({
      registry, serverName: 'numtema-test', serverVersion: '1.0.0',
      callTool: async (name, args) => ({ content: [{ type: 'text', text: `${name}:${String(args.id)}` }], structuredContent: { ok: true }, isError: false })
    });
    const called = await router.handle({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'alpha', arguments: { id: '42' } } });
    assert.equal(called && 'result' in called ? (called.result as { isError: boolean }).isError : true, false);
    const unknownTool = await router.handle({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'missing', arguments: {} } });
    assert.equal(unknownTool && 'error' in unknownTool ? unknownTool.error.code : 0, -32602);
    const unknownMethod = await router.handle({ jsonrpc: '2.0', id: 4, method: 'resources/list', params: {} });
    assert.equal(unknownMethod && 'error' in unknownMethod ? unknownMethod.error.code : 0, -32601);
  });

  it('does not respond to initialized notifications', async () => {
    const registry = createMcpToolRegistry(bundle, adapters);
    const router = createMcpRouter({ registry, serverName: 'numtema-test', serverVersion: '1.0.0', callTool: async () => ({ content: [], isError: false }) });
    assert.equal(await router.handle({ jsonrpc: '2.0', method: 'notifications/initialized' }), null);
  });
});
