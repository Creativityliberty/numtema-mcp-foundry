import type { RiskClass } from '../contracts/types.js';
import type { CapabilityGovernance } from '../inspection/types.js';
export type StudioProviderAuthMode = 'none' | 'bearer' | 'api_key' | 'basic' | 'host_managed';
export interface StudioToolOverride {
    source_operation_id: string;
    enabled?: boolean;
    name?: string;
    title?: string;
    description?: string;
    risk_class?: RiskClass;
    approval_mode?: CapabilityGovernance['approval_mode'];
    required_scopes?: string[];
}
export interface StudioProject {
    artifact_type: 'studio_project';
    artifact_version: '1.2';
    name: string;
    created_at: string;
    updated_at: string;
    source: {
        file: string;
        imported_at: string | null;
        original_name: string | null;
    };
    provider: {
        base_url: string;
        provider_ref: string;
        provider_account_ref: string;
        auth_mode: StudioProviderAuthMode;
        credential_handle: string;
        credential_environment: string;
    };
    chatgpt_app: {
        public_base_url: string;
        allowed_origins: string[];
        baseline_scopes: string[];
    };
    paths: {
        overrides: string;
        inspection: string;
        capability_map: string;
        contract_bundle: string;
        provider_adapters: string;
        provider_auth_bindings: string;
        credential_catalog: string;
        deployment_directory: string;
    };
    last_build: {
        completed_at: string;
        tool_count: number;
        enabled_tool_count: number;
        risk_counts: Record<string, number>;
        warning_count: number;
    } | null;
}
export interface StudioBuildReport {
    project: StudioProject;
    source_title: string;
    operation_count: number;
    capability_count: number;
    tool_count: number;
    adapter_count: number;
    warnings: Array<{
        code: string;
        message: string;
        capability?: string;
    }>;
    generated_files: string[];
}
export interface DeploymentPackageManifest {
    artifact_type: 'deployment_package_manifest';
    artifact_version: '1.2';
    project_name: string;
    generated_at: string;
    source_digest: string;
    files: Array<{
        path: string;
        sha256: string;
        size_bytes: number;
    }>;
    environment: Array<{
        name: string;
        required: boolean;
        secret: boolean;
        description: string;
    }>;
    endpoints: {
        mcp: string;
        health: string;
        oauth_resource_metadata: string;
        oauth_authorization_metadata: string;
    };
    private_keys_included: false;
}
