import type { PolicyDecision, RiskClass } from '../contracts/types.js';

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options' | 'trace';
export type JsonSchemaObject = Record<string, unknown>;

export interface OpenApiInfo {
  title: string;
  version: string;
  description?: string;
}

export interface OpenApiDocument {
  openapi: string;
  info: OpenApiInfo;
  paths: Record<string, unknown>;
  servers?: Array<{ url?: string; description?: string }>;
  security?: Array<Record<string, string[]>>;
  components?: {
    securitySchemes?: Record<string, unknown>;
    [key: string]: unknown;
  };
  webhooks?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface InspectionEvidence {
  code: string;
  message: string;
  source: 'http_method' | 'operation_metadata' | 'parameter' | 'request_body' | 'response' | 'security' | 'callback' | 'path';
}

export interface InspectedParameter {
  name: string;
  location: string;
  required: boolean;
}

export interface NormalizedParameter extends InspectedParameter {
  schema: JsonSchemaObject;
  description?: string;
  deprecated: boolean;
  style?: string;
  explode?: boolean;
}

export interface SchemaContent {
  media_type: string;
  schema: JsonSchemaObject;
}

export interface RequestBodyInspection {
  required: boolean;
  content: SchemaContent[];
  description?: string;
}

export interface ResponseHeaderInspection {
  name: string;
  required: boolean;
  schema: JsonSchemaObject;
  description?: string;
}

export interface ResponseInspection {
  status: string;
  description: string;
  content: SchemaContent[];
  headers: ResponseHeaderInspection[];
}

export interface OperationSchemaEnvelope {
  parameters: NormalizedParameter[];
  request_body?: RequestBodyInspection;
  success_responses: ResponseInspection[];
  error_responses: ResponseInspection[];
  other_responses: ResponseInspection[];
  media: {
    request_content_types: string[];
    response_content_types: string[];
    binary_request: boolean;
    binary_response: boolean;
  };
  pagination: {
    style: 'none' | 'cursor' | 'offset' | 'page';
    request_parameters: string[];
    response_fields: string[];
  };
  unresolved_refs: string[];
}

export interface OperationSignals {
  read_only: boolean;
  writes: boolean;
  destructive: boolean;
  financial: boolean;
  external_communication: boolean;
  credential_change: boolean;
  personal_data: boolean;
  asynchronous: boolean;
  callback_or_webhook: boolean;
  upload: boolean;
  download: boolean;
}

export interface OperationInspection {
  operation_id: string;
  method: HttpMethod;
  path: string;
  summary: string;
  description?: string;
  tags: string[];
  domain: string;
  parameters: InspectedParameter[];
  request_content_types: string[];
  response_statuses: string[];
  response_content_types: string[];
  auth: {
    required: boolean;
    inherited: boolean;
    schemes: string[];
    required_scopes: string[];
  };
  pagination: {
    detected: boolean;
    style: 'none' | 'cursor' | 'offset' | 'page';
    parameters: string[];
  };
  signals: OperationSignals;
  evidence: InspectionEvidence[];
  schema?: OperationSchemaEnvelope;
}

export interface SecuritySchemeInspection {
  name: string;
  type: string;
  scopes: string[];
}

export interface SourceInspectionArtifact {
  artifact_type: 'source_inspection';
  artifact_version: '0.3';
  source: {
    ref: string;
    kind: 'openapi';
    openapi_version: string;
    title: string;
    version: string;
    servers: string[];
  };
  summary: {
    operation_count: number;
    security_scheme_count: number;
    authenticated_operation_count: number;
    asynchronous_operation_count: number;
    high_signal_operation_count: number;
    domains: string[];
  };
  security_schemes: SecuritySchemeInspection[];
  operations: OperationInspection[];
  limitations: string[];
}

export interface CapabilityGovernance {
  decision: PolicyDecision;
  approval_mode: 'none' | 'chat_explicit' | 'secure_widget' | 'approver' | 'dual_control';
  reasons: string[];
}

export interface CapabilityCandidate {
  id: string;
  name: string;
  title: string;
  description: string;
  source_operation_id: string;
  domain: string;
  method: HttpMethod;
  path: string;
  risk_class: RiskClass;
  governance: CapabilityGovernance;
  required_scopes: string[];
  annotations: {
    read_only: boolean;
    destructive: boolean;
    idempotent: boolean;
    open_world: boolean;
  };
  execution: {
    mode: 'synchronous' | 'asynchronous';
    task_support: 'forbidden' | 'required';
    idempotency: 'not_applicable' | 'supported' | 'required';
  };
  evidence: InspectionEvidence[];
  schema?: OperationSchemaEnvelope;
}

export interface CapabilityDomain {
  name: string;
  capability_names: string[];
  operation_count: number;
}

export interface WorkflowHint {
  id: string;
  kind: 'async_create_status' | 'upload_confirm';
  domain: string;
  steps: string[];
  confidence: 'medium' | 'high';
  evidence: string[];
}

export interface CapabilityMapArtifact {
  artifact_type: 'capability_map';
  artifact_version: '0.3';
  source_ref: string;
  source_title: string;
  domains: CapabilityDomain[];
  capabilities: CapabilityCandidate[];
  workflow_hints: WorkflowHint[];
  summary: {
    capability_count: number;
    workflow_hint_count: number;
    risk_counts: Record<RiskClass, number>;
    approval_required_count: number;
  };
  limitations: string[];
}
