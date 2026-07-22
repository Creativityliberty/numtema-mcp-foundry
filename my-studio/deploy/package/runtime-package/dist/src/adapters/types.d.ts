export type ProviderHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS' | 'TRACE';
export type ProviderParameterLocation = 'path' | 'query' | 'header' | 'cookie';
export type ProviderBodyEncoding = 'json' | 'form_urlencoded' | 'multipart_descriptor' | 'artifact_reference' | 'text' | 'adaptive';
export type ProviderResponseNormalizer = 'json' | 'text' | 'binary' | 'empty' | 'adaptive';
export interface ProviderParameterBinding {
    argument_name: string;
    source_name: string;
    location: ProviderParameterLocation;
    required: boolean;
    deprecated: boolean;
    style?: string;
    explode?: boolean;
}
export interface ProviderBodyBinding {
    argument_name: 'body';
    required: boolean;
    content_types: string[];
    preferred_content_type: string | null;
    binary: boolean;
    encoding: ProviderBodyEncoding;
}
export interface ProviderResponseMatcher {
    status: string;
    content_types: string[];
    normalizer: ProviderResponseNormalizer;
}
export interface ProviderAdapterContract {
    id: string;
    version: '0.6.0';
    revision: string;
    provider_kind: 'http_openapi';
    tool_id: string;
    tool_name: string;
    tool_revision: string;
    credential: {
        auth_ref: string | null;
        required_scopes: string[];
    };
    request: {
        method: ProviderHttpMethod;
        path_template: string;
        parameters: ProviderParameterBinding[];
        body: ProviderBodyBinding | null;
        idempotency: {
            mode: 'none' | 'optional' | 'required';
            header_name: 'Idempotency-Key';
        };
    };
    response: {
        success: ProviderResponseMatcher[];
        errors: ProviderResponseMatcher[];
        other: ProviderResponseMatcher[];
    };
    integrity: {
        algorithm: 'sha256';
        digest: string;
    };
}
export interface ProviderAdapterBundle {
    artifact_type: 'provider_adapter_bundle';
    artifact_version: '0.6';
    source_bundle_version: string;
    adapters: ProviderAdapterContract[];
    summary: {
        adapter_count: number;
        authenticated_count: number;
        idempotency_required_count: number;
        body_binding_count: number;
        binary_binding_count: number;
        skipped_tool_count: number;
    };
    warnings: Array<{
        code: string;
        message: string;
        tool_id?: string;
    }>;
    integrity: {
        algorithm: 'sha256';
        digest: string;
    };
}
export interface ProviderPlanOptions {
    baseUrl: string;
    idempotencyKey?: string;
}
export interface ProviderHeaderValue {
    name: string;
    value: string;
}
export interface ProviderQueryValue {
    name: string;
    value: string;
}
export interface ProviderExecutionPlan {
    artifact_type: 'provider_execution_plan';
    artifact_version: '0.6';
    dry_run: true;
    adapter_id: string;
    adapter_revision: string;
    tool_id: string;
    tool_revision: string;
    arguments_hash: string;
    credential_requirement: {
        auth_ref: string | null;
        required_scopes: string[];
        secret_material_included: false;
    };
    request: {
        method: ProviderHttpMethod;
        url: string;
        path: string;
        query: ProviderQueryValue[];
        headers: ProviderHeaderValue[];
        body: {
            content_type: string;
            encoding: ProviderBodyEncoding;
            value: unknown;
        } | null;
    };
    idempotency: {
        mode: 'none' | 'optional' | 'required';
        header_name: 'Idempotency-Key';
        key_source: 'none' | 'provided' | 'dry_run_generated';
        key: string | null;
    };
    response_plan: {
        success_statuses: string[];
        error_statuses: string[];
        other_statuses: string[];
    };
    warnings: Array<{
        code: string;
        message: string;
    }>;
    integrity: {
        algorithm: 'sha256';
        digest: string;
    };
}
export interface ProviderResponseInput {
    status: number;
    headers: Record<string, string>;
    body: unknown;
}
export type ProviderErrorCategory = 'invalid_request' | 'authentication' | 'authorization' | 'not_found' | 'conflict' | 'rate_limited' | 'timeout' | 'provider_unavailable' | 'provider_error';
export interface NormalizedProviderResponse {
    ok: boolean;
    status: number;
    media_type: string | null;
    kind: ProviderResponseNormalizer;
    data: unknown;
    error: {
        code: string;
        category: ProviderErrorCategory;
        message: string;
        retryable: boolean;
        provider_status: number;
    } | null;
}
