// @ts-nocheck -- v1.5 source bridge; behavior is covered by executable integration tests.
import { randomUUID } from 'node:crypto';
import { signArtifact } from '../mcp/signing.js';
import { sha256 } from '../runtime/canonical.js';
import { ApprovalChallengeStore } from './approval-store.js';
import { APPROVAL_WIDGET_URI } from './approval-widget.js';
export function createApprovalToolRegistrations() {
    return [
        {
            toolId: 'foundry:approval:prepare', adapterId: null,
            descriptor: {
                name: 'foundry_approval_prepare', title: 'Prepare secure approval',
                description: 'Prepare a secure, exact approval challenge for a governed tool call. Does not execute the target tool.',
                inputSchema: { type: 'object', properties: { target_tool: { type: 'string', minLength: 1 }, arguments: { type: 'object' } }, required: ['target_tool', 'arguments'], additionalProperties: false },
                outputSchema: { type: 'object', properties: { challenge_id: { type: 'string' }, target_tool: { type: 'string' }, arguments: { type: 'object' }, risk_class: { type: 'string' }, expires_at: { type: 'string' } }, required: ['challenge_id', 'target_tool', 'arguments', 'risk_class', 'expires_at'] },
                annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
                _meta: {
                    toolId: 'foundry:approval:prepare', toolRevision: '1.1.0', riskClass: 'R1', approvalRequired: false,
                    requiredScopes: ['mcp:approve'], ui: { resourceUri: APPROVAL_WIDGET_URI, visibility: ['app'] },
                    'ui.resourceUri': APPROVAL_WIDGET_URI, 'openai/outputTemplate': APPROVAL_WIDGET_URI, 'openai/widgetAccessible': true,
                    'openai/toolInvocation/invoking': 'Preparing secure approval…', 'openai/toolInvocation/invoked': 'Approval ready.'
                }
            }
        },
        {
            toolId: 'foundry:approval:confirm', adapterId: null,
            descriptor: {
                name: 'foundry_approval_confirm', title: 'Confirm secure approval',
                description: 'Confirm or deny one exact approval challenge. Confirmation is one-time and tenant-bound.',
                inputSchema: { type: 'object', properties: { challenge_id: { type: 'string', minLength: 1 }, decision: { type: 'string', enum: ['approve', 'deny'] } }, required: ['challenge_id', 'decision'], additionalProperties: false },
                outputSchema: { type: 'object', properties: { challenge_id: { type: 'string' }, status: { type: 'string' } }, required: ['challenge_id', 'status'] },
                annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
                _meta: {
                    toolId: 'foundry:approval:confirm', toolRevision: '1.1.0', riskClass: 'R2', approvalRequired: false,
                    requiredScopes: ['mcp:approve'], ui: { resourceUri: APPROVAL_WIDGET_URI, visibility: ['app'] },
                    'ui.resourceUri': APPROVAL_WIDGET_URI, 'openai/widgetAccessible': true,
                    'openai/toolInvocation/invoking': 'Recording approval…', 'openai/toolInvocation/invoked': 'Approval recorded.'
                }
            }
        }
    ];
}
export function createApprovalController(options) {
    const store = new ApprovalChallengeStore(options.directory);
    const tools = new Map(options.contracts.tools.map((tool) => [tool.name, tool]));
    const adapters = new Map(options.adapters.adapters.map((adapter) => [adapter.tool_name, adapter]));
    const approvals = new Map(options.contracts.approvals.map((approval) => [approval.id, approval]));
    const policies = new Map(options.contracts.policies.map((policy) => [policy.id, policy]));
    const now = options.now ?? (() => new Date().toISOString());
    return {
        async callTool(name, args, context) {
            try {
                const tenant = requireAuth(context);
                if (name === 'foundry_approval_prepare') {
                    const targetName = stringArg(args, 'target_tool');
                    const targetArgs = recordArg(args, 'arguments');
                    const tool = tools.get(targetName);
                    if (!tool || !tool.approval_ref) throw new Error('APPROVAL_TARGET_NOT_GOVERNED');
                    const adapter = adapters.get(targetName);
                    if (!adapter) throw new Error('APPROVAL_TARGET_ADAPTER_MISSING');
                    const contract = approvals.get(tool.approval_ref);
                    if (!contract) throw new Error('APPROVAL_CONTRACT_NOT_FOUND');
                    const policy = tool.policy_ref ? policies.get(tool.policy_ref) : undefined;
                    const issuedAt = now();
                    const challenge = {
                        challenge_id: `approval_${randomUUID()}`,
                        target_tool: targetName, tool_id: tool.id, tool_revision: tool.revision ?? '',
                        adapter_id: adapter.id, adapter_revision: adapter.revision, approval_ref: contract.id,
                        risk_class: policy?.risk_class ?? riskClass(tool), args_digest: sha256(targetArgs), arguments: targetArgs,
                        ...tenant, created_at: issuedAt, expires_at: new Date(Date.parse(issuedAt) + contract.ttl_seconds * 1000).toISOString(),
                        status: 'pending', confirmed_at: null, consumed_at: null
                    };
                    await store.create(challenge);
                    return {
                        content: [{ type: 'text', text: `Review and approve ${targetName} before execution.` }],
                        structuredContent: { challenge_id: challenge.challenge_id, target_tool: targetName, arguments: targetArgs, risk_class: challenge.risk_class, expires_at: challenge.expires_at },
                        isError: false,
                        _meta: { ui: { resourceUri: APPROVAL_WIDGET_URI }, foundry: { networkExecuted: false, secretMaterialIncluded: false } }
                    };
                }
                if (name === 'foundry_approval_confirm') {
                    const challengeId = stringArg(args, 'challenge_id');
                    const decision = stringArg(args, 'decision');
                    if (decision !== 'approve' && decision !== 'deny') throw new Error('APPROVAL_DECISION_INVALID');
                    const challenge = await store.decide(challengeId, tenant, decision, now());
                    return {
                        content: [{ type: 'text', text: decision === 'approve' ? 'Approval confirmed.' : 'Action denied.' }],
                        structuredContent: { challenge_id: challenge.challenge_id, status: challenge.status },
                        isError: false,
                        _meta: { foundry: { networkExecuted: false, secretMaterialIncluded: false } }
                    };
                }
                throw new Error('APPROVAL_TOOL_NOT_FOUND');
            } catch (error) {
                return { content: [{ type: 'text', text: errorMessage(error) }], structuredContent: { code: errorCode(error) }, isError: true, _meta: { foundry: { networkExecuted: false, secretMaterialIncluded: false } } };
            }
        },
        async resolveApproval(input) {
            if (!input.tool.approval_ref) return undefined;
            const contract = approvals.get(input.tool.approval_ref);
            if (!contract) return undefined;
            const challenge = await store.consume({ target_tool: input.tool.name, tool_revision: input.tool.revision ?? '', adapter_id: input.adapter.id, adapter_revision: input.adapter.revision, args_digest: sha256(input.args), tenant: input.tenant, at: input.at });
            if (!challenge) return undefined;
            const base = {
                artifact_type: 'approval_proof', artifact_version: '0.8', approval_ref: contract.id, mode: contract.mode,
                approved: true, single_use: true, nonce: challenge.challenge_id,
                binding: {
                    tool_id: input.tool.id, tool_revision: input.tool.revision ?? '', adapter_id: input.adapter.id,
                    adapter_revision: input.adapter.revision, arguments_hash: input.argumentsHash, context_hash: input.contextHash,
                    subject_ref: input.tenant.subject_ref, client_ref: input.tenant.client_ref, workspace_ref: input.tenant.workspace_ref
                },
                risk_summary_hash: input.riskSummaryHash, cost_summary_hash: input.costSummaryHash,
                issued_at: input.at, expires_at: new Date(Date.parse(input.at) + contract.ttl_seconds * 1000).toISOString()
            };
            return signArtifact(base, options.signer);
        }
    };
}
function requireAuth(context) { if (!context?.auth) throw new Error('AUTHENTICATED_CONTEXT_REQUIRED'); return { subject_ref: context.auth.subject_ref, client_ref: context.auth.client_ref, workspace_ref: context.auth.workspace_ref }; }
function stringArg(args, key) { const value = args[key]; if (typeof value !== 'string' || value.length === 0) throw new Error(`INVALID_${key.toUpperCase()}`); return value; }
function recordArg(args, key) { const value = args[key]; if (!isRecord(value)) throw new Error(`INVALID_${key.toUpperCase()}`); return value; }
function isRecord(value) { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function errorMessage(error) { return error instanceof Error ? error.message : String(error); }
function errorCode(error) { return errorMessage(error).split(':', 1)[0] ?? 'APPROVAL_ERROR'; }
function riskClass(tool) { const foundry = tool.extensions?.foundry; return isRecord(foundry) && typeof foundry.risk_class === 'string' ? foundry.risk_class : 'R0'; }
