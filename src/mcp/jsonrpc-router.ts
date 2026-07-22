import type { McpCallToolResult, McpToolRegistry, JsonRpcRequest, JsonRpcResponse, McpRequestContext, McpResourceRegistry } from './types.js';

export interface McpRouterOptions {
  registry: McpToolRegistry;
  serverName: string;
  serverVersion: string;
  protocolVersion?: string;
  resources?: McpResourceRegistry;
  callTool(name: string, args: Record<string, unknown>, meta?: Record<string, unknown>, context?: McpRequestContext): Promise<McpCallToolResult>;
}

export interface McpRouter {
  handle(message: unknown, context?: McpRequestContext): Promise<JsonRpcResponse | null>;
}

export function createMcpRouter(options: McpRouterOptions): McpRouter {
  const protocolVersion = options.protocolVersion ?? '2025-11-25';
  return {
    async handle(message: unknown, context?: McpRequestContext): Promise<JsonRpcResponse | null> {
      if (!isRequest(message)) return failure(null, -32600, 'Invalid Request');
      const notification = message.id === undefined;
      if (message.method === 'notifications/initialized') return null;
      if (notification) return null;
      const id = message.id ?? null;
      try {
        if (message.method === 'initialize') {
          return success(id, {
            protocolVersion,
            capabilities: { tools: { listChanged: false }, ...(options.resources === undefined ? {} : { resources: { listChanged: false, subscribe: false } }) },
            serverInfo: { name: options.serverName, version: options.serverVersion },
            instructions: 'Nümtema MCP Foundry exposes governed provider tools. High-risk calls require exact approval artifacts.'
          });
        }
        if (message.method === 'ping') return success(id, {});
        if (message.method === 'tools/list') {
          const params = asRecord(message.params);
          const cursor = typeof params.cursor === 'string' ? params.cursor : undefined;
          return success(id, options.registry.list(cursor));
        }
        if (message.method === 'resources/list') {
          if (options.resources === undefined) return failure(id, -32601, 'Resources are not supported.');
          const params = asRecord(message.params);
          const cursor = typeof params.cursor === 'string' ? params.cursor : undefined;
          return success(id, options.resources.list(cursor));
        }
        if (message.method === 'resources/read') {
          if (options.resources === undefined) return failure(id, -32601, 'Resources are not supported.');
          const params = asRecord(message.params);
          const uri = params.uri;
          if (typeof uri !== 'string' || uri.length === 0) return failure(id, -32602, 'Invalid params: resource URI is required.');
          const result = options.resources.read(uri);
          if (result === undefined) return failure(id, -32602, `Unknown resource: ${uri}.`);
          return success(id, result);
        }
        if (message.method === 'tools/call') {
          const params = asRecord(message.params);
          const name = params.name;
          if (typeof name !== 'string' || name.length === 0) return failure(id, -32602, 'Invalid params: tool name is required.');
          if (options.registry.get(name) === undefined) return failure(id, -32602, `Unknown tool: ${name}.`);
          const args = params.arguments === undefined ? {} : asRecord(params.arguments);
          const meta = isRecord(params._meta) ? params._meta : undefined;
          return success(id, await options.callTool(name, args, meta, context));
        }
        return failure(id, -32601, `Method not found: ${message.method}.`);
      } catch (error) {
        const text = error instanceof Error ? error.message : String(error);
        if (text === 'INVALID_CURSOR') return failure(id, -32602, 'Invalid pagination cursor.');
        return failure(id, -32603, 'Internal error', { code: 'FOUNDRY_MCP_INTERNAL', message: text });
      }
    }
  };
}

function isRequest(value: unknown): value is JsonRpcRequest {
  return isRecord(value) && value.jsonrpc === '2.0' && typeof value.method === 'string';
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value === undefined) return {};
  if (!isRecord(value)) throw new Error('Parameters must be a JSON object.');
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function success(id: string | number | null, result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result };
}

function failure(id: string | number | null, code: number, message: string, data?: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: data === undefined ? { code, message } : { code, message, data } };
}
