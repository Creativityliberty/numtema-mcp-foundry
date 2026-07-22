export interface McpRuntimeConfig {
  artifact_type: 'mcp_runtime_config';
  artifact_version: '1.0';
  server: {
    name: string;
    version: string;
    protocol_version?: string;
    transport: {
      type: 'stdio' | 'streamable_http';
      host?: string;
      port?: number;
      path?: string;
      allowed_origins?: string[];
      bearer_token_env?: string;
      require_mcp_headers?: boolean;
    };
  };
  provider: {
    base_url: string;
    timeout_ms?: number;
  };
  artifacts: {
    contract_bundle: string;
    provider_adapter_bundle: string;
    provider_auth_binding_bundle: string;
    credential_catalog: string;
    runtime_trust_store: string;
    ledger_directory: string;
    approvals_by_tool?: Record<string, string>;
    budgets_by_tool?: Record<string, string>;
  };
  context: {
    subject_ref: string;
    client_ref: string;
    workspace_ref: string;
    provider_ref: string;
    provider_account_ref?: string;
  };
  credentials: {
    environment_by_handle: Record<string, string>;
  };
  signing: {
    policy: { key_id: string; private_key_file: string };
    dispatch: { key_id: string; private_key_file: string };
    execution: { key_id: string; private_key_file: string };
  };
}

export interface McpRuntimeConfigSummary {
  server_name: string;
  server_version: string;
  protocol_version: string;
  transport: 'stdio' | 'streamable_http';
  tool_count: number;
  adapter_count: number;
  authenticated_tool_count: number;
  high_risk_tool_count: number;
  provider_base_url: string;
  ledger_directory: string;
  secrets_in_config: false;
}
