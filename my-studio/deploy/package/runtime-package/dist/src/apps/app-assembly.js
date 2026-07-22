import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { loadContractBundle } from '../contracts/contract-bundle.js';
import { loadCredentialCatalog, loadProviderAuthBindingBundle } from '../auth/loaders.js';
import { loadRuntimeTrustStore, loadApprovalProof, loadBudgetAuthorization } from '../runtime/loaders.js';
import { createOAuthService } from '../oauth/service.js';
import { createMcpToolRegistry } from '../mcp/tool-registry.js';
import { createFoundryMcpRuntime } from '../mcp/server-runtime.js';
import { createMcpRouter } from '../mcp/jsonrpc-router.js';
import { loadProviderAdapterBundle, parseMcpRuntimeConfig } from '../mcp/config-loader.js';
import { createApprovalController, createApprovalToolRegistrations } from './approval-tools.js';
import { createAppResourceRegistry } from './resource-registry.js';
import { createFoundryAppHttpServer } from './app-http-server.js';
import { loadChatGptAppConfig } from './app-config-loader.js';
export async function loadChatGptAppAssembly(configPath, environment = process.env) {
    const { config, root } = await loadChatGptAppConfig(configPath);
    const pathOf = (value) => resolve(root, value);
    const runtimeConfigPath = pathOf(config.runtime_config);
    const runtimeRoot = dirname(runtimeConfigPath);
    const runtimeConfig = parseMcpRuntimeConfig(JSON.parse(await readFile(runtimeConfigPath, 'utf8')));
    const runtimePath = (value) => resolve(runtimeRoot, value);
    const contractBundle = await loadContractBundle(runtimePath(runtimeConfig.artifacts.contract_bundle));
    const adapterBundle = await loadProviderAdapterBundle(runtimePath(runtimeConfig.artifacts.provider_adapter_bundle));
    const authBindings = await loadProviderAuthBindingBundle(runtimePath(runtimeConfig.artifacts.provider_auth_binding_bundle));
    const credentialCatalog = await loadCredentialCatalog(runtimePath(runtimeConfig.artifacts.credential_catalog));
    const trustStore = await loadRuntimeTrustStore(runtimePath(runtimeConfig.artifacts.runtime_trust_store));
    const approvalsByTool = await loadArtifactMap(runtimeConfig.artifacts.approvals_by_tool, runtimeRoot, loadApprovalProof);
    const budgetsByTool = await loadArtifactMap(runtimeConfig.artifacts.budgets_by_tool, runtimeRoot, loadBudgetAuthorization);
    const policyPrivate = await readFile(runtimePath(runtimeConfig.signing.policy.private_key_file), 'utf8');
    const dispatchPrivate = await readFile(runtimePath(runtimeConfig.signing.dispatch.private_key_file), 'utf8');
    const executionPrivate = await readFile(runtimePath(runtimeConfig.signing.execution.private_key_file), 'utf8');
    const approvalPrivate = await readFile(pathOf(config.approvals.private_key_file), 'utf8');
    const publicBase = config.public_base_url.replace(/\/$/, '');
    const issuer = config.oauth.issuer ?? publicBase;
    const resource = config.oauth.resource ?? `${publicBase}${config.server.mcp_path}`;
    const oauth = createOAuthService({
        issuer, resource,
        signing_key_id: config.oauth.signing_key_id,
        private_key_pem: await readFile(pathOf(config.oauth.private_key_file), 'utf8'),
        public_key_pem: await readFile(pathOf(config.oauth.public_key_file), 'utf8'),
        storage_directory: pathOf(config.oauth.storage_directory),
        scopes_supported: [...config.oauth.scopes_supported], baseline_scopes: [...config.oauth.baseline_scopes],
        access_token_ttl_seconds: config.oauth.access_token_ttl_seconds,
        refresh_token_ttl_seconds: config.oauth.refresh_token_ttl_seconds,
        authorization_code_ttl_seconds: config.oauth.authorization_code_ttl_seconds,
        allow_dynamic_client_registration: config.oauth.allow_dynamic_client_registration,
        users: config.oauth.users, workspaces: config.oauth.workspaces, clients: config.oauth.clients
    });
    const approvalController = createApprovalController({
        contracts: contractBundle, adapters: adapterBundle, directory: pathOf(config.approvals.storage_directory),
        signer: { keyId: config.approvals.signing_key_id, privateKeyPem: approvalPrivate }
    });
    const runtime = createFoundryMcpRuntime({
        contractBundle, adapterBundle, authBindings, credentialCatalog, trustStore,
        ledgerDirectory: runtimePath(runtimeConfig.artifacts.ledger_directory), baseUrl: runtimeConfig.provider.base_url,
        context: runtimeConfig.context,
        policySigner: { keyId: runtimeConfig.signing.policy.key_id, privateKeyPem: policyPrivate },
        dispatchSigner: { keyId: runtimeConfig.signing.dispatch.key_id, privateKeyPem: dispatchPrivate },
        executionSigner: { keyId: runtimeConfig.signing.execution.key_id, privateKeyPem: executionPrivate },
        credentialEnvironment: runtimeConfig.credentials.environment_by_handle, environment,
        approvalsByTool, budgetsByTool, timeoutMs: runtimeConfig.provider.timeout_ms ?? 30_000,
        approvalResolver: approvalController.resolveApproval
    });
    const extraTools = createApprovalToolRegistrations();
    const registry = createMcpToolRegistry(contractBundle, adapterBundle, 100, extraTools);
    const resources = createAppResourceRegistry();
    const router = createMcpRouter({
        registry, resources,
        serverName: runtimeConfig.server.name,
        serverVersion: runtimeConfig.server.version,
        protocolVersion: runtimeConfig.server.protocol_version ?? '2025-11-25',
        callTool: createAppToolCaller(runtime.callTool, approvalController.callTool)
    });
    const requiredScopes = createScopeResolver(registry, config.oauth.baseline_scopes);
    const server = createFoundryAppHttpServer(router, {
        oauth, mcpPath: config.server.mcp_path, allowedOrigins: config.server.allowed_origins,
        requireMcpHeaders: config.server.require_mcp_headers ?? false, requiredScopes,
        ...(config.server.tls === undefined ? {} : { tls: {
                certificate: await readFile(pathOf(config.server.tls.certificate_file), 'utf8'),
                privateKey: await readFile(pathOf(config.server.tls.private_key_file), 'utf8')
            } })
    });
    return {
        config, oauth, router, registry, server,
        summary: {
            app_name: runtimeConfig.server.name, app_version: runtimeConfig.server.version,
            public_base_url: publicBase, mcp_endpoint: resource, oauth_issuer: issuer, oauth_resource: resource,
            tool_count: registry.list().tools.length, resource_count: resources.list().resources.length,
            user_count: config.oauth.users.length, workspace_count: config.oauth.workspaces.length,
            dynamic_client_registration: config.oauth.allow_dynamic_client_registration, secrets_in_config: false
        }
    };
}
export function createAppToolCaller(runtimeCall, approvalCall) {
    return async (name, args, meta, context) => {
        if (name.startsWith('foundry_approval_'))
            return approvalCall(name, args, context);
        const result = await runtimeCall(name, args, meta, context);
        const structured = result.structuredContent;
        if (result.isError === true && isRecord(structured) && structured.category === 'approval_required') {
            return approvalCall('foundry_approval_prepare', { target_tool: name, arguments: args }, context);
        }
        return result;
    };
}
export function createScopeResolver(registry, baselineScopes) {
    return (message) => {
        if (!isRecord(message) || typeof message.method !== 'string')
            return baselineScopes;
        if (message.method === 'resources/list' || message.method === 'resources/read')
            return ['mcp:resources'];
        if (message.method === 'tools/list')
            return ['mcp:tools'];
        if (message.method !== 'tools/call')
            return baselineScopes;
        const params = isRecord(message.params) ? message.params : {};
        const name = typeof params.name === 'string' ? params.name : '';
        if (name.startsWith('foundry_approval_'))
            return ['mcp:approve'];
        const tool = registry.get(name);
        return [...new Set(['mcp:tools', ...(tool?.descriptor._meta.requiredScopes ?? [])])].sort();
    };
}
async function loadArtifactMap(entries, root, loader) {
    const output = {};
    if (entries === undefined)
        return output;
    for (const name of Object.keys(entries).sort())
        output[name] = await loader(resolve(root, entries[name]));
    return output;
}
function isRecord(value) { return typeof value === 'object' && value !== null && !Array.isArray(value); }
//# sourceMappingURL=app-assembly.js.map