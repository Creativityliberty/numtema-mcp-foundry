import type {
  ApprovalContract,
  AuthContract,
  ContractBundle,
  PolicyContract,
  ToolContract
} from '../contracts/types.js';
import { sortValidationIssues, type ValidationIssue } from './issues.js';

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const HIGH_RISK = new Set(['R3', 'R4', 'R5']);
const FINANCIAL_RISK = new Set(['R4', 'R5']);
const REQUIRED_APPROVAL_BINDINGS = ['subject', 'tool_revision', 'arguments_hash'] as const;

export function validateSemantics(bundle: ContractBundle): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const policyById = new Map(bundle.policies.map((contract) => [contract.id, contract] as const));
  const authById = new Map(bundle.auth.map((contract) => [contract.id, contract] as const));
  const approvalById = new Map(bundle.approvals.map((contract) => [contract.id, contract] as const));
  const recoveryById = new Map(bundle.recoveries.map((contract) => [contract.id, contract] as const));
  const toolById = new Map(bundle.tools.map((contract) => [contract.id, contract] as const));

  bundle.tools.forEach((tool, index) => {
    validateTool(tool, index, policyById, authById, approvalById, recoveryById, issues);
  });
  bundle.policies.forEach((policy, index) => validatePolicy(policy, index, issues));
  bundle.auth.forEach((auth, index) => validateAuth(auth, index, issues));
  bundle.approvals.forEach((approval, index) => validateApproval(approval, index, issues));
  bundle.recoveries.forEach((recovery, index) => {
    recovery.routes.forEach((route, routeIndex) => {
      if (route.allow_risk_increase !== false || route.allow_scope_increase !== false || route.allow_cost_increase !== false) {
        issues.push(makeIssue(
          'RECOVERY_ESCALATION_FORBIDDEN',
          `/recoveries/${index}/routes/${routeIndex}`,
          'Recovery routes cannot increase risk, scopes, or cost.',
          'recovery',
          recovery.id,
          'CONST-RECOVERY-001'
        ));
      }
    });
  });
  bundle.receipts.forEach((receipt, index) => {
    const base = `/receipts/${index}`;
    if (!SHA256_PATTERN.test(receipt.arguments_hash) || !SHA256_PATTERN.test(receipt.result_hash)) {
      issues.push(makeIssue(
        'RECEIPT_HASH_INVALID',
        base,
        'Receipt arguments_hash and result_hash must be lowercase SHA-256 digests.',
        'receipt',
        receipt.receipt_id,
        'CONST-RECEIPT-001'
      ));
    }

    const started = Date.parse(receipt.started_at);
    const completed = Date.parse(receipt.completed_at);
    if (!Number.isFinite(started) || !Number.isFinite(completed) || completed < started) {
      issues.push(makeIssue(
        'RECEIPT_TIME_ORDER_INVALID',
        `${base}/completed_at`,
        'Receipt completed_at must be a valid date-time at or after started_at.',
        'receipt',
        receipt.receipt_id,
        'CONST-RECEIPT-002'
      ));
    }

    const tool = toolById.get(receipt.tool_id);
    if (!tool) {
      issues.push(makeIssue(
        'REFERENCE_NOT_FOUND',
        `${base}/tool_id`,
        `Referenced tool ${receipt.tool_id} does not exist.`,
        'receipt',
        receipt.receipt_id,
        'CONST-REF-001'
      ));
    } else if (tool.revision !== receipt.tool_revision) {
      issues.push(makeIssue(
        'RECEIPT_TOOL_REVISION_MISMATCH',
        `${base}/tool_revision`,
        `Receipt revision ${receipt.tool_revision} does not match current tool revision ${tool.revision ?? '<missing>'}.`,
        'receipt',
        receipt.receipt_id,
        'CONST-REVISION-002'
      ));
    }

    if (receipt.approval_ref && !approvalById.has(receipt.approval_ref)) {
      issues.push(makeIssue(
        'REFERENCE_NOT_FOUND',
        `${base}/approval_ref`,
        `Referenced approval ${receipt.approval_ref} does not exist.`,
        'receipt',
        receipt.receipt_id,
        'CONST-REF-001'
      ));
    }
  });

  return sortValidationIssues(issues);
}

