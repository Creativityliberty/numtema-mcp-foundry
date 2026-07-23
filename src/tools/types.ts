import type { ContractBundle, ToolContract } from '../contracts/types.js';

export type ToolArgumentClass = 'model_argument' | 'runtime_managed' | 'credential_managed' | 'server_default' | 'hidden_internal';
export interface ToolArgumentClassification { name: string; classification: ToolArgumentClass; reason: string; location?: string; required: boolean; }
export interface ToolExampleSet { artifact_type: 'tool_example_set'; artifact_version: '1.0'; tool_id: string; valid: Array<{ name: string; arguments: Record<string, unknown> }>; rejected: Array<{ name: string; arguments: Record<string, unknown>; reason: string }>; }
export type ToolErrorCategory = 'validation' | 'authentication' | 'authorization' | 'not_found' | 'conflict' | 'rate_limit' | 'provider_error' | 'network_error' | 'timeout' | 'unknown';
export interface ToolErrorContract { code: string; category: ToolErrorCategory; retryable: boolean; user_message: string; technical_message: string; source_status?: string; schema?: Record<string, unknown>; }
export interface ToolApprovalPresentation { required: boolean; mode: 'none' | 'chat_explicit' | 'secure_widget' | 'approver'; title: string; confirmation_text: string; affected_resource: string; reversibility: 'reversible' | 'unknown' | 'irreversible'; }
export interface ToolIntelligence { artifact_version: '1.0'; model_input_schema: Record<string, unknown>; arguments: ToolArgumentClassification[]; examples: ToolExampleSet; errors: ToolErrorContract[]; approval: ToolApprovalPresentation; effective_scopes: string[]; quality: ToolQualityEntry; }
export type ToolQualityStatus = 'incomplete' | 'needs_improvement' | 'usable' | 'ready' | 'premium';
export interface ToolQualityEntry { tool_id: string; tool_name: string; score: number; status: ToolQualityStatus; breakdown: { name: number; description: number; input_schema: number; output_schema: number; examples: number; scopes: number; governance: number; errors: number; provider_mapping: number; tests: number; }; issues: string[]; }
export interface ToolQualityReport { artifact_type: 'tool_quality_report'; artifact_version: '1.0'; tool_count: number; average_score: number; minimum_score: number; entries: ToolQualityEntry[]; gate: { threshold: 85; passed: boolean; failing_tools: string[] }; }
export interface ToolCatalog { artifact_type: 'tool_catalog'; artifact_version: '1.0'; summary: { tool_count: number; domain_count: number; average_score: number; premium: number; ready: number; usable: number; incomplete: number }; domains: Array<{ name: string; tools: Array<{ id: string; name: string; title: string; description: string; risk_class: string; scopes: string[]; score: number; status: ToolQualityStatus }> }>; }
export interface EnrichedToolBundle { bundle: ContractBundle; quality_report: ToolQualityReport; catalog: ToolCatalog; }
export type MutableToolContract = ToolContract & { extensions?: Record<string, unknown> };
