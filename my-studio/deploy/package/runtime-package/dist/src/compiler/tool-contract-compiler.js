import { createHash } from 'node:crypto';
const DEFAULT_VERSION = '0.6.0';
const DEFAULT_AUTH_ID = 'auth:default';
export function compileCapabilityMap(map, options = {}) {
    const version = options.version ?? DEFAULT_VERSION;
    const authId = options.auth_id ?? DEFAULT_AUTH_ID;
    const scopes = uniqueSorted(map.capabilities.flatMap((capability) => capability.required_scopes));
    const auth = scopes.length > 0 ? [createAuthContract(authId, version, scopes, options)] : [];
    const policies = map.capabilities.map((capability) => createPolicyContract(capability, version));
    const approvals = map.capabilities
        .filter((capability) => capability.governance.approval_mode !== 'none')
        .map((capability) => createApprovalContract(capability, version));
    const recoveries = compileRecoveries(map, version);
    const recoveryBySourceOperation = indexRecoveryRefs(map.workflow_hints, map.capabilities, recoveries);
    const tools = map.capabilities.map((capability) => createToolContract(capability, version, scopes.length > 0 && capability.required_scopes.length > 0 ? authId : undefined, recoveryBySourceOperation.get(capability.source_operation_id)));
    const bundle = {
        bundle_version: '0.2',
        tools,
        auth,
        policies,
        approvals,
        recoveries,
        receipts: [],
        artifacts: []
    };
    const warnings = map.capabilities
        .filter((capability) => capability.schema === undefined)
        .map((capability) => ({
        code: 'DRAFT_SCHEMA_FIDELITY',
        message: 'Input and output schemas are conservative drafts because this capability does not retain an OpenAPI schema envelope.',
        capability: capability.name
    }));
    for (const capability of map.capabilities) {
        if (capability.schema && capability.schema.unresolved_refs.length > 0) {
            warnings.push({
                code: 'UNRESOLVED_SCHEMA_REFS',
                message: `Schema retains unresolved references: ${capability.schema.unresolved_refs.join(', ')}.`,
                capability: capability.name
            });
        }
    }
    if (auth.length > 0) {
        warnings.push({
            code: 'AUTH_MODE_INFERRED',
            message: 'Authentication was compiled as host_managed; an Auth Foundry review must select the final provider-specific flow.'
        });
    }
    return {
        bundle,
        summary: {
            tool_count: tools.length,
            auth_count: auth.length,
            policy_count: policies.length,
            approval_count: approvals.length,
            recovery_count: recoveries.length,
            scoped_tool_count: tools.filter((tool) => tool.required_scopes.length > 0).length,
            high_impact_tool_count: tools.filter(isHighImpactTool).length
        },
        warnings
    };
}
function createToolContract(capability, version, authRef, recoveryRef) {
    const policyRef = `policy:${capability.name}`;
    const approvalRef = capability.governance.approval_mode === 'none'
        ? undefined
        : `approval:${capability.name}`;
    const effects = effectsFrom(capability);
    const revision = digest({
        capability,
        version,
        policy_ref: policyRef,
        approval_ref: approvalRef ?? null,
        auth_ref: authRef ?? null,
        recovery_ref: recoveryRef ?? null,
        effects
    });
    const contract = {
        id: `tool:${capability.name}`,
        name: capability.name,
        version,
        revision,
        title: capability.title,
        description: `${capability.description}. Compiled as a governed Nümtema Foundry capability from source operation ${capability.source_operation_id}.`,
        input_schema: createInputSchema(capability),
        output_schema: createOutputSchema(capability),
        annotations: { ...capability.annotations },
        effects,
        execution: { ...capability.execution },
        required_scopes: uniqueSorted(capability.required_scopes),
        policy_ref: policyRef,
        extensions: {
            foundry: {
                source_operation_id: capability.source_operation_id,
                source_method: capability.method,
                source_path: capability.path,
                domain: capability.domain,
                risk_class: capability.risk_class,
                governance_reasons: capability.governance.reasons,
                evidence: capability.evidence,
                schema_fidelity: capability.schema ? 'openapi_enriched' : 'conservative_draft',
                ...(capability.schema ? {
                    parameter_contract: capability.schema.parameters.map(({ name, location, required, deprecated, style, explode }) => ({
                        name, location, required, deprecated,
                        ...(style !== undefined ? { style } : {}),
                        ...(explode !== undefined ? { explode } : {})
                    })),
                    response_contract: {
                        success: capability.schema.success_responses,
                        errors: capability.schema.error_responses,
                        other: capability.schema.other_responses
                    },
                    media_contract: capability.schema.media,
                    pagination_contract: capability.schema.pagination,
                    unresolved_refs: capability.schema.unresolved_refs
                } : {})
            }
        }
    };
    if (authRef)
        contract.auth_ref = authRef;
    if (approvalRef)
        contract.approval_ref = approvalRef;
    if (recoveryRef)
        contract.recovery_ref = recoveryRef;
    return contract;
}
function createAuthContract(id, version, scopes, options) {
    const tenantResolution = options.tenant_resolution ?? 'required';
    const contract = {
        id,
        version,
        transport: 'http',
        mode: 'host_managed',
        required_scopes: scopes,
        optional_scopes: [],
        step_up_authorization: true,
        tenant_resolution: tenantResolution,
        token_passthrough: false,
        extensions: {
            foundry: {
                status: 'draft',
                reason: 'CapabilityMapArtifact exposes scopes but not a provider-specific authorization server.'
            }
        }
    };
    if (tenantResolution === 'required') {
        contract.credential_binding_dimensions = [
            'subject',
            'client',
            'workspace',
            'provider',
            'provider_account',
            'scope_set'
        ];
    }
    else if (tenantResolution === 'optional') {
        contract.credential_binding_dimensions = ['subject', 'client', 'workspace', 'scope_set'];
    }
    return contract;
}
function createPolicyContract(capability, version) {
    return {
        id: `policy:${capability.name}`,
        version,
        risk_class: capability.risk_class,
        default_decision: capability.governance.decision,
        rules: [{
                id: `policy-rule:${capability.name}:reviewed-default`,
                when: {
                    tool_id: `tool:${capability.name}`,
                    risk_class: capability.risk_class
                },
                decision: capability.governance.decision,
                required_scopes: uniqueSorted(capability.required_scopes),
                reason: capability.governance.reasons.join(' ')
            }],
        extensions: {
            foundry: {
                source_operation_id: capability.source_operation_id,
                compiled_from_reviewed_governance: true
            }
        }
    };
}
function createApprovalContract(capability, version) {
    const binding = [
        'subject',
        'client',
        'workspace',
        'tool_id',
        'tool_revision',
        'arguments_hash',
        'risk_summary'
    ];
    if (capability.risk_class === 'R4' || capability.risk_class === 'R5') {
        binding.push('cost_summary');
    }
    binding.push('nonce');
    const mode = capability.governance.approval_mode;
    if (mode === 'none') {
        throw new Error(`Cannot create ApprovalContract for ${capability.name} with mode none.`);
    }
    return {
        id: `approval:${capability.name}`,
        version,
        mode,
        binding,
        ttl_seconds: mode === 'dual_control' ? 300 : 600,
        single_use: true,
        display_fields: [
            'tool_title',
            'risk_summary',
            'argument_summary',
            ...(binding.includes('cost_summary') ? ['cost_summary'] : [])
        ],
        extensions: {
            foundry: {
                tool_id: `tool:${capability.name}`,
                source_operation_id: capability.source_operation_id
            }
        }
    };
}
function compileRecoveries(map, version) {
    const byOperation = new Map(map.capabilities.map((capability) => [capability.source_operation_id, capability]));
    const recoveries = [];
    for (const hint of map.workflow_hints) {
        const first = byOperation.get(hint.steps[0] ?? '');
        const next = byOperation.get(hint.steps[1] ?? '');
        if (!first || !next)
            continue;
        recoveries.push({
            id: `recovery:${first.name}`,
            version,
            routes: [{
                    trigger: recoveryTrigger(hint),
                    next_capability: `tool:${next.name}`,
                    argument_mapping: recoveryArgumentMapping(hint),
                    human_interaction: hint.kind === 'upload_confirm',
                    max_attempts: hint.kind === 'async_create_status' ? 10 : 1,
                    allow_risk_increase: false,
                    allow_scope_increase: false,
                    allow_cost_increase: false
                }],
            extensions: {
                foundry: {
                    workflow_hint_id: hint.id,
                    confidence: hint.confidence,
                    evidence: hint.evidence
                }
            }
        });
    }
    return recoveries.sort((left, right) => left.id.localeCompare(right.id));
}
function indexRecoveryRefs(hints, capabilities, recoveries) {
    const byOperation = new Map(capabilities.map((capability) => [capability.source_operation_id, capability]));
    const available = new Set(recoveries.map((recovery) => recovery.id));
    const result = new Map();
    for (const hint of hints) {
        const first = byOperation.get(hint.steps[0] ?? '');
        if (!first)
            continue;
        const recoveryId = `recovery:${first.name}`;
        if (available.has(recoveryId))
            result.set(first.source_operation_id, recoveryId);
    }
    return result;
}
function recoveryTrigger(hint) {
    return hint.kind === 'async_create_status' ? 'job_queued' : 'upload_completed';
}
function recoveryArgumentMapping(hint) {
    return hint.kind === 'async_create_status'
        ? { job_id: '$result.job_id' }
        : { media_id: '$result.media_id' };
}
function createInputSchema(capability) {
    if (!capability.schema)
        return createConservativeInputSchema(capability);
    const properties = {};
    const required = [];
    const nameCounts = new Map();
    for (const parameter of capability.schema.parameters) {
        nameCounts.set(parameter.name, (nameCounts.get(parameter.name) ?? 0) + 1);
    }
    for (const parameter of capability.schema.parameters) {
        const propertyName = (nameCounts.get(parameter.name) ?? 0) > 1
            ? `${parameter.location}_${parameter.name}`
            : parameter.name;
        const schema = { ...parameter.schema };
        if (parameter.description !== undefined && schema.description === undefined)
            schema.description = parameter.description;
        properties[propertyName] = schema;
        if (parameter.required)
            required.push(propertyName);
    }
    if (capability.schema.request_body) {
        const selected = selectContent(capability.schema.request_body.content);
        properties.body = selected?.schema ?? {};
        if (capability.schema.request_body.required)
            required.push('body');
    }
    return {
        type: 'object',
        properties: sortRecord(properties),
        required: uniqueSorted(required),
        additionalProperties: false
    };
}
function createConservativeInputSchema(capability) {
    const pathParameters = [...capability.path.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]).sort();
    const properties = {};
    for (const parameter of pathParameters) {
        properties[parameter] = {
            type: 'string',
            description: `Path parameter ${parameter} compiled from ${capability.path}.`
        };
    }
    return {
        type: 'object',
        properties,
        required: pathParameters,
        additionalProperties: true,
        description: 'Conservative draft. Additional query, header, and body properties are permitted until OpenAPI schema enrichment.'
    };
}
function createOutputSchema(capability) {
    if (capability.schema) {
        const schemas = capability.schema.success_responses.flatMap((response) => response.content.map((content) => content.schema));
        const uniqueSchemas = deduplicateSchemas(schemas.filter((schema) => Object.keys(schema).length > 0));
        if (uniqueSchemas.length === 1)
            return uniqueSchemas[0];
        if (uniqueSchemas.length > 1)
            return { oneOf: uniqueSchemas };
        if (capability.schema.success_responses.some((response) => response.status === '204'))
            return { type: 'null' };
    }
    if (capability.execution.mode === 'asynchronous') {
        return {
            type: 'object',
            properties: {
                job_id: { type: 'string' },
                status: { type: 'string', enum: ['queued', 'running', 'completed', 'failed'] }
            },
            required: ['job_id', 'status'],
            additionalProperties: true
        };
    }
    return {
        type: 'object',
        additionalProperties: true,
        description: 'Conservative response draft pending full OpenAPI response-schema retention.'
    };
}
function selectContent(contents) {
    const preferences = ['application/json', 'application/problem+json', 'multipart/form-data', 'application/x-www-form-urlencoded', 'application/octet-stream'];
    for (const preference of preferences) {
        const match = contents.find((content) => content.media_type === preference);
        if (match)
            return match;
    }
    return contents[0];
}
function deduplicateSchemas(schemas) {
    const seen = new Set();
    const result = [];
    for (const schema of schemas) {
        const key = stableStringify(schema);
        if (seen.has(key))
            continue;
        seen.add(key);
        result.push(schema);
    }
    return result;
}
function sortRecord(value) {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, value[key]]));
}
function effectsFrom(capability) {
    const codes = new Set(capability.evidence.map((evidence) => evidence.code));
    return {
        writes: !capability.annotations.read_only,
        external_communication: capability.annotations.open_world || codes.has('EXTERNAL_COMMUNICATION_SIGNAL'),
        financial: codes.has('FINANCIAL_SIGNAL') || capability.risk_class === 'R4',
        credential_change: codes.has('CREDENTIAL_SIGNAL') || capability.risk_class === 'R5',
        personal_data: codes.has('PERSONAL_DATA_SIGNAL'),
        reversible: capability.annotations.destructive ? false : null
    };
}
function isHighImpactTool(tool) {
    return tool.annotations.destructive
        || tool.effects.external_communication
        || tool.effects.financial
        || tool.effects.credential_change;
}
function digest(value) {
    return createHash('sha256').update(stableStringify(value)).digest('hex');
}
function stableStringify(value) {
    if (Array.isArray(value))
        return `[${value.map(stableStringify).join(',')}]`;
    if (value !== null && typeof value === 'object') {
        const record = value;
        return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
}
function uniqueSorted(values) {
    return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
//# sourceMappingURL=tool-contract-compiler.js.map