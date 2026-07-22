import { ContractBundleError, indexContractBundle } from '../contracts/contract-bundle.js';
import { createSchemaRegistry } from '../schema/schema-registry.js';
import { sortValidationIssues } from './issues.js';
import { validateContract } from './schema-validator.js';
import { validateSemantics } from './semantic-validator.js';
const COLLECTIONS = [
    { kind: 'tool', key: 'tools' },
    { kind: 'auth', key: 'auth' },
    { kind: 'policy', key: 'policies' },
    { kind: 'approval', key: 'approvals' },
    { kind: 'recovery', key: 'recoveries' },
    { kind: 'receipt', key: 'receipts' },
    { kind: 'artifact', key: 'artifacts' }
];
export async function validateBundle(bundle, options = {}) {
    const registry = await createSchemaRegistry(options.schemaDirectory);
    const structuralIssues = [];
    for (const collection of COLLECTIONS) {
        const values = bundle[collection.key];
        if (!Array.isArray(values))
            continue;
        values.forEach((value, index) => {
            const contractIssues = validateContract(registry, collection.kind, value);
            structuralIssues.push(...contractIssues.map((issue) => ({
                ...issue,
                path: `/${String(collection.key)}/${index}${issue.path}`
            })));
        });
    }
    try {
        indexContractBundle(bundle);
    }
    catch (error) {
        if (error instanceof ContractBundleError) {
            structuralIssues.push({
                code: error.code,
                severity: 'error',
                path: '',
                message: error.message,
                rule: 'CONST-INDEX-001'
            });
        }
        else {
            throw error;
        }
    }
    const semanticIssues = structuralIssues.length === 0 ? validateSemantics(bundle) : [];
    const issues = sortValidationIssues([...structuralIssues, ...semanticIssues]);
    const errorCount = issues.filter((issue) => issue.severity === 'error').length;
    const warningCount = issues.filter((issue) => issue.severity === 'warning').length;
    return {
        valid: errorCount === 0,
        error_count: errorCount,
        warning_count: warningCount,
        issues
    };
}
//# sourceMappingURL=validate-bundle.js.map