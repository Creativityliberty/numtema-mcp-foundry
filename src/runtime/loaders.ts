import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { ProviderExecutionPlan } from '../adapters/types.js';
import type { CredentialResolutionPlan } from '../auth/types.js';
import type { ApprovalProof, AuthorizedExecutionEnvelope, BudgetAuthorization, RuntimePolicyDecision, RuntimeTrustStore } from './types.js';
import type { SignedDispatchReceipt } from '../dispatch/types.js';


export async function loadAuthorizedExecutionEnvelope(path: string): Promise<AuthorizedExecutionEnvelope> {
  return (await loadArtifact(path, 'authorized_execution_envelope')) as unknown as AuthorizedExecutionEnvelope;
}

export async function loadSignedDispatchReceipt(path: string): Promise<SignedDispatchReceipt> {
  return (await loadArtifact(path, 'signed_dispatch_receipt')) as unknown as SignedDispatchReceipt;
}

export async function loadProviderExecutionPlan(path: string): Promise<ProviderExecutionPlan> {
  return (await loadArtifact(path, 'provider_execution_plan')) as unknown as ProviderExecutionPlan;
}

export async function loadCredentialResolutionPlan(path: string): Promise<CredentialResolutionPlan> {
  return (await loadArtifact(path, 'credential_resolution_plan')) as unknown as CredentialResolutionPlan;
}

export async function loadRuntimePolicyDecision(path: string): Promise<RuntimePolicyDecision> {
  return (await loadArtifact(path, 'runtime_policy_decision')) as unknown as RuntimePolicyDecision;
}

export async function loadApprovalProof(path: string): Promise<ApprovalProof> {
  return (await loadArtifact(path, 'approval_proof')) as unknown as ApprovalProof;
}

export async function loadBudgetAuthorization(path: string): Promise<BudgetAuthorization> {
  return (await loadArtifact(path, 'budget_authorization')) as unknown as BudgetAuthorization;
}

export async function loadRuntimeTrustStore(path: string): Promise<RuntimeTrustStore> {
  return (await loadArtifact(path, 'runtime_trust_store')) as unknown as RuntimeTrustStore;
}

async function loadArtifact(path: string, expectedType: string): Promise<Record<string, unknown>> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(resolve(path), 'utf8')) as unknown;
  } catch (error) {
    throw new Error(`RUNTIME_ARTIFACT_LOAD_FAILED: ${path}: ${errorMessage(error)}`);
  }
  if (!isRecord(parsed) || parsed.artifact_type !== expectedType) {
    throw new Error(`INVALID_RUNTIME_ARTIFACT: expected ${expectedType} in ${path}.`);
  }
  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
