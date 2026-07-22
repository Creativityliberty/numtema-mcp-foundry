import { sha256, sha256ArtifactPayload } from './canonical.js';
import { verifySignedArtifact } from './signature-verifier.js';
import type {
  ApprovalProof,
  AuthorizedExecutionEnvelope,
  BudgetAuthorization,
  RuntimeBinding,
  RuntimePreflightCheck,
  RuntimePreflightIssue,
  RuntimeTenantBinding,
  SecurePreflightInput
} from './types.js';

export function authorizeExecution(input: SecurePreflightInput): AuthorizedExecutionEnvelope {
  const checks: RuntimePreflightCheck[] = [];
  const errors: RuntimePreflightIssue[] = [];
  const warnings: RuntimePreflightIssue[] = [];
  const atMs = Date.parse(input.at);
  if (Number.isNaN(atMs)) errors.push({ code: 'INVALID_PREFLIGHT_TIME', message: 'Preflight timestamp must be RFC 3339.' });

  verifyPlanIntegrity('execution', input.executionPlan, checks, errors);
  verifyPlanIntegrity('credential', input.credentialPlan, checks, errors);

  check(input.executionPlan.dry_run === true, 'EXECUTION_PLAN_DRY_RUN', 'Provider execution plan is a dry-run plan.', 'Provider execution plan is not marked dry-run.', checks, errors);
  check(input.credentialPlan.dry_run === true, 'CREDENTIAL_PLAN_DRY_RUN', 'Credential plan is a dry-run plan.', 'Credential plan is not marked dry-run.', checks, errors);
  check(input.credentialPlan.ready, 'CREDENTIAL_PLAN_READY', 'Credential resolution plan is ready.', 'Credential resolution plan is not ready.', checks, errors, 'CREDENTIAL_PLAN_NOT_READY');
  check(input.executionPlan.credential_requirement.secret_material_included === false && input.credentialPlan.injection_envelope.secret_material_included === false, 'CREDENTIAL_REDACTION', 'Credential artifacts contain handles only.', 'Credential plan indicates secret material.', checks, errors, 'SECRET_MATERIAL_DETECTED');

  const expectedBinding: RuntimeBinding = {
    tool_id: input.executionPlan.tool_id,
    tool_revision: input.executionPlan.tool_revision,
    adapter_id: input.executionPlan.adapter_id,
    adapter_revision: input.executionPlan.adapter_revision,
    arguments_hash: input.executionPlan.arguments_hash,
    context_hash: input.credentialPlan.context_hash
  };
  const tenantBinding: RuntimeTenantBinding = {
    ...expectedBinding,
    subject_ref: input.policy.subject_ref,
    client_ref: input.policy.client_ref,
    workspace_ref: input.policy.workspace_ref
  };

  check(bindingsEqual(expectedBinding, {
    tool_id: input.credentialPlan.tool_id,
    tool_revision: input.credentialPlan.tool_revision,
    adapter_id: input.credentialPlan.adapter_id,
    adapter_revision: input.credentialPlan.adapter_revision,
    arguments_hash: input.executionPlan.arguments_hash,
    context_hash: input.credentialPlan.context_hash
  }), 'PLAN_BINDING_MATCH', 'Execution and credential plans target the same tool and adapter revisions.', 'Execution and credential plans target different tool or adapter revisions.', checks, errors, 'PLAN_BINDING_MISMATCH');

  const policyVerification = verifySignedArtifact(input.policy, input.trustStore, 'policy', input.at);
  appendVerification('POLICY', policyVerification.errors, checks, errors);
  check(bindingsEqual(expectedBinding, input.policy.binding), 'POLICY_BINDING_MATCH', 'Policy decision binds the exact execution.', 'Policy decision does not bind the exact execution.', checks, errors, 'POLICY_BINDING_MISMATCH');
  check(input.policy.decision === 'allow', 'POLICY_ALLOW', 'Policy permits the exact execution.', 'Policy denied the execution.', checks, errors, 'POLICY_DENIED');
  checkTimeWindow('POLICY', input.policy.evaluated_at, input.policy.expires_at, atMs, checks, errors);

  const approvalResult = validateApproval(input.approval, input.policy.approval.required, input.policy, tenantBinding, input.trustStore, input.at, atMs);
  checks.push(...approvalResult.checks);
  errors.push(...approvalResult.errors);

  const budgetResult = validateBudget(input.budget, input.policy.budget.required, input.policy, tenantBinding, input.trustStore, input.at, atMs);
  checks.push(...budgetResult.checks);
  errors.push(...budgetResult.errors);

  if (containsSecretMaterial(input.executionPlan) || containsSecretMaterial(input.credentialPlan)) {
    checks.push({ code: 'SECRET_SCAN', status: 'fail', message: 'Secret-like material was detected in runtime plans.' });
    errors.push({ code: 'SECRET_MATERIAL_DETECTED', message: 'Runtime plans must contain credential handles only.' });
  } else {
    checks.push({ code: 'SECRET_SCAN', status: 'pass', message: 'No secret-like material was detected in runtime plans.' });
  }

  const expiryCandidates = [input.policy.expires_at];
  if (input.approval !== undefined) expiryCandidates.push(input.approval.expires_at);
  if (input.budget !== undefined) expiryCandidates.push(input.budget.expires_at);
  const expiresAt = earliestValidTimestamp(expiryCandidates);
  const sourceDigests = {
    execution_plan: input.executionPlan.integrity.digest,
    credential_plan: input.credentialPlan.integrity.digest,
    policy: input.policy.integrity.digest,
    approval: input.approval?.integrity.digest ?? null,
    budget: input.budget?.integrity.digest ?? null
  };
  const authorizationSeed = {
    source_digests: sourceDigests,
    binding: tenantBinding,
    authorized_at: input.at,
    expires_at: expiresAt
  };
  const authorizationId = `authz_${sha256(authorizationSeed).slice(0, 32)}`;
  const executionNonce = `dispatch_${sha256({ authorization_id: authorizationId, arguments_hash: expectedBinding.arguments_hash }).slice(0, 32)}`;
  const dispatchPermitted = errors.length === 0;

  const base = {
    artifact_type: 'authorized_execution_envelope' as const,
    artifact_version: '0.8' as const,
    dry_run: true as const,
    network_executed: false as const,
    dispatch_permitted: dispatchPermitted,
    authorization_id: authorizationId,
    execution_nonce: executionNonce,
    authorized_at: input.at,
    expires_at: expiresAt,
    binding: tenantBinding,
    risk_class: input.policy.risk_class,
    policy: {
      policy_ref: input.policy.policy_ref,
      decision: input.policy.decision,
      digest: input.policy.integrity.digest,
      signature_key_id: input.policy.signature.key_id
    },
    approval: {
      required: input.policy.approval.required,
      approval_ref: input.approval?.approval_ref ?? input.policy.approval.approval_ref,
      mode: input.approval?.mode ?? input.policy.approval.mode,
      nonce: input.approval?.nonce ?? null,
      digest: input.approval?.integrity.digest ?? null,
      signature_key_id: input.approval?.signature.key_id ?? null
    },
    budget: {
      required: input.policy.budget.required,
      budget_ref: input.budget?.budget_ref ?? null,
      currency: input.budget?.currency ?? input.policy.budget.currency,
      estimated_amount: input.budget?.estimated_amount ?? input.policy.budget.estimated_amount,
      max_authorized_amount: input.budget?.max_authorized_amount ?? null,
      remaining_before: input.budget?.remaining_before ?? null,
      digest: input.budget?.integrity.digest ?? null,
      signature_key_id: input.budget?.signature.key_id ?? null
    },
    execution_plan: input.executionPlan,
    credential_plan: input.credentialPlan,
    checks,
    warnings,
    errors,
    redaction: { secret_material_included: false as const, credential_handle_only: true as const },
    source_digests: sourceDigests
  };
  return { ...base, integrity: { algorithm: 'sha256', digest: sha256(base) } };
}

function validateApproval(
  approval: ApprovalProof | undefined,
  required: boolean,
  policy: SecurePreflightInput['policy'],
  binding: RuntimeTenantBinding,
  trustStore: SecurePreflightInput['trustStore'],
  at: string,
  atMs: number
): { checks: RuntimePreflightCheck[]; errors: RuntimePreflightIssue[] } {
  const checks: RuntimePreflightCheck[] = [];
  const errors: RuntimePreflightIssue[] = [];
  if (!required) {
    checks.push({ code: 'APPROVAL_NOT_REQUIRED', status: 'not_applicable', message: 'Policy does not require an approval proof.' });
    return { checks, errors };
  }
  if (approval === undefined) {
    checks.push({ code: 'APPROVAL_PRESENT', status: 'fail', message: 'Required approval proof is missing.' });
    errors.push({ code: 'APPROVAL_REQUIRED', message: 'Policy requires a signed approval proof.' });
    return { checks, errors };
  }
  appendVerification('APPROVAL', verifySignedArtifact(approval, trustStore, 'approval', at).errors, checks, errors);
  check(approval.approved === true && approval.single_use === true && approval.nonce.length > 0, 'APPROVAL_STATE', 'Approval is approved, single-use, and nonce-bound.', 'Approval state is invalid.', checks, errors, 'APPROVAL_INVALID');
  check(approval.approval_ref === policy.approval.approval_ref && approval.mode === policy.approval.mode, 'APPROVAL_CONTRACT_MATCH', 'Approval proof matches the required contract and mode.', 'Approval proof does not match the required contract or mode.', checks, errors, 'APPROVAL_CONTRACT_MISMATCH');
  check(tenantBindingsEqual(binding, approval.binding), 'APPROVAL_BINDING_MATCH', 'Approval proof binds the exact tenant and execution.', 'Approval proof binding differs from the exact execution.', checks, errors, 'APPROVAL_BINDING_MISMATCH');
  check(approval.risk_summary_hash === policy.approval.risk_summary_hash, 'APPROVAL_RISK_MATCH', 'Approval proof binds the required risk summary.', 'Approval proof risk summary differs from policy.', checks, errors, 'APPROVAL_RISK_MISMATCH');
  check(approval.cost_summary_hash === policy.budget.cost_summary_hash, 'APPROVAL_COST_MATCH', 'Approval proof binds the required cost summary.', 'Approval proof cost summary differs from policy.', checks, errors, 'APPROVAL_COST_MISMATCH');
  checkTimeWindow('APPROVAL', approval.issued_at, approval.expires_at, atMs, checks, errors);
  return { checks, errors };
}

