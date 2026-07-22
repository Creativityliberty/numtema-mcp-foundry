import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
export async function loadAuthorizedExecutionEnvelope(path) {
    return (await loadArtifact(path, 'authorized_execution_envelope'));
}
export async function loadSignedDispatchReceipt(path) {
    return (await loadArtifact(path, 'signed_dispatch_receipt'));
}
export async function loadProviderExecutionPlan(path) {
    return (await loadArtifact(path, 'provider_execution_plan'));
}
export async function loadCredentialResolutionPlan(path) {
    return (await loadArtifact(path, 'credential_resolution_plan'));
}
export async function loadRuntimePolicyDecision(path) {
    return (await loadArtifact(path, 'runtime_policy_decision'));
}
export async function loadApprovalProof(path) {
    return (await loadArtifact(path, 'approval_proof'));
}
export async function loadBudgetAuthorization(path) {
    return (await loadArtifact(path, 'budget_authorization'));
}
export async function loadRuntimeTrustStore(path) {
    return (await loadArtifact(path, 'runtime_trust_store'));
}
async function loadArtifact(path, expectedType) {
    let parsed;
    try {
        parsed = JSON.parse(await readFile(resolve(path), 'utf8'));
    }
    catch (error) {
        throw new Error(`RUNTIME_ARTIFACT_LOAD_FAILED: ${path}: ${errorMessage(error)}`);
    }
    if (!isRecord(parsed) || parsed.artifact_type !== expectedType) {
        throw new Error(`INVALID_RUNTIME_ARTIFACT: expected ${expectedType} in ${path}.`);
    }
    return parsed;
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
//# sourceMappingURL=loaders.js.map