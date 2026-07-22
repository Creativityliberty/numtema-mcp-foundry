import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { ProviderAdapterBundle } from '../adapters/types.js';
import { loadCredentialCatalog, loadProviderAuthBindingBundle } from '../auth/loaders.js';
import { loadContractBundle } from '../contracts/contract-bundle.js';
import { loadApprovalProof, loadBudgetAuthorization, loadRuntimeTrustStore } from '../runtime/loaders.js';
import { createMcpToolRegistry } from './tool-registry.js';
import { createFoundryMcpRuntime } from './server-runtime.js';
import { createMcpRouter } from './jsonrpc-router.js';
import type { McpRouter } from './jsonrpc-router.js';
import type { McpRuntimeConfig, McpRuntimeConfigSummary } from './runtime-config.js';

export interface LoadedMcpAssembly {
  config: McpRuntimeConfig;
  router: McpRouter;
  summary: McpRuntimeConfigSummary;
  http: {
    host: string;
    port: number;
    path: string;
    allowedOrigins: string[];
    bearerToken?: string;
    requireMcpHeaders: boolean;
  };
}

export async function loadMcpAssembly(configPath: string, environment: Record<string, string | undefined> = process.env): Promise<LoadedMcpAssembly> {
  const absoluteConfig = resolve(configPath);
  const root = dirname(absoluteConfig);
  const config = parseMcpRuntimeConfig(JSON.parse(await readFile(absoluteConfig, 'utf8')) as unknown);
  const pathOf = (value: string): string => resolve(root, value);
  const contractBundle = await loadContractBundle(pathOf(config.artifacts.contract_bundle));
  const adapterBundle = await loadProviderAdapterBundle(pathOf(config.artifacts.provider_adapter_bundle));
  const authBindings = await loadProviderAuthBindingBundle(pathOf(config.artifacts.provider_auth_binding_bundle));
  const credentialCatalog = await loadCredentialCatalog(pathOf(config.artifacts.credential_catalog));
  const trustStore = await loadRuntimeTrustStore(pathOf(config.artifacts.runtime_trust_store));
  const approvalsByTool = await loadArtifactMap(config.artifacts.approvals_by_tool, root, loadApprovalProof);
  const budgetsByTool = await loadArtifactMap(config.artifacts.budgets_by_tool, root, loadBudgetAuthorization);
  const policyPrivate = await readFile(pathOf(config.signing.policy.private_key_file), 'utf8');
  const dispatchPrivate = await readFile(pathOf(config.signing.dispatch.private_key_file), 'utf8');
  const executionPrivate = await readFile(pathOf(config.signing.execution.private_key_file), 'utf8');
  const ledgerDirectory = pathOf(config.artifacts.ledger_directory);
  const runtime = createFoundryMcpRuntime({
    contractBundle,
    adapterBundle,
    authBindings,
    credentialCatalog,
    trustStore,
    ledgerDirectory,
    baseUrl: config.provider.base_url,
    context: config.context,
    policySigner: { keyId: config.signing.policy.key_id, privateKeyPem: policyPrivate },
    dispatchSigner: { keyId: config.signing.dispatch.key_id, privateKeyPem: dispatchPrivate },
    executionSigner: { keyId: config.signing.execution.key_id, privateKeyPem: executionPrivate },
    credentialEnvironment: config.credentials.environment_by_handle,
    environment,
    approvalsByTool,
    budgetsByTool,
    timeoutMs: config.provider.timeout_ms ?? 30_000
  });
  const registry = createMcpToolRegistry(contractBundle, adapterBundle);
  const router = createMcpRouter({
    registry,
    serverName: config.server.name,
    serverVersion: config.server.version,
    protocolVersion: config.server.protocol_version ?? '2025-11-25',
    callTool: runtime.callTool
  });
  const transport = config.server.transport;
  const bearerToken = transport.bearer_token_env === undefined ? undefined : environment[transport.bearer_token_env];
  if (transport.bearer_token_env !== undefined && (bearerToken === undefined || bearerToken.length === 0)) {
    throw new Error(`MCP_SERVER_TOKEN_MISSING: environment variable ${transport.bearer_token_env} is required.`);
  }
  const summary: McpRuntimeConfigSummary = {
    server_name: config.server.name,
    server_version: config.server.version,
    protocol_version: config.server.protocol_version ?? '2025-11-25',
    transport: transport.type,
    tool_count: contractBundle.tools.length,
    adapter_count: adapterBundle.adapters.length,
    authenticated_tool_count: adapterBundle.adapters.filter((adapter) => adapter.credential.auth_ref !== null).length,
    high_risk_tool_count: contractBundle.policies.filter((policy) => ['R3','R4','R5'].includes(policy.risk_class)).length,
    provider_base_url: config.provider.base_url,
    ledger_directory: ledgerDirectory,
    secrets_in_config: false
  };
  return {
    config,
    router,
    summary,
    http: {
      host: transport.host ?? '127.0.0.1',
      port: transport.port ?? 8787,
      path: transport.path ?? '/mcp',
      allowedOrigins: transport.allowed_origins ?? [],
      ...(bearerToken === undefined ? {} : { bearerToken }),
      requireMcpHeaders: transport.require_mcp_headers ?? false
    }
  };
}

export async function loadProviderAdapterBundle(path: string): Promise<ProviderAdapterBundle> {
  const value = JSON.parse(await readFile(path, 'utf8')) as ProviderAdapterBundle;
  if (value.artifact_type !== 'provider_adapter_bundle' || value.artifact_version !== '0.6' || !Array.isArray(value.adapters)) {
    throw new Error('INVALID_PROVIDER_ADAPTER_BUNDLE: expected provider_adapter_bundle v0.6.');
  }
  return value;
}

async function loadArtifactMap<T>(
  entries: Record<string, string> | undefined,
  root: string,
  loader: (path: string) => Promise<T>
): Promise<Record<string, T>> {
  if (entries === undefined) return {};
  const output: Record<string, T> = {};
  for (const name of Object.keys(entries).sort()) output[name] = await loader(resolve(root, entries[name]!));
  return output;
}

export function parseMcpRuntimeConfig(value: unknown): McpRuntimeConfig {
  if (!isRecord(value) || value.artifact_type !== 'mcp_runtime_config' || value.artifact_version !== '1.0') {
    throw new Error('INVALID_MCP_RUNTIME_CONFIG: expected mcp_runtime_config v1.0.');
  }
  for (const key of ['server','provider','artifacts','context','credentials','signing']) {
    if (!isRecord(value[key])) throw new Error(`INVALID_MCP_RUNTIME_CONFIG: ${key} must be an object.`);
  }
  const config = value as unknown as McpRuntimeConfig;
  if (config.server.transport.type !== 'stdio' && config.server.transport.type !== 'streamable_http') {
    throw new Error('INVALID_MCP_RUNTIME_CONFIG: transport.type must be stdio or streamable_http.');
  }
  return config;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