function validateBudget(
  budget: BudgetAuthorization | undefined,
  required: boolean,
  policy: SecurePreflightInput['policy'],
  binding: RuntimeTenantBinding,
  trustStore: SecurePreflightInput['trustStore'],
  at: string,
  atMs: number
): { checks: RuntimePreflightCheck[]; errors: RuntimePreflightIssue[] } {
  const checks: RuntimePreflightCheck[] = [];
  const errors: RuntimePreflightIssue[] = [];
  if (!required) {
    checks.push({ code: 'BUDGET_NOT_REQUIRED', status: 'not_applicable', message: 'Policy does not require budget authorization.' });
    return { checks, errors };
  }
  if (budget === undefined) {
    checks.push({ code: 'BUDGET_PRESENT', status: 'fail', message: 'Required budget authorization is missing.' });
    errors.push({ code: 'BUDGET_REQUIRED', message: 'Policy requires a signed budget authorization.' });
    return { checks, errors };
  }
  appendVerification('BUDGET', verifySignedArtifact(budget, trustStore, 'budget', at).errors, checks, errors);
  check(budget.approved === true, 'BUDGET_APPROVED', 'Budget authorization is approved.', 'Budget authorization is not approved.', checks, errors, 'BUDGET_NOT_APPROVED');
  check(tenantBindingsEqual(binding, budget.binding), 'BUDGET_BINDING_MATCH', 'Budget authorization binds the exact tenant and execution.', 'Budget authorization binding differs from the exact execution.', checks, errors, 'BUDGET_BINDING_MISMATCH');
  check(budget.currency === policy.budget.currency && budget.estimated_amount === policy.budget.estimated_amount && budget.cost_summary_hash === policy.budget.cost_summary_hash, 'BUDGET_COST_MATCH', 'Budget authorization binds the exact cost summary.', 'Budget authorization differs from the policy cost summary.', checks, errors, 'BUDGET_COST_MISMATCH');
  check(budget.estimated_amount <= budget.max_authorized_amount && budget.estimated_amount <= budget.remaining_before, 'BUDGET_LIMIT', 'Estimated cost is within authorized and remaining limits.', 'Estimated cost exceeds authorized or remaining budget.', checks, errors, 'BUDGET_LIMIT_EXCEEDED');
  checkTimeWindow('BUDGET', budget.issued_at, budget.expires_at, atMs, checks, errors);
  return { checks, errors };
}