function validateTool(
  tool: ToolContract,
  index: number,
  policyById: ReadonlyMap<string, PolicyContract>,
  authById: ReadonlyMap<string, AuthContract>,
  approvalById: ReadonlyMap<string, ApprovalContract>,
  recoveryById: ReadonlyMap<string, unknown>,
  issues: ValidationIssue[]
): void {
  const base = `/tools/${index}`;
  if (!tool.revision) {
    issues.push(makeIssue(
      'TOOL_REVISION_REQUIRED',
      `${base}/revision`,
      'Executable tool contracts require a manifest revision.',
      'tool',
      tool.id,
      'CONST-REVISION-001'
    ));
  }

  if (tool.annotations.read_only && (
    tool.effects.writes ||
    tool.annotations.destructive ||
    tool.effects.external_communication ||
    tool.effects.financial ||
    tool.effects.credential_change
  )) {
    issues.push(makeIssue(
      'TOOL_READ_ONLY_EFFECT_CONFLICT',
      base,
      'A read-only tool cannot declare write, destructive, financial, credential, or communication side effects.',
      'tool',
      tool.id,
      'CONST-TOOL-001'
    ));
  }

  if (tool.effects.writes && !['supported', 'required'].includes(tool.execution.idempotency)) {
    issues.push(makeIssue(
      'TOOL_WRITE_IDEMPOTENCY_REQUIRED',
      `${base}/execution/idempotency`,
      'Write tools must support or require idempotency.',
      'tool',
      tool.id,
      'CONST-IDEMPOTENCY-001'
    ));
  }

  if (tool.execution.task_support === 'required' && tool.execution.mode === 'synchronous') {
    issues.push(makeIssue(
      'TOOL_TASK_MODE_CONFLICT',
      `${base}/execution`,
      'A tool requiring task support cannot declare synchronous-only execution.',
      'tool',
      tool.id,
      'CONST-TASK-001'
    ));
  }

  const highImpact = tool.annotations.destructive || tool.effects.external_communication || tool.effects.financial || tool.effects.credential_change;
  if (highImpact && !tool.approval_ref) {
    issues.push(makeIssue(
      'TOOL_APPROVAL_REQUIRED',
      `${base}/approval_ref`,
      'High-impact tools require an ApprovalContract reference.',
      'tool',
      tool.id,
      'CONST-APPROVAL-001'
    ));
  }

  const policy = resolveReference(tool.policy_ref, policyById, 'policy', base, tool.id, issues);
  const auth = resolveReference(tool.auth_ref, authById, 'auth', base, tool.id, issues);
  resolveReference(tool.approval_ref, approvalById, 'approval', base, tool.id, issues);
  resolveReference(tool.recovery_ref, recoveryById, 'recovery', base, tool.id, issues);

  if (tool.effects.financial) {
    if (!tool.policy_ref) {
      issues.push(makeIssue(
        'TOOL_FINANCIAL_POLICY_REQUIRED',
        `${base}/policy_ref`,
        'Financial tools require an R4 or R5 policy.',
        'tool',
        tool.id,
        'CONST-FINANCIAL-001'
      ));
    } else if (policy && !FINANCIAL_RISK.has(policy.risk_class)) {
      issues.push(makeIssue(
        'TOOL_FINANCIAL_RISK_TOO_LOW',
        `${base}/policy_ref`,
        `Financial tools require R4 or R5; received ${policy.risk_class}.`,
        'tool',
        tool.id,
        'CONST-FINANCIAL-002'
      ));
    }
  }

  if (tool.required_scopes.length > 0 && !tool.auth_ref) {
    issues.push(makeIssue(
      'TOOL_AUTH_REFERENCE_REQUIRED',
      `${base}/auth_ref`,
      'A scoped tool must reference an AuthContract.',
      'tool',
      tool.id,
      'CONST-AUTH-001'
    ));
  }

  if (auth) {
    const authorizedScopes = new Set([...auth.required_scopes, ...(auth.optional_scopes ?? [])]);
    for (const scope of tool.required_scopes) {
      if (!authorizedScopes.has(scope)) {
        issues.push(makeIssue(
          'TOOL_SCOPE_NOT_AUTHORIZED',
          `${base}/required_scopes`,
          `Scope ${scope} is not declared by ${auth.id}.`,
          'tool',
          tool.id,
          'CONST-SCOPE-001'
        ));
      }
    }
  }
}

