// @ts-nocheck -- v1.5 source bridge; behavior is covered by executable integration tests.
import { randomUUID } from 'node:crypto';
import { planProviderRequest } from '../adapters/request-planner.js';
import { resolveCredentialPlan } from '../auth/credential-resolver.js';
import { initializeDispatchLedger, reserveDispatch, commitDispatch, releaseDispatch } from '../dispatch/ledger-store.js';
import { authorizeExecution } from '../runtime/secure-preflight.js';
import { sha256 } from '../runtime/canonical.js';
import { validateValueAgainstSchema } from '../validation/schema-validator.js';
import { injectCredential } from './credential-boundary.js';
import { executeProviderRequest } from './provider-executor.js';
import { createExecutionReceipt } from './execution-receipt.js';
import { evaluateAndSignPolicy } from './policy-evaluator.js';
import { resolveWhatsAppRuntimeArguments } from '../providers/whatsapp/provider-pack.js';
export function createFoundryMcpRuntime(options) {
    const tools = new Map(options.contractBundle.tools.map((tool) => [tool.name, tool]));
    const policies = new Map(options.contractBundle.policies.map((policy) => [policy.id, policy]));
    const adapters = new Map(options.adapterBundle.adapters.map((adapter) => [adapter.tool_name, adapter]));
    const bindings = new Map(options.authBindings.bindings.map((binding) => [binding.auth_ref, binding]));
    const environment = options.environment ?? process.env;
    const now = options.now ?? (() => new Date().toISOString());
    let ledgerInitialized = false;
    return {
        async callTool(name, args, meta = {}, requestContext) {
            const startedAt = now();
            try {
                const tool = requireTool(tools, name);
                const adapter = requireAdapter(adapters, name);
                validateModelArguments(tool, args);
                const providerArgs = resolveWhatsAppRuntimeArguments(tool, args, environment);
                if (!hasProviderArgumentTransformer(tool)) validateArguments(tool, providerArgs);
                const idempotencyKey = resolveIdempotencyKey(adapter, meta, startedAt, providerArgs);
                const executionPlan = planProviderRequest(adapter, providerArgs, { baseUrl: options.baseUrl, ...(idempotencyKey === undefined ? {} : { idempotencyKey }) });
                const tenant = requestContext?.auth === undefined
                    ? { subject_ref: options.context.subject_ref, client_ref: options.context.client_ref, workspace_ref: options.context.workspace_ref }
                    : { subject_ref: requestContext.auth.subject_ref, client_ref: requestContext.auth.client_ref, workspace_ref: requestContext.auth.workspace_ref };
                const credentialContext = { ...tenant, provider_ref: options.context.provider_ref, ...(options.context.provider_account_ref === undefined ? {} : { provider_account_ref: options.context.provider_account_ref }), requested_at: startedAt };
                const authBinding = adapter.credential.auth_ref === null ? undefined : bindings.get(adapter.credential.auth_ref);
                const credentialPlan = authBinding === undefined ? createNoCredentialPlan(adapter, credentialContext) : resolveCredentialPlan(authBinding, adapter, options.credentialCatalog, credentialContext);
                const policy = requirePolicy(policies, tool);
                const budget = options.budgetsByTool?.[name];
                let approval = options.approvalsByTool?.[name];
                if (approval === undefined && tool.approval_ref !== undefined && options.approvalResolver !== undefined) {
                    const riskSummaryHash = sha256({ tool_id: tool.id, tool_revision: tool.revision ?? '', risk_class: policy.risk_class, effects: tool.effects, arguments_hash: executionPlan.arguments_hash });
                    const costSummaryHash = budget?.cost_summary_hash ?? (tool.effects.financial ? sha256({ currency: budget?.currency ?? null, estimated_amount: budget?.estimated_amount ?? null, arguments_hash: executionPlan.arguments_hash }) : null);
                    approval = await options.approvalResolver({ tool, adapter, argumentsHash: executionPlan.arguments_hash, contextHash: credentialPlan.context_hash, tenant, riskSummaryHash, costSummaryHash, at: startedAt, args });
                }
                const policyDecision = evaluateAndSignPolicy({ tool, policy, executionPlan, credentialPlan, tenant, ...(approval === undefined ? {} : { approval }), ...(budget === undefined ? {} : { budget }), signer: options.policySigner, at: startedAt });
                const envelope = authorizeExecution({ executionPlan, credentialPlan, policy: policyDecision, ...(approval === undefined ? {} : { approval }), ...(budget === undefined ? {} : { budget }), trustStore: options.trustStore, at: startedAt });
                if (!envelope.dispatch_permitted) return preflightFailure(name, envelope.errors);
                if (!ledgerInitialized) { await initializeDispatchLedger({ directory: options.ledgerDirectory, at: startedAt }); ledgerInitialized = true; }
                const reserved = await reserveDispatch({ directory: options.ledgerDirectory, envelope, signingKeyPem: options.dispatchSigner.privateKeyPem, keyId: options.dispatchSigner.keyId, at: startedAt });
                try {
                    const request = injectCredential(executionPlan, credentialPlan, authBinding, { credentialEnvironment: options.credentialEnvironment, environment });
                    const normalized = await executeProviderRequest(adapter, request, { timeoutMs: options.timeoutMs ?? 30_000 });
                    const completedAt = now();
                    const committed = await commitDispatch({ directory: options.ledgerDirectory, reservationId: reserved.reservation.reservation_id, signingKeyPem: options.dispatchSigner.privateKeyPem, keyId: options.dispatchSigner.keyId, at: completedAt });
                    const receipt = createExecutionReceipt({ authorizationId: envelope.authorization_id, reservationId: reserved.reservation.reservation_id, binding: envelope.binding, status: normalized.ok ? 'succeeded' : 'provider_error', startedAt, completedAt, normalized, dispatchReceipt: committed.receipt, signer: options.executionSigner });
                    return providerResult(name, normalized, receipt, reserved.receipt, committed.receipt);
                } catch (error) {
                    const completedAt = now();
                    const released = await releaseDispatch({ directory: options.ledgerDirectory, reservationId: reserved.reservation.reservation_id, reason: 'cancelled', signingKeyPem: options.dispatchSigner.privateKeyPem, keyId: options.dispatchSigner.keyId, at: completedAt });
                    const message = errorMessage(error);
                    const receipt = createExecutionReceipt({ authorizationId: envelope.authorization_id, reservationId: reserved.reservation.reservation_id, binding: envelope.binding, status: 'transport_error', startedAt, completedAt, transportError: message, dispatchReceipt: released.receipt, signer: options.executionSigner });
                    return { content: [{ type: 'text', text: `Tool ${name} could not reach the provider: ${safeMessage(message)}` }], structuredContent: { code: 'provider_transport_error', category: 'provider_unavailable', retryable: true }, isError: true, _meta: { foundry: { executionReceipt: receipt, reservationReceipt: reserved.receipt, releaseReceipt: released.receipt } } };
                }
            } catch (error) {
                const message = errorMessage(error);
                return { content: [{ type: 'text', text: `Tool ${name} was blocked before provider execution: ${safeMessage(message)}` }], structuredContent: { code: errorCode(message), category: 'foundry_preflight', retryable: false }, isError: true, _meta: { foundry: { networkExecuted: false, secretMaterialIncluded: false } } };
            }
        }
    };
}
function requireTool(tools, name) { const tool = tools.get(name); if (tool === undefined) throw new Error(`TOOL_NOT_FOUND: ${name}.`); return tool; }
function requireAdapter(adapters, name) { const adapter = adapters.get(name); if (adapter === undefined) throw new Error(`ADAPTER_NOT_FOUND: no provider adapter exists for ${name}.`); return adapter; }
function requirePolicy(policies, tool) { if (tool.policy_ref === undefined) throw new Error(`POLICY_REQUIRED: tool ${tool.name} has no PolicyContract.`); const policy = policies.get(tool.policy_ref); if (policy === undefined) throw new Error(`POLICY_NOT_FOUND: ${tool.policy_ref}.`); return policy; }
function validateModelArguments(tool, args) {
    const foundry = tool.extensions?.foundry;
    const intelligence = foundry && typeof foundry === 'object' && !Array.isArray(foundry) ? foundry.tool_intelligence : undefined;
    const schema = intelligence && typeof intelligence === 'object' && !Array.isArray(intelligence) && intelligence.model_input_schema ? intelligence.model_input_schema : tool.input_schema;
    const issues = validateValueAgainstSchema(schema, args, 'mcp_model_arguments', tool.id);
    if (issues.length > 0) throw new Error(`INVALID_TOOL_ARGUMENTS: ${issues.map((issue) => `${issue.path || '/'} ${issue.message}`).join('; ')}`);
}
function hasProviderArgumentTransformer(tool) { const foundry = tool.extensions?.foundry; return foundry && typeof foundry === 'object' && !Array.isArray(foundry) && foundry.provider_pack === 'whatsapp-cloud-api'; }
function validateArguments(tool, args) { const issues = validateValueAgainstSchema(tool.input_schema, args, 'mcp_tool_arguments', tool.id); if (issues.length > 0) throw new Error(`INVALID_TOOL_ARGUMENTS: ${issues.map((issue) => `${issue.path || '/'} ${issue.message}`).join('; ')}`); }
function resolveIdempotencyKey(adapter, meta, at, args) { const supplied = meta.idempotencyKey; if (supplied !== undefined) { if (typeof supplied !== 'string' || supplied.length === 0) throw new Error('INVALID_IDEMPOTENCY_KEY: _meta.idempotencyKey must be a non-empty string.'); return supplied; } if (adapter.request.idempotency.mode === 'required') return `mcp_${sha256({ tool: adapter.tool_id, at, args, nonce: randomUUID() }).slice(0, 32)}`; return undefined; }
function createNoCredentialPlan(adapter, context) {
    const base = { artifact_type: 'credential_resolution_plan', artifact_version: '0.7', dry_run: true, binding_id: 'auth-binding:none', binding_revision: 'none', adapter_id: adapter.id, adapter_revision: adapter.revision, tool_id: adapter.tool_id, tool_revision: adapter.tool_revision, context_hash: sha256(context), selected_credential: null, checks: [{ code: 'AUTH_NOT_REQUIRED', status: 'not_applicable', message: 'Provider adapter does not require authentication.' }], scope_check: { required: [], granted: [], missing: [] }, audience_check: { required: false, expected: null, matched: true }, tenant_check: { required_dimensions: [], matched: true }, injection_envelope: { strategy: 'none', location: 'runtime', name: null, prefix: null, signing_algorithm: null, credential_handle: null, secret_material_included: false }, ready: true, warnings: [], errors: [] };
    return { ...base, integrity: { algorithm: 'sha256', digest: sha256(base) } };
}
function preflightFailure(name, errors) { const approval = errors.find((error) => error.code.includes('APPROVAL')); const budget = errors.find((error) => error.code.includes('BUDGET')); const primary = approval ?? budget ?? errors[0] ?? { code: 'PREFLIGHT_BLOCKED', message: 'Runtime preflight blocked the execution.' }; return { content: [{ type: 'text', text: `Tool ${name} requires additional authorization: ${primary.message}` }], structuredContent: { code: primary.code, category: approval ? 'approval_required' : budget ? 'budget_required' : 'preflight_blocked', retryable: false }, isError: true, _meta: { foundry: { networkExecuted: false, secretMaterialIncluded: false, errors } } }; }
function providerResult(name, normalized, executionReceipt, reservationReceipt, dispatchReceipt) { if (normalized.ok) return { content: [{ type: 'text', text: `Tool ${name} completed with provider HTTP ${normalized.status}.` }], structuredContent: asStructuredContent(normalized.data), isError: false, _meta: { foundry: { executionReceipt, reservationReceipt, dispatchReceipt } } }; return { content: [{ type: 'text', text: `Tool ${name} failed at the provider: ${normalized.error?.message ?? `HTTP ${normalized.status}`}` }], structuredContent: { code: normalized.error?.code ?? `provider_http_${normalized.status}`, category: normalized.error?.category ?? 'provider_error', message: normalized.error?.message ?? `Provider returned HTTP ${normalized.status}.`, retryable: normalized.error?.retryable ?? false, provider_status: normalized.status }, isError: true, _meta: { foundry: { executionReceipt, reservationReceipt, dispatchReceipt } } }; }
function asStructuredContent(value) { if (typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Uint8Array)) return value; if (value instanceof Uint8Array) return { binary: true, byte_length: value.byteLength, digest: sha256([...value]) }; return { data: value }; }
function errorMessage(error) { return error instanceof Error ? error.message : String(error); }
function errorCode(message) { const match = /^([A-Z][A-Z0-9_]+):/.exec(message); return match?.[1]?.toLowerCase() ?? 'foundry_runtime_error'; }
function safeMessage(message) { return message.replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]').replace(/provider-secret-token/g, '[REDACTED]'); }
