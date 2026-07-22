import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createServer as createRawServer } from 'node:http';
import { createMcpRouter } from '../src/mcp/jsonrpc-router.js';
import type { McpToolRegistry } from '../src/mcp/types.js';
import { handleStdioLine } from '../src/mcp/stdio-server.js';
import { createMcpHttpServer } from '../src/mcp/http-server.js';

const registry: McpToolRegistry = {
  list: () => ({ tools: [] }),
  get: () => undefined
};
const router = createMcpRouter({ registry, serverName: 'transport-test', serverVersion: '1.0.0', callTool: async () => ({ content: [], isError: false }) });

describe('MCP transports', () => {
  it('handles newline-delimited stdio JSON without writing for notifications', async () => {
    const initialize = await handleStdioLine(router, JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }));
    assert.equal(JSON.parse(initialize ?? '{}').result.serverInfo.name, 'transport-test');
    const notification = await handleStdioLine(router, JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }));
    assert.equal(notification, null);
    const malformed = await handleStdioLine(router, '{broken');
    assert.equal(JSON.parse(malformed ?? '{}').error.code, -32700);
  });

  it('serves stateless MCP POST requests with protocol headers', async () => {
    const server = createMcpHttpServer(router, {
      path: '/mcp', allowedOrigins: ['https://chatgpt.com'], bearerToken: 'server-token', requireMcpHeaders: true
    });
    const address = await listen(server);
    const response = await fetch(`${address}/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'accept': 'application/json, text/event-stream',
        'origin': 'https://chatgpt.com',
        'authorization': 'Bearer server-token',
        'mcp-protocol-version': '2025-11-25',
        'mcp-method': 'tools/list'
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 7, method: 'tools/list', params: {} })
    });
    assert.equal(response.status, 200);
    const payload = JSON.parse(await response.text());
    assert.deepEqual(payload.result.tools, []);
    await close(server);
  });

  it('rejects invalid origins, credentials, Accept headers, and mirrored MCP headers', async () => {
    const server = createMcpHttpServer(router, {
      path: '/mcp', allowedOrigins: ['https://chatgpt.com'], bearerToken: 'server-token', requireMcpHeaders: true
    });
    const address = await listen(server);
    const baseHeaders = {
      'content-type': 'application/json',
      'accept': 'application/json, text/event-stream',
      'origin': 'https://chatgpt.com',
      'authorization': 'Bearer server-token',
      'mcp-method': 'ping'
    };
    const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' });
    assert.equal((await fetch(`${address}/mcp`, { method: 'POST', headers: { ...baseHeaders, origin: 'https://evil.test' }, body })).status, 403);
    assert.equal((await fetch(`${address}/mcp`, { method: 'POST', headers: { ...baseHeaders, authorization: 'Bearer wrong' }, body })).status, 401);
    assert.equal((await fetch(`${address}/mcp`, { method: 'POST', headers: { ...baseHeaders, accept: 'application/json' }, body })).status, 406);
    assert.equal((await fetch(`${address}/mcp`, { method: 'POST', headers: { ...baseHeaders, 'mcp-method': 'tools/list' }, body })).status, 400);
    await close(server);
  });
});

async function listen(server: ReturnType<typeof createRawServer>): Promise<string> {
  await new Promise<void>((resolvePromise) => server.listen(0, '127.0.0.1', resolvePromise));
  const address = server.address();
  if (typeof address !== 'object' || address === null) throw new Error('Server did not listen.');
  return `http://127.0.0.1:${address.port}`;
}

async function close(server: ReturnType<typeof createRawServer>): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => server.close((error) => error ? reject(error) : resolvePromise()));
}
