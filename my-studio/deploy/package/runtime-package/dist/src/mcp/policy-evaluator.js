import { sha256 } from '../runtime/canonical.js';
import { signArtifact } from './signing.js';
export function evaluateAndSignPolicy(input) {
    const riskClass = input.policy.risk_class;
    const approvalRequired = input.tool.approval_ref !== undefined || requiresApproval(input.policy.default_decision);
    const budgetRequired = input.tool.effects.financial;
    const riskSummaryHash = input.approval?.risk_summary_hash ?? sha256({
        tool_id: input.tool.id,
        tool_revision: input.tool.revision ?? '',
        risk_class: riskClass,
        effects: input.tool.effects,
        arguments_hash: input.executionPlan.arguments_hash
    });
    const estimatedAmount = input.budget?.estimated_amount ?? null;
    const currency = input.budget?.currency ?? null;
    const costSummaryHash = input.budget?.cost_summary_hash ?? (budgetRequired ? sha256({ currency, estimated_amount: estimatedAmount, arguments_hash: input.executionPlan.arguments_hash }) : null);
    const expiresAt = new Date(Date.parse(input.at) + (input.ttlSeconds ?? 300) * 1000).toISOString();
    const decision = input.policy.default_decision === 'deny' ? 'deny' : 'allow';
    const base = {
        artifact_type: 'runtime_policy_decision',
        artifact_version: '0.8',
        policy_ref: input.policy.id,
        decision,
        risk_class: riskClass,
        binding: {
            tool_id: input.executionPlan.tool_id,
            tool_revision: input.executionPlan.tool_revision,
            adapter_id: input.executionPlan.adapter_id,
            adapter_revision: input.executionPlan.adapter_revision,
            arguments_hash: input.executionPlan.arguments_hash,
            context_hash: input.credentialPlan.context_hash
        },
        subject_ref: input.tenant.subject_ref,
        client_ref: input.tenant.client_ref,
        workspace_ref: input.tenant.workspace_ref,
        approval: {
            required: approvalRequired,
            approval_ref: input.tool.approval_ref ?? null,
            mode: input.approval?.mode ?? approvalMode(input.policy.default_decision),
            risk_summary_hash: approvalRequired ? riskSummaryHash : null
        },
        budget: {
            required: budgetRequired,
            currency,
            estimated_amount: estimatedAmount,
            cost_summary_hash: budgetRequired ? costSummaryHash : null
        },
        evaluated_at: input.at,
        expires_at: expiresAt
    };
    return signArtifact(base, input.signer);
}
export function riskClassForTool(tool, policy) {
    if (policy !== undefined)
        return policy.risk_class;
    const foundry = tool.extensions?.foundry;
    if (typeof foundry === 'object' && foundry !== null && !Array.isArray(foundry)) {
        const value = foundry.risk_class;
        if (isRiskClass(value))
            return value;
    }
    return 'R0';
}
function requiresApproval(decision) {
    return decision === 'require_confirmation' || decision === 'require_widget' || decision === 'require_approver';
}
function approvalMode(decision) {
    if (decision === 'require_widget')
        return 'secure_widget';
    if (decision === 'require_approver')
        return 'approver';
    if (decision === 'require_confirmation')
        return 'chat_explicit';
    return null;
}
function isRiskClass(value) {
    return typeof value === 'string' && ['R0', 'R1', 'R2', 'R3', 'R4', 'R5'].includes(value);
}
//# sourceMappingURL=policy-evaluator.js.map