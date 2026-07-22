import type { ContractBundle } from '../contracts/types.js';
export interface CompilerOptions {
    version?: `${number}.${number}.${number}`;
    auth_id?: string;
    tenant_resolution?: 'none' | 'optional' | 'required';
}
export interface CompilationSummary {
    tool_count: number;
    auth_count: number;
    policy_count: number;
    approval_count: number;
    recovery_count: number;
    scoped_tool_count: number;
    high_impact_tool_count: number;
}
export interface CompilationWarning {
    code: string;
    message: string;
    capability?: string;
}
export interface CompilationResult {
    bundle: ContractBundle;
    summary: CompilationSummary;
    warnings: CompilationWarning[];
}
