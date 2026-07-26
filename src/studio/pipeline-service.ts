// @ts-nocheck -- v1.5 source bridge; behavior is covered by executable integration tests.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { compileProviderAdapters } from '../adapters/provider-adapter-compiler.js';
import { compileProviderAuthBindings } from '../auth/provider-auth-binding-compiler.js';
import { compileCapabilityMap } from '../compiler/tool-contract-compiler.js';
import { loadOpenApiDocument } from '../inspection/openapi-loader.js';
import { inspectOpenApi } from '../inspection/source-inspector.js';
import { mapCapabilities } from '../mapping/capability-mapper.js';
import { enrichToolBundle } from '../tools/enrichment-engine.js';
import { applyWhatsAppProviderPack, applyWhatsAppAdapterPack } from '../providers/whatsapp/provider-pack.js';
import { applyStudioOverrides } from './tool-overrides.js';
import { loadStudioOverrides, loadStudioProject, resolveStudioPath, saveStudioProject, writeProjectJson } from './project-store.js';
export async function buildStudioProject(directory) {
    const project = await loadStudioProject(directory);
    const sourcePath = resolveStudioPath(directory, project.source.file);
    const document = await loadOpenApiDocument(sourcePath);
    const inspection = inspectOpenApi(document, project.source.original_name ?? project.source.file);
    const rawMap = mapCapabilities(inspection);
    const overrides = await loadStudioOverrides(directory, project);
    const map = applyStudioOverrides(rawMap, overrides);
    const compilation = compileCapabilityMap(map, { version: '1.5.0', auth_id: 'auth:provider', tenant_resolution: 'required' });
    ensureProviderAuth(compilation.bundle, project);
    const genericEnriched = enrichToolBundle(compilation.bundle);
    const enriched = project.provider.provider_ref === 'whatsapp-cloud-api' ? applyWhatsAppProviderPack(genericEnriched) : genericEnriched;
    const bundle = enriched.bundle;
    const genericAdapters = compileProviderAdapters(bundle);
    const adapters = project.provider.provider_ref === 'whatsapp-cloud-api' ? applyWhatsAppAdapterPack(genericAdapters) : genericAdapters;
    const authBindings = compileProviderAuthBindings(bundle, adapters);
    const credentialCatalog = createCredentialCatalog(project, bundle.auth);
    const files = [
        await writeProjectJson(directory, project.paths.inspection, inspection),
        await writeProjectJson(directory, project.paths.capability_map, map),
        await writeProjectJson(directory, project.paths.contract_bundle, bundle),
        await writeProjectJson(directory, project.paths.provider_adapters, adapters),
        await writeProjectJson(directory, project.paths.provider_auth_bindings, authBindings),
        await writeProjectJson(directory, project.paths.credential_catalog, credentialCatalog),
        await writeProjectJson(directory, 'generated/tool-catalog.json', enriched.catalog),
        await writeProjectJson(directory, 'generated/tool-quality-report.json', enriched.quality_report)
    ];
    project.last_build = {
        completed_at: new Date().toISOString(), tool_count: rawMap.capabilities.length, enabled_tool_count: map.capabilities.length,
        risk_counts: map.summary.risk_counts, warning_count: compilation.warnings.length + adapters.warnings.length + authBindings.warnings.length
    };
    await saveStudioProject(directory, project);
    return {
        project: await loadStudioProject(directory), source_title: inspection.source.title, operation_count: inspection.summary.operation_count,
        capability_count: map.capabilities.length, tool_count: bundle.tools.length, adapter_count: adapters.adapters.length,
        tool_quality: enriched.quality_report, tool_catalog: enriched.catalog,
        warnings: [...compilation.warnings, ...adapters.warnings, ...authBindings.warnings].map((warning) => ({ code: warning.code, message: warning.message, ...('capability' in warning && warning.capability ? { capability: warning.capability } : {}) })),
        generated_files: files
    };
}
export async function readStudioGeneratedArtifact(directory, kind) {
    const project = await loadStudioProject(directory);
    const path = project.paths[kind];
    if (typeof path !== 'string') throw new Error(`STUDIO_ARTIFACT_UNKNOWN: ${String(kind)}`);
    return JSON.parse(await readFile(resolveStudioPath(directory, path), 'utf8'));
}
export async function studioSourceDigest(directory) {
    const project = await loadStudioProject(directory);
    const content = await readFile(resolveStudioPath(directory, project.source.file), 'utf8');
    return createHash('sha256').update(content).digest('hex');
}
function ensureProviderAuth(bundle, project) {
    if (project.provider.auth_mode !== 'none' && bundle.auth.length === 0) {
        const scopes = [...new Set(bundle.tools.flatMap((tool) => tool.required_scopes))].sort();
        bundle.auth.push({
            id: 'auth:provider', version: '1.5.0', transport: 'http', mode: project.provider.auth_mode,
            required_scopes: scopes, optional_scopes: [], step_up_authorization: true, tenant_resolution: 'required',
            credential_binding_dimensions: ['subject', 'client', 'workspace', 'provider', 'provider_account', 'scope_set'],
            token_passthrough: false
        });
        for (const tool of bundle.tools) tool.auth_ref = 'auth:provider';
    }
    configureProviderAuth(bundle.auth, project);
}
function configureProviderAuth(authContracts, project) {
    for (const auth of authContracts) {
        auth.mode = project.provider.auth_mode;
        delete auth.authorization_server;
        auth.canonical_resource_uri = project.provider.base_url;
        auth.audience_validation = project.provider.auth_mode === 'bearer';
        auth.pkce_required = false;
        auth.extensions = {
            ...(auth.extensions ?? {}),
            provider_binding: project.provider.auth_mode === 'api_key'
                ? { location: 'header', name: 'X-API-Key', prefix: null }
                : project.provider.auth_mode === 'bearer'
                    ? { location: 'header', name: 'Authorization', prefix: 'Bearer' }
                    : { location: 'runtime' }
        };
    }
}
function createCredentialCatalog(project, authContracts) {
    const auth = authContracts[0];
    if (!auth) return { artifact_type: 'credential_catalog', artifact_version: '0.7', accounts: [] };
    return {
        artifact_type: 'credential_catalog', artifact_version: '0.7', accounts: [{
            id: 'credential-account-provider-001', credential_handle: project.provider.credential_handle, auth_ref: auth.id,
            provider_ref: project.provider.provider_ref, provider_account_ref: project.provider.provider_account_ref,
            subject_ref: 'user-001', client_ref: 'chatgpt-client', workspace_ref: 'workspace-001', mode: auth.mode,
            status: 'active', granted_scopes: [...auth.required_scopes].sort(),
            ...(project.provider.auth_mode === 'bearer' ? { audiences: [project.provider.base_url] } : {}),
            secret_locator: `environment://${project.provider.credential_environment}`
        }]
    };
}
