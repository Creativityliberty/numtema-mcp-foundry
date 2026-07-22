import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { initializeMcpRuntime } from '../mcp/init-runtime.js';
import { hashPassword } from '../oauth/password.js';
import type { ContractBundle } from '../contracts/types.js';
import type { RuntimeTrustStore } from '../runtime/types.js';

export interface ChatGptAppInitReport {
  directory: string;
  config_file: string;
  username: string;
  password: string;
  workspace_ref: string;
  public_base_url: string;
  generated_private_keys: 5;
}

export async function initializeChatGptApp(directory: string, force = false, publicBaseUrl = 'http://127.0.0.1:8788'): Promise<ChatGptAppInitReport> {
  const target = resolve(directory);
  await initializeMcpRuntime(target, force);
  const oauth = keyPair();
  const approval = keyPair();
  await writePrivate(join(target, 'oauth-private.pem'), oauth.privateKey);
  await writeFile(join(target, 'oauth-public.pem'), oauth.publicKey, 'utf8');
  await writePrivate(join(target, 'approval-private.pem'), approval.privateKey);
  await writeFile(join(target, 'approval-public.pem'), approval.publicKey, 'utf8');
  const trustPath = join(target, 'runtime-trust-store.json');
  const trust = JSON.parse(await readFile(trustPath, 'utf8')) as RuntimeTrustStore;
  trust.keys.push({ key_id: 'approval-key', algorithm: 'ed25519', purpose: 'approval', status: 'active', public_key_pem: approval.publicKey });
  await writeFile(trustPath, `${JSON.stringify(trust, null, 2)}\n`, 'utf8');
  const contracts = JSON.parse(await readFile(join(target, 'contract-bundle.auth.generated.json'), 'utf8')) as ContractBundle;
  const scopes = [...new Set(['mcp:tools', 'mcp:resources', 'mcp:approve', 'offline_access', ...contracts.tools.flatMap((tool) => tool.required_scopes)])].sort();
  const username = 'owner@numtema.local';
  const password = randomPassword();
  const base = publicBaseUrl.replace(/\/$/, '');
  const config = {
    artifact_type: 'chatgpt_app_config', artifact_version: '1.1', runtime_config: './runtime-config.json', public_base_url: base,
    server: { host: '127.0.0.1', port: 8788, mcp_path: '/mcp', allowed_origins: ['https://chatgpt.com', 'http://localhost:8788'], require_mcp_headers: false },
    oauth: {
      storage_directory: './oauth-state', signing_key_id: 'oauth-key', private_key_file: './oauth-private.pem', public_key_file: './oauth-public.pem',
      scopes_supported: scopes, baseline_scopes: ['mcp:tools'], access_token_ttl_seconds: 900,
      refresh_token_ttl_seconds: 2_592_000, authorization_code_ttl_seconds: 300, allow_dynamic_client_registration: true,
      users: [{ id: 'user-001', username, display_name: 'Foundry Owner', password_hash: hashPassword(password), workspace_refs: ['workspace-001'], allowed_scopes: scopes, status: 'active' }],
      workspaces: [{ id: 'workspace-001', name: 'Main Workspace' }],
      clients: [{ client_id: 'chatgpt-client', client_name: 'Foundry Local Smoke Client', redirect_uris: ['http://127.0.0.1:8789/callback'], grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], token_endpoint_auth_method: 'none', created_at: new Date().toISOString() }]
    },
    approvals: { storage_directory: './approval-state', signing_key_id: 'approval-key', private_key_file: './approval-private.pem' }
  };
  await writeFile(join(target, 'chatgpt-app-config.json'), `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  await writeFile(join(target, 'CHATGPT_APP_README.md'), renderReadme(username, password, base), 'utf8');
  return { directory: target, config_file: join(target, 'chatgpt-app-config.json'), username, password, workspace_ref: 'workspace-001', public_base_url: base, generated_private_keys: 5 };
}

async function writePrivate(path: string, value: string): Promise<void> { await writeFile(path, value, 'utf8'); await chmod(path, 0o600); }
function keyPair(): { publicKey: string; privateKey: string } { const pair = generateKeyPairSync('ed25519'); return { publicKey: String(pair.publicKey.export({ type: 'spki', format: 'pem' })), privateKey: String(pair.privateKey.export({ type: 'pkcs8', format: 'pem' })) }; }
function randomPassword(): string { return `Nf!${randomBytes(12).toString('hex')}`; }
function renderReadme(username: string, password: string, base: string): string { return `# Nümtema ChatGPT App Demo\n\nIdentifiants de développement générés une seule fois :\n\n- Username: \`${username}\`\n- Password: \`${password}\`\n\nNe réutilisez pas ces identifiants en production.\n\n## Démarrer\n\n\`\`\`bash\nCUSTOMER_API_TOKEN=demo-token node mock-provider.mjs\nCUSTOMER_API_TOKEN=demo-token foundry app serve --config chatgpt-app-config.json\n\`\`\`\n\nMCP endpoint: ${base}/mcp\nOAuth metadata: ${base}/.well-known/oauth-protected-resource\n` ; }
