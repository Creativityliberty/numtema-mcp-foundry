import type { OAuthClient, OAuthUser, OAuthWorkspace } from '../oauth/types.js';

export interface ChatGptAppConfig {
  artifact_type: 'chatgpt_app_config';
  artifact_version: '1.1';
  runtime_config: string;
  public_base_url: string;
  server: {
    host: string;
    port: number;
    mcp_path: string;
    allowed_origins: string[];
    require_mcp_headers?: boolean;
    tls?: { certificate_file: string; private_key_file: string };
  };
  oauth: {
    issuer?: string;
    resource?: string;
    storage_directory: string;
    signing_key_id: string;
    private_key_file: string;
    public_key_file: string;
    scopes_supported: string[];
    baseline_scopes: string[];
    access_token_ttl_seconds: number;
    refresh_token_ttl_seconds: number;
    authorization_code_ttl_seconds: number;
    allow_dynamic_client_registration: boolean;
    users: OAuthUser[];
    workspaces: OAuthWorkspace[];
    clients: OAuthClient[];
  };
  approvals: {
    storage_directory: string;
    signing_key_id: string;
    private_key_file: string;
  };
}

export interface ChatGptAppSummary {
  app_name: string;
  app_version: string;
  public_base_url: string;
  mcp_endpoint: string;
  oauth_issuer: string;
  oauth_resource: string;
  tool_count: number;
  resource_count: number;
  user_count: number;
  workspace_count: number;
  dynamic_client_registration: boolean;
  secrets_in_config: false;
}
