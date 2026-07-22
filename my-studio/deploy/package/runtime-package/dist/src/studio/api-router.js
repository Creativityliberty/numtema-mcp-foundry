import { readFile } from 'node:fs/promises';
import { planProviderRequest } from '../adapters/request-planner.js';
import { buildDeploymentPackage } from './deployment-builder.js';
import { buildStudioProject, readStudioGeneratedArtifact } from './pipeline-service.js';
import { importStudioSource, loadStudioOverrides, loadStudioProject, resolveStudioPath, saveStudioOverrides, saveStudioProject } from './project-store.js';
export async function handleStudioApi(request, pathname, context) {
    if (!pathname.startsWith('/api/'))
        return null;
    const method = request.method ?? 'GET';
    if (method !== 'GET' && headerValue(request.headers['x-foundry-csrf']) !== context.csrfToken) {
        return fail(403, 'STUDIO_CSRF_INVALID', 'The Studio write token is missing or invalid.');
    }
    try {
        if (method === 'GET' && pathname === '/api/health') {
            return ok({ status: 'ready', project_directory: context.projectDirectory, secret_material_included: false });
        }
        if (method === 'GET' && pathname === '/api/project') {
            const project = await loadStudioProject(context.projectDirectory);
            const overrides = await loadStudioOverrides(context.projectDirectory, project);
            let capabilityMap = null;
            try {
                capabilityMap = await readStudioGeneratedArtifact(context.projectDirectory, 'capability_map');
            }
            catch { /* Not built yet. */ }
            return ok({ project, overrides, capability_map: capabilityMap });
        }
        if (method === 'POST' && pathname === '/api/source/import') {
            const payload = await readJsonBody(request, context.bodyLimitBytes);
            const filename = stringField(payload, 'filename');
            const content = stringField(payload, 'content');
            const project = await importStudioSource(context.projectDirectory, filename, content);
            return ok({ project });
        }
        if (method === 'POST' && pathname === '/api/project/configure') {
            const payload = await readJsonBody(request, context.bodyLimitBytes);
            const project = await loadStudioProject(context.projectDirectory);
            if (isRecord(payload.provider)) {
                if (typeof payload.provider.base_url === 'string')
                    project.provider.base_url = payload.provider.base_url;
                if (typeof payload.provider.provider_ref === 'string')
                    project.provider.provider_ref = payload.provider.provider_ref;
                if (typeof payload.provider.provider_account_ref === 'string')
                    project.provider.provider_account_ref = payload.provider.provider_account_ref;
                if (typeof payload.provider.credential_environment === 'string')
                    project.provider.credential_environment = payload.provider.credential_environment;
                if (isAuthMode(payload.provider.auth_mode))
                    project.provider.auth_mode = payload.provider.auth_mode;
            }
            if (isRecord(payload.chatgpt_app)) {
                if (typeof payload.chatgpt_app.public_base_url === 'string')
                    project.chatgpt_app.public_base_url = payload.chatgpt_app.public_base_url;
                if (Array.isArray(payload.chatgpt_app.allowed_origins))
                    project.chatgpt_app.allowed_origins = payload.chatgpt_app.allowed_origins.filter((item) => typeof item === 'string');
            }
            await saveStudioProject(context.projectDirectory, project);
            return ok({ project: await loadStudioProject(context.projectDirectory) });
        }
        if (method === 'POST' && pathname === '/api/overrides') {
            const payload = await readJsonBody(request, context.bodyLimitBytes);
            if (!Array.isArray(payload.overrides))
                return fail(400, 'STUDIO_OVERRIDES_INVALID', 'overrides must be an array.');
            await saveStudioOverrides(context.projectDirectory, payload.overrides);
            return ok({ override_count: payload.overrides.length });
        }
        if (method === 'POST' && pathname === '/api/pipeline/build') {
            return ok(await buildStudioProject(context.projectDirectory));
        }
        if (method === 'POST' && pathname === '/api/deployment/build') {
            const manifest = await buildDeploymentPackage(context.projectDirectory);
            const project = await loadStudioProject(context.projectDirectory);
            return ok({ manifest, directory: resolveStudioPath(context.projectDirectory, project.paths.deployment_directory) });
        }
        if (method === 'POST' && pathname === '/api/simulate') {
            const payload = await readJsonBody(request, context.bodyLimitBytes);
            const toolName = stringField(payload, 'tool_name');
            const args = isRecord(payload.arguments) ? payload.arguments : {};
            const project = await loadStudioProject(context.projectDirectory);
            const adapters = JSON.parse(await readFile(resolveStudioPath(context.projectDirectory, project.paths.provider_adapters), 'utf8'));
            const adapter = adapters.adapters.find((candidate) => candidate.tool_name === toolName);
            if (!adapter)
                return fail(404, 'STUDIO_TOOL_NOT_FOUND', `No adapter exists for ${toolName}.`);
            const plan = planProviderRequest(adapter, args, { baseUrl: project.provider.base_url });
            return ok({
                stages: ['arguments_validated', 'provider_plan_created', 'credential_boundary_required', 'policy_preflight_pending', 'network_not_executed'],
                plan,
                network_executed: false,
                secret_material_included: false
            });
        }
        if (method === 'GET' && pathname.startsWith('/api/artifact/')) {
            const key = pathname.slice('/api/artifact/'.length);
            const allowed = ['inspection', 'capability_map', 'contract_bundle', 'provider_adapters', 'provider_auth_bindings', 'credential_catalog'];
            if (!allowed.includes(key))
                return fail(404, 'STUDIO_ARTIFACT_UNKNOWN', key);
            const project = await loadStudioProject(context.projectDirectory);
            const mapping = {
                inspection: project.paths.inspection,
                capability_map: project.paths.capability_map,
                contract_bundle: project.paths.contract_bundle,
                provider_adapters: project.paths.provider_adapters,
                provider_auth_bindings: project.paths.provider_auth_bindings,
                credential_catalog: project.paths.credential_catalog
            };
            return ok(JSON.parse(await readFile(resolveStudioPath(context.projectDirectory, mapping[key]), 'utf8')));
        }
        return fail(404, 'STUDIO_ROUTE_NOT_FOUND', `${method} ${pathname}`);
    }
    catch (error) {
        return fail(400, errorCode(error), errorMessage(error));
    }
}
function ok(data) { return { status: 200, body: { ok: true, data, issues: [], trace_id: traceId() } }; }
function fail(status, code, message) { return { status, body: { ok: false, data: null, issues: [{ code, message }], trace_id: traceId() } }; }
async function readJsonBody(request, limit) {
    let value = '';
    let size = 0;
    await new Promise((resolvePromise, reject) => {
        request.on('data', (chunk) => {
            size += chunk.byteLength;
            if (size > limit) {
                reject(new Error('STUDIO_BODY_TOO_LARGE: request body exceeds the configured limit.'));
                return;
            }
            value += chunk.toString('utf8');
        });
        request.on('end', resolvePromise);
        request.on('error', reject);
    });
    if (value.length === 0)
        return {};
    const parsed = JSON.parse(value);
    if (!isRecord(parsed))
        throw new Error('STUDIO_BODY_INVALID: expected a JSON object.');
    return parsed;
}
function stringField(value, name) {
    const selected = value[name];
    if (typeof selected !== 'string' || selected.length === 0)
        throw new Error(`STUDIO_FIELD_REQUIRED: ${name}`);
    return selected;
}
function headerValue(value) { return Array.isArray(value) ? value[0] : value; }
function isRecord(value) { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function isAuthMode(value) { return ['none', 'bearer', 'api_key', 'basic', 'host_managed'].includes(String(value)); }
function errorMessage(error) { return error instanceof Error ? error.message : String(error); }
function errorCode(error) { const message = errorMessage(error); const match = /^([A-Z0-9_]+):/.exec(message); return match?.[1] ?? 'STUDIO_REQUEST_FAILED'; }
function traceId() { return `studio_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`; }
//# sourceMappingURL=api-router.js.map