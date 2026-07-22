export type ValidationSeverity = 'error' | 'warning';
export interface ValidationIssue {
    code: string;
    severity: ValidationSeverity;
    path: string;
    message: string;
    contract_kind?: string;
    contract_id?: string;
    rule?: string;
}
export interface ValidationReport {
    valid: boolean;
    error_count: number;
    warning_count: number;
    issues: ValidationIssue[];
}
export declare function sortValidationIssues(issues: ValidationIssue[]): ValidationIssue[];
