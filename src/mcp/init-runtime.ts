import { generateKeyPairSync } from 'node:crypto';
import { copyFile, mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { resolvePackageAsset } from '../system/package-assets.js';

export interface McpInitReport {
  directory: string;
  config_file: string;
  mock_provider_file: string;
  generated_private_keys: 3;
  copied_artifacts: number;
  secret_material_in_config: false;
}

const ARTIFACTS = [
  'contract-bundle.auth.generated.json',
  'provider-adapters.auth.generated.json',
  'provider-auth-bindings.generated.json',
  'credential-catalog.example.json',
  'customer-get.arguments.json'
] as const;

export async function initializeMcpRuntime(directory: string, force = false): Promise<McpInitReport> {
  const target = resolve(directory);
  if (await exists(target)) {
    const entries = await readdir(target);
    if (entries.length > 0 && !force) throw new Error(`MCP_INIT_REFUSED: ${target} is not empty. Use --force to replace generated files.`);
  }
  await mkdir(target, { recursive: true });
  for (const name of ARTIFACTS) await copyFile(resolvePackageAsset('examples', name), join(target, name));

  const policy = keyPair();
  const dispatch = keyPair();
  const execution = keyPair();
  await writeFile(join(target, 'policy-private.pem'), policy.privateKey, 'utf8');
  await writeFile(join(target, 'dispatch-private.pem'), dispatch.privateKey, 'utf8');
  await writeFile(join(target, 'execution-private.pem'), execution.privateKey, 'utf8');
  const trustStore = {
    artifact_type: 'runtime_trust_store', artifact_version: '0.8', keys: [
      { key_id: 'policy-key', algorithm: 'ed25519', purpose: 'policy', status: 'active', public_key_pem: policy.publicKey },
      { key_id: 'dispatch-key', algorithm: 'ed25519', purpose: 'dispatch', status: 'active', public_key_pem: dispatch.publicKey },
      { key_id: 'execution-key', algorithm: 'ed25519', purpose: 'execution', status: 'active', public_key_pem: execution.publicKey }
    ]
  };
  await writeFile(join(target, 'runtime-trust-store.json'), `${JSON.stringify(trustStore, null, 2)}\n`, 'utf8');
  const config = {
    artifact_type: 'mcp_runtime_config', artifact_version: '1.0',
    server: { name: 'numtema-mcp-demo', version: '1.0.0', protocol_version: '2025-11-25', transport: { type: 'stdio' } },
    provider: { base_url: 'http://127.0.0.1:9797', timeout_ms: 5000 },
    artifacts: {
      contract_bundle: './contract-bundle.auth.generated.json',
      provider_adapter_bundle: './provider-adapters.auth.generated.json',
      provider_auth_binding_bundle: './provider-auth-bindings.generated.json',
      credential_catalog: './credential-catalog.example.json',
      runtime_trust_store: './runtime-trust-store.json',
      ledger_directory: './ledger'
    },
    context: { subject_ref: 'user-001', client_ref: 'chatgpt-client', workspace_ref: 'workspace-001', provider_ref: 'customer-api', provider_account_ref: 'account-customer-001' },
    credentials: { environment_by_handle: { 'credential-handle-customer-001': 'CUSTOMER_API_TOKEN' } },
    signing: {
      policy: { key_id: 'policy-key', private_key_file: './policy-private.pem' },
      dispatch: { key_id: 'dispatch-key', private_key_file: './dispatch-private.pem' },
      execution: { key_id: 'execution-key', private_key_file: './execution-private.pem' }
    }
  };
  await writeFile(join(target, 'runtime-config.json'), `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  await writeFile(join(target, 'mock-provider.mjs'), MOCK_PROVIDER, 'utf8');
  await writeFile(join(target, 'README.md'), renderReadme(), 'utf8');
  return { directory: target, config_file: join(target, 'runtime-config.json'), mock_provider_file: join(target, 'mock-provider.mjs'), generated_private_keys: 3, copied_artifacts: ARTIFACTS.length, secret_material_in_config: false };
}

function keyPair(): { publicKey: string; privateKey: string } {
  const pair = generateKeyPairSync('ed25519');
  return {
    publicKey: String(pair.publicKey.export({ type: 'spki', format: 'pem' })),
    privateKey: String(pair.privateKey.export({ type: 'pkcs8', format: 'pem' }))
  };
}

async function exists(path: string): Promise<boolean> {
  try { await stat(path); return true; } catch { return false; }
}

function renderReadme(): string {
  return `# Nümtema MCP Runtime Demo\n\nTerminal 1:\n\n\`\`\`bash\nCUSTOMER_API_TOKEN=demo-token node mock-provider.mjs\n\`\`\`\n\nTerminal 2:\n\n\`\`\`bash\nCUSTOMER_API_TOKEN=demo-token foundry mcp inspect --config runtime-config.json\nCUSTOMER_API_TOKEN=demo-token foundry mcp smoke --config runtime-config.json --tool customer_get --args customer-get.arguments.json\n\`\`\`\n\nLe mock provider écoute uniquement sur 127.0.0.1:9797. Les clés privées de ce dossier sont des clés de démonstration locales : ne les réutilisez jamais en production.\n`;
}

const MOCK_PROVIDER = `import { createServer } from 'node:http';\nconst expected = 'Bearer ' + (process.env.CUSTOMER_API_TOKEN || 'demo-token');\nconst server = createServer((req, res) => {\n  if (req.headers.authorization !== expected) { res.writeHead(401, { 'content-type': 'application/problem+json' }); res.end(JSON.stringify({ title: 'Unauthorized', status: 401 })); return; }\n  const url = new URL(req.url || '/', 'http://127.0.0.1:9797');\n  const match = /^\\/customers\\/(.+)$/.exec(url.pathname);\n  if (req.method === 'GET' && match) { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ id: decodeURIComponent(match[1]), name: 'Demo Customer', expand: url.searchParams.get('expand') })); return; }\n  res.writeHead(404, { 'content-type': 'application/problem+json' }); res.end(JSON.stringify({ title: 'Not found', status: 404 }));\n});\nserver.listen(9797, '127.0.0.1', () => console.error('MOCK_PROVIDER_READY http://127.0.0.1:9797'));\n`;