function verifyPlanIntegrity(label: 'execution' | 'credential', plan: { integrity: { algorithm: 'sha256'; digest: string } }, checks: RuntimePreflightCheck[], errors: RuntimePreflightIssue[]): void {
  const expected = sha256ArtifactPayload(plan);
  const valid = plan.integrity.algorithm === 'sha256' && plan.integrity.digest === expected;
  check(valid, `${label.toUpperCase()}_PLAN_INTEGRITY`, `${label} plan integrity is valid.`, `${label} plan digest is invalid.`, checks, errors, `${label.toUpperCase()}_PLAN_INTEGRITY_MISMATCH`);
}

function appendVerification(prefix: string, verificationErrors: RuntimePreflightIssue[], checks: RuntimePreflightCheck[], errors: RuntimePreflightIssue[]): void {
  if (verificationErrors.length === 0) {
    checks.push({ code: `${prefix}_SIGNATURE`, status: 'pass', message: `${prefix.toLowerCase()} artifact integrity and signature are valid.` });
    return;
  }
  checks.push({ code: `${prefix}_SIGNATURE`, status: 'fail', message: `${prefix.toLowerCase()} artifact integrity or signature is invalid.` });
  errors.push(...verificationErrors);
}

function check(condition: boolean, code: string, passMessage: string, failMessage: string, checks: RuntimePreflightCheck[], errors: RuntimePreflightIssue[], errorCode = code): void {
  checks.push({ code, status: condition ? 'pass' : 'fail', message: condition ? passMessage : failMessage });
  if (!condition) errors.push({ code: errorCode, message: failMessage });
}

function checkTimeWindow(prefix: string, issuedAt: string, expiresAt: string, atMs: number, checks: RuntimePreflightCheck[], errors: RuntimePreflightIssue[]): void {
  const issued = Date.parse(issuedAt);
  const expires = Date.parse(expiresAt);
  const validFormat = !Number.isNaN(issued) && !Number.isNaN(expires) && expires > issued;
  check(validFormat, `${prefix}_TIME_FORMAT`, `${prefix.toLowerCase()} time window is valid.`, `${prefix.toLowerCase()} time window is malformed.`, checks, errors, `${prefix}_TIME_INVALID`);
  if (!validFormat || Number.isNaN(atMs)) return;
  check(atMs >= issued, `${prefix}_ACTIVE`, `${prefix.toLowerCase()} artifact is active.`, `${prefix.toLowerCase()} artifact is not active yet.`, checks, errors, `${prefix}_NOT_ACTIVE`);
  check(atMs < expires, `${prefix}_NOT_EXPIRED`, `${prefix.toLowerCase()} artifact has not expired.`, `${prefix.toLowerCase()} artifact has expired.`, checks, errors, `${prefix}_EXPIRED`);
}

function bindingsEqual(left: RuntimeBinding, right: RuntimeBinding): boolean {
  return left.tool_id === right.tool_id && left.tool_revision === right.tool_revision && left.adapter_id === right.adapter_id && left.adapter_revision === right.adapter_revision && left.arguments_hash === right.arguments_hash && left.context_hash === right.context_hash;
}

function tenantBindingsEqual(left: RuntimeTenantBinding, right: RuntimeTenantBinding): boolean {
  return bindingsEqual(left, right) && left.subject_ref === right.subject_ref && left.client_ref === right.client_ref && left.workspace_ref === right.workspace_ref;
}

function earliestValidTimestamp(values: string[]): string | null {
  const valid = values.filter((value) => !Number.isNaN(Date.parse(value))).sort((left, right) => Date.parse(left) - Date.parse(right));
  return valid[0] ?? null;
}

function containsSecretMaterial(value: unknown, key = ''): boolean {
  const normalizedKey = key.toLowerCase();
  if ((normalizedKey === 'secret_material_included' || normalizedKey === 'secret_locator_included') && value === true) return true;
  const forbiddenKeys = new Set(['access_token', 'refresh_token', 'api_key', 'password', 'private_key', 'secret_locator', 'client_secret', 'hmac_secret']);
  if (forbiddenKeys.has(normalizedKey)) return true;
  if (typeof value === 'string') {
    return value.includes('vault://') || value.includes('-----BEGIN PRIVATE KEY-----') || /^Bearer\s+\S+/i.test(value);
  }
  if (Array.isArray(value)) return value.some((child) => containsSecretMaterial(child));
  if (typeof value === 'object' && value !== null) return Object.entries(value).some(([childKey, child]) => containsSecretMaterial(child, childKey));
  return false;
}
