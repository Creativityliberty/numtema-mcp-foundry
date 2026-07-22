import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { URL } from 'node:url';
import type { ChatGptAppConfig } from './app-config.js';

export async function loadChatGptAppConfig(path: string): Promise<{ config: ChatGptAppConfig; root: string }> {
  const absolute = resolve(path);
  const root = dirname(absolute);
  const value = JSON.parse(await readFile(absolute, 'utf8')) as unknown;
  if (!isRecord(value) || value.artifact_type !== 'chatgpt_app_config' || value.artifact_version !== '1.1') {
    throw new Error('INVALID_CHATGPT_APP_CONFIG: expected chatgpt_app_config v1.1.');
  }
  for (const key of ['server', 'oauth', 'approvals']) if (!isRecord(value[key])) throw new Error(`INVALID_CHATGPT_APP_CONFIG: ${key} must be an object.`);
  const config = value as unknown as ChatGptAppConfig;
  const base = new URL(config.public_base_url);
  const localhost = base.hostname === 'localhost' || base.hostname === '127.0.0.1' || base.hostname === '[::1]';
  if (base.protocol !== 'https:' && !(base.protocol === 'http:' && localhost)) throw new Error('CHATGPT_APP_HTTPS_REQUIRED: public_base_url must use HTTPS outside localhost.');
  if (!config.server.mcp_path.startsWith('/')) throw new Error('INVALID_CHATGPT_APP_CONFIG: server.mcp_path must start with /.');
  if (config.oauth.baseline_scopes.some((scope) => !config.oauth.scopes_supported.includes(scope))) throw new Error('INVALID_CHATGPT_APP_CONFIG: baseline scope is unsupported.');
  return { config, root };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
