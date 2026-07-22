import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createAppResourceRegistry } from '../src/apps/resource-registry.js';
import { createMcpRouter } from '../src/mcp/jsonrpc-router.js';
import { createMcpToolRegistry } from '../src/mcp/tool-registry.js';
import { createApprovalToolRegistrations } from '../src/apps/approval-tools.js';
import type { ContractBundle } from '../src/contracts/types.js';
import type { ProviderAdapterBundle } from '../src/adapters/types.js';
import { compileProviderAdapters } from '../src/adapters/provider-adapter-compiler.js';

async function fixtures() {
  const contracts = JSON.parse(await readFile('examples/contract-bundle.generated.json', 'utf8')) as ContractBundle;
  const adapters = compileProviderAdapters(contracts) as ProviderAdapterBundle;
  return { contracts, adapters };
}

describe('Apps SDK resources', () => {
  it('advertises widget resources and decorates high-risk tools with UI metadata', async () => {
    const { contracts, adapters } = await fixtures();
    const registry = createMcpToolRegistry(contracts, adapters, 100, createApprovalToolRegistrations());
    const resources = createAppResourceRegistry();
    const listed = registry.list().tools;
    assert.ok(listed.some((tool) => tool.name === 'foundry_approval_prepare'));
    assert.ok(listed.some((tool) => tool.name === 'foundry_approval_confirm'));
    const highRisk = listed.find((tool) => tool._meta.riskClass === 'R3' || tool._meta.riskClass === 'R4' || tool._meta.riskClass === 'R5');
    assert.ok(highRisk);
    assert.equal(highRisk._meta['ui.resourceUri'], 'ui://numtema/approval.html');
    assert.equal(highRisk._meta['openai/outputTemplate'], 'ui://numtema/approval.html');

    const router = createMcpRouter({ registry, resources, serverName: 'test-app', serverVersion: '1.1.0',
      callTool: async () => ({ content: [{ type: 'text', text: 'ok' }] }) });
    const resourceList = await router.handle({ jsonrpc: '2.0', id: 1, method: 'resources/list', params: {} });
    assert.ok(resourceList && 'result' in resourceList);
    const resourceResult = resourceList && 'result' in resourceList ? resourceList.result as { resources: Array<{ uri: string }> } : { resources: [] };
    assert.ok(resourceResult.resources.some((resource) => resource.uri === 'ui://numtema/approval.html'));
    const read = await router.handle({ jsonrpc: '2.0', id: 2, method: 'resources/read', params: { uri: 'ui://numtema/approval.html' } });
    assert.ok(read && 'result' in read);
    const contents = read && 'result' in read ? (read.result as { contents: Array<{ text: string; mimeType: string }> }).contents : [];
    assert.equal(contents[0]?.mimeType, 'text/html;profile=mcp-app');
    assert.match(contents[0]?.text ?? '', /window\.openai/);
    assert.match(contents[0]?.text ?? '', /foundry_approval_confirm/);
  });

  it('returns a protocol error for an unknown resource', async () => {
    const { contracts, adapters } = await fixtures();
    const router = createMcpRouter({ registry: createMcpToolRegistry(contracts, adapters), resources: createAppResourceRegistry(),
      serverName: 'test-app', serverVersion: '1.1.0', callTool: async () => ({ content: [{ type: 'text', text: 'ok' }] }) });
    const result = await router.handle({ jsonrpc: '2.0', id: 3, method: 'resources/read', params: { uri: 'ui://missing' } });
    assert.ok(result && 'error' in result);
    if (result && 'error' in result) assert.equal(result.error.code, -32602);
  });
});
