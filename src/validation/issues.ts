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

const CODE_PRIORITY: Record<string, number> = {
  SCHEMA_MIN_LENGTH: 10,
  SCHEMA_REQUIRED: 20,
  SCHEMA_PATTERN: 30
};

export function sortValidationIssues(issues: ValidationIssue[]): ValidationIssue[] {
  return [...issues].sort((left, right) => {
    const leftPriority = CODE_PRIORITY[left.code] ?? 100;
    const rightPriority = CODE_PRIORITY[right.code] ?? 100;
    return (
      leftPriority - rightPriority ||
      left.path.localeCompare(right.path) ||
      left.code.localeCompare(right.code) ||
      left.message.localeCompare(right.message)
    );
  });
}
