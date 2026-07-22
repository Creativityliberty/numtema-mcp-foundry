import type { ProviderExecutionPlan } from '../adapters/types.js';
import type { CredentialResolutionPlan } from '../auth/types.js';
import type { ApprovalContract, RiskClass } from '../contracts/types.js';

export type RuntimeKeyPurpose = 'policy' | 'approval' | 'budget' | 'dispatch' | 'execution';

export interface RuntimeBinding {
  tool_id: string;
  tool_revision: string;
  adapter_id: string;
  adapter_revision: string;
  arguments_hash: string;
  context_hash: string;
}

export interface RuntimeTenantBinding extends RuntimeBinding {
  subject_ref: string;
  client_ref: string;
  workspace_ref: string;
}

export interface RuntimeIntegrity {
  algorithm: 'sha256';
  digest: string;
}

export interface RuntimeSignature {
  algorithm: 'ed25519';
  key_id: string;
  value: string;
}

export interface RuntimePolicyDecision {
  artifact_type: 'runtime_policy_decision';
  artifact_version: '0.8';
  policy_ref: string;
  decision: 'allow' | 'deny';
  risk_class: RiskClass;
  binding: RuntimeBinding;
  subject_ref: string;
  client_ref: string;
  workspace_ref: string;
  approval: {
    required: boolean;
    approval_ref: string | null;
    mode: ApprovalContract['mode'] | null;
    risk_summary_hash: string | null;
  };
  budget: {
    required: boolean;
    currency: string | null;
    estimated_amount: number | null;
    cost_summary_hash: string | null;
  };
  evaluated_at: string;
  expires_at: string;
  integrity: RuntimeIntegrity;
  signature: RuntimeSignature;
}

export interface ApprovalProof {
  artifact_type: 'approval_proof';
  artifact_version: '0.8';
  approval_ref: string;
  mode: ApprovalContract['mode'];
  approved: true;
  single_use: true;
  nonce: string;
  binding: RuntimeTenantBinding;
  risk_summary_hash: string;
  cost_summary_hash: string | null;
  issued_at: string;
  expires_at: string;
  integrity: RuntimeIntegrity;
  signature: RuntimeSignature;
}

export interface BudgetAuthorization {
  artifact_type: 'budget_authorization';
  artifact_version: '0.8';
  budget_ref: string;
  approved: true;
  binding: RuntimeTenantBinding;
  currency: string;
  estimated_amount: number;
  max_authorized_amount: number;
  remaining_before: number;
  cost_summary_hash: string;
  issued_at: string;
  expires_at: string;
  integrity: RuntimeIntegrity;
  signature: RuntimeSignature;
}

export interface RuntimeTrustKey {
  key_id: string;
  algorithm: 'ed25519';
  purpose: RuntimeKeyPurpose;
  status: 'active' | 'revoked' | 'disabled';
  public_key_pem: string;
  not_before?: string;
  expires_at?: string;
}

export interface RuntimeTrustStore {
  artifact_type: 'runtime_trust_store';
  artifact_version: '0.8';
  keys: RuntimeTrustKey[];
}

export interface RuntimePreflightCheck {
  code: string;
  status: 'pass' | 'fail' | 'not_applicable';
  message: string;
}

export interface RuntimePreflightIssue {
  code: string;
  message: string;
}

export interface AuthorizedExecutionEnvelope {
  artifact_type: 'authorized_execution_envelope';
  artifact_version: '0.8';
  dry_run: true;
  network_executed: false;
  dispatch_permitted: boolean;
  authorization_id: string;
  execution_nonce: string;
  authorized_at: string;
  expires_at: string | null;
  binding: RuntimeTenantBinding;
  risk_class: RiskClass;
  policy: {
    policy_ref: string;
    decision: 'allow' | 'deny';
    digest: string;
    signature_key_id: string;
  };
  approval: {
    required: boolean;
    approval_ref: string | null;
    mode: ApprovalContract['mode'] | null;
    nonce: string | null;
    digest: string | null;
    signature_key_id: string | null;
  };
  budget: {
    required: boolean;
    budget_ref: string | null;
    currency: string | null;
    estimated_amount: number | null;
    max_authorized_amount: number | null;
    remaining_before: number | null;
    digest: string | null;
    signature_key_id: string | null;
  };
  execution_plan: ProviderExecutionPlan;
  credential_plan: CredentialResolutionPlan;
  checks: RuntimePreflightCheck[];
  warnings: RuntimePreflightIssue[];
  errors: RuntimePreflightIssue[];
  redaction: {
    secret_material_included: false;
    credential_handle_only: true;
  };
  source_digests: {
    execution_plan: string;
    credential_plan: string;
    policy: string;
    approval: string | null;
    budget: string | null;
  };
  integrity: RuntimeIntegrity;
}

export interface SecurePreflightInput {
  executionPlan: ProviderExecutionPlan;
  credentialPlan: CredentialResolutionPlan;
  policy: RuntimePolicyDecision;
  approval?: ApprovalProof;
  budget?: BudgetAuthorization;
  trustStore: RuntimeTrustStore;
  at: string;
}
