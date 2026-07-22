import { createInterface } from 'node:readline';
import type { McpRouter } from './jsonrpc-router.js';

export async function handleStdioLine(router: McpRouter, line: string): Promise<string | null> {
  let message: unknown;
  try {
    message = JSON.parse(line) as unknown;
  } catch {
    return JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
  }
  const response = await router.handle(message);
  return response === null ? null : JSON.stringify(response);
}

export async function startStdioServer(router: McpRouter): Promise<void> {
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of lines) {
    if (line.trim().length === 0) continue;
    const output = await handleStdioLine(router, line);
    if (output !== null) process.stdout.write(`${output}\n`);
  }
}
