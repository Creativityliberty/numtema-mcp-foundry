export type Semver = `${number}.${number}.${number}`;
export type RiskClass = 'R0' | 'R1' | 'R2' | 'R3' | 'R4' | 'R5';
export type PolicyDecision =
  | 'allow'
  | 'deny'
  | 'require_scope'
  | 'require_confirmation'
  | 'require_widget'
  | 'require_approver';

export interface ToolContract {
  id: string;
  name: string;
  version: Semver;
  revision?: string;
  title?: string;
  description: string;
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
  annotations: {
    read_only: boolean;
    destructive: boolean;
    idempotent: boolean;
    open_world: boolean;
  };
  effects: {
    writes: boolean;
    external_communication: boolean;
    financial: boolean;
    credential_change: boolean;
    personal_data: boolean;
    reversible?: boolean | null;
  };
  execution: {
    mode: 'synchronous' | 'asynchronous' | 'adaptive';
    task_support: 'forbidden' | 'optional' | 'required';
    idempotency: 'not_applicable' | 'unsupported' | 'supported' | 'required';
    timeout_seconds?: number;
  };
  required_scopes: string[];
  preconditions?: string[];
  policy_ref?: string;
  approval_ref?: string;
  recovery_ref?: string;
  auth_ref?: string;
  extensions?: Record<string, unknown>;
}

export interface AuthContract {
  id: string;
  version: Semver;
  transport: 'http' | 'stdio' | 'other';
  mode: 'none' | 'api_key' | 'bearer' | 'basic' | 'hmac' | 'oauth2_1' | 'host_managed';
  canonical_resource_uri?: string;
  authorization_server?: string;
  audience_validation?: boolean;
  pkce_required?: boolean;
  required_scopes: string[];
  optional_scopes?: string[];
  step_up_authorization?: boolean;
  tenant_resolution: 'none' | 'optional' | 'required';
  credential_binding_dimensions?: Array<'subject' | 'client' | 'workspace' | 'provider' | 'provider_account' | 'scope_set'>;
  token_passthrough: false;
  extensions?: Record<string, unknown>;
}

export interface PolicyRule {
  id: string;
  when: Record<string, unknown>;
  decision: PolicyDecision;
  required_scopes?: string[];
  reason?: string;
}

export interface PolicyContract {
  id: string;
  version: Semver;
  risk_class: RiskClass;
  default_decision: PolicyDecision;
  rules: PolicyRule[];
  extensions?: Record<string, unknown>;
}

export type ApprovalBinding =
  | 'subject'
  | 'client'
  | 'workspace'
  | 'tool_id'
  | 'tool_revision'
  | 'arguments_hash'
  | 'risk_summary'
  | 'cost_summary'
  | 'nonce';

export interface ApprovalContract {
  id: string;
  version: Semver;
  mode: 'chat_explicit' | 'secure_widget' | 'approver' | 'dual_control';
  binding: ApprovalBinding[];
  ttl_seconds: number;
  single_use: true;
  display_fields?: string[];
  extensions?: Record<string, unknown>;
}

export interface RecoveryRoute {
  trigger: string;
  next_capability: string;
  argument_mapping?: Record<string, unknown>;
  human_interaction: boolean;
  max_attempts: number;
  allow_risk_increase: false;
  allow_scope_increase: false;
  allow_cost_increase: false;
}

export interface RecoveryContract {
  id: string;
  version: Semver;
  routes: RecoveryRoute[];
  extensions?: Record<string, unknown>;
}

export interface ReceiptContract {
  receipt_id: string;
  trace_id: string;
  mission_id?: string;
  job_id?: string;
  tool_id: string;
  tool_revision: string;
  subject_ref: string;
  client_ref?: string;
  workspace_ref: string;
  provider_ref?: string;
  arguments_hash: string;
  policy_decision: PolicyDecision;
  approval_ref?: string | null;
  status: 'succeeded' | 'failed' | 'cancelled' | 'expired';
  started_at: string;
  completed_at: string;
  cost?: { amount?: number; currency?: string };
  result_hash: string;
  signature: { algorithm: string; key_id: string; value: string };
  extensions?: Record<string, unknown>;
}

export interface FoundryArtifact {
  artifact_id: string;
  artifact_type: string;
  schema_version: `${number}.${number}`;
  project_id: string;
  revision: number;
  created_at: string;
  producer: string;
  state: 'draft' | 'validated' | 'approved' | 'superseded' | 'rejected';
  inputs?: string[];
  integrity: { algorithm: 'sha256'; digest: string };
  extensions?: Record<string, unknown>;
}

export interface ContractBundle {
  bundle_version: '0.2';
  tools: ToolContract[];
  auth: AuthContract[];
  policies: PolicyContract[];
  approvals: ApprovalContract[];
  recoveries: RecoveryContract[];
  receipts: ReceiptContract[];
  artifacts: FoundryArtifact[];
}

export type ContractKind =
  | 'tool'
  | 'auth'
  | 'policy'
  | 'approval'
  | 'recovery'
  | 'receipt'
  | 'artifact';