function validatePolicy(policy: PolicyContract, index: number, issues: ValidationIssue[]): void {
  if (!HIGH_RISK.has(policy.risk_class)) return;
  if (policy.default_decision === 'allow') {
    issues.push(makeIssue(
      'POLICY_HIGH_RISK_ALLOW',
      `/policies/${index}/default_decision`,
      `${policy.risk_class} policies cannot allow by default.`,
      'policy',
      policy.id,
      'CONST-POLICY-001'
    ));
  }
  policy.rules.forEach((rule, ruleIndex) => {
    if (rule.decision === 'allow') {
      issues.push(makeIssue(
        'POLICY_HIGH_RISK_ALLOW',
        `/policies/${index}/rules/${ruleIndex}/decision`,
        `${policy.risk_class} policy rules cannot bypass governance with allow.`,
        'policy',
        policy.id,
        'CONST-POLICY-001'
      ));
    }
  });
}

function validateAuth(auth: AuthContract, index: number, issues: ValidationIssue[]): void {
  const base = `/auth/${index}`;
  if ((auth as { token_passthrough: unknown }).token_passthrough !== false) {
    issues.push(makeIssue(
      'AUTH_TOKEN_PASSTHROUGH_FORBIDDEN',
      `${base}/token_passthrough`,
      'Access tokens issued to the Foundry resource cannot be passed to downstream providers.',
      'auth',
      auth.id,
      'CONST-AUTH-002'
    ));
  }
  if (auth.mode === 'oauth2_1') {
    if (auth.audience_validation !== true) {
      issues.push(makeIssue(
        'AUTH_OAUTH_AUDIENCE_REQUIRED',
        `${base}/audience_validation`,
        'OAuth 2.1 resource servers must validate token audience.',
        'auth',
        auth.id,
        'CONST-AUTH-003'
      ));
    }
    if (auth.pkce_required !== true) {
      issues.push(makeIssue(
        'AUTH_OAUTH_PKCE_REQUIRED',
        `${base}/pkce_required`,
        'OAuth 2.1 authorization code flows must require PKCE.',
        'auth',
        auth.id,
        'CONST-AUTH-004'
      ));
    }
  }
  if (auth.tenant_resolution === 'required') {
    const dimensions = new Set(auth.credential_binding_dimensions ?? []);
    if (!dimensions.has('subject') || !dimensions.has('workspace')) {
      issues.push(makeIssue(
        'AUTH_TENANT_BINDING_REQUIRED',
        `${base}/credential_binding_dimensions`,
        'Tenant-required credentials must bind at least subject and workspace.',
        'auth',
        auth.id,
        'CONST-TENANT-001'
      ));
    }
  }
}

function validateApproval(approval: ApprovalContract, index: number, issues: ValidationIssue[]): void {
  const binding = new Set(approval.binding);
  const missing = REQUIRED_APPROVAL_BINDINGS.filter((required) => !binding.has(required));
  if (missing.length > 0) {
    issues.push(makeIssue(
      'APPROVAL_BINDING_REQUIRED',
      `/approvals/${index}/binding`,
      `Approval binding is missing: ${missing.join(', ')}.`,
      'approval',
      approval.id,
      'CONST-APPROVAL-002'
    ));
  }
}

function resolveReference<T>(
  reference: string | undefined,
  contracts: ReadonlyMap<string, T>,
  kind: string,
  base: string,
  contractId: string,
  issues: ValidationIssue[]
): T | undefined {
  if (!reference) return undefined;
  const resolved = contracts.get(reference);
  if (!resolved) {
    issues.push(makeIssue(
      'REFERENCE_NOT_FOUND',
      `${base}/${kind}_ref`,
      `Referenced ${kind} ${reference} does not exist.`,
      'tool',
      contractId,
      'CONST-REF-001'
    ));
  }
  return resolved;
}

function makeIssue(
  code: string,
  path: string,
  message: string,
  contractKind: string,
  contractId: string,
  rule: string
): ValidationIssue {
  return {
    code,
    severity: 'error',
    path,
    message,
    contract_kind: contractKind,
    contract_id: contractId,
    rule
  };
}
