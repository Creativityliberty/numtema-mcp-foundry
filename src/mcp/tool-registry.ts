// @ts-nocheck -- v1.5 source bridge; behavior is covered by executable integration tests.
import { APPROVAL_WIDGET_URI } from '../apps/approval-widget.js';
const DEFAULT_PAGE_SIZE = 100;
export function createMcpToolRegistry(bundle, adapters, pageSize = DEFAULT_PAGE_SIZE, extraTools = []) {
    const adapterByTool = new Map(adapters.adapters.map((adapter) => [adapter.tool_id, adapter]));
    const registrations = [...bundle.tools.map((tool) => ({ descriptor: descriptorFromTool(tool), toolId: tool.id, adapterId: adapterByTool.get(tool.id)?.id ?? null })), ...extraTools]
        .sort((left, right) => left.descriptor.name.localeCompare(right.descriptor.name));
    const byName = new Map(registrations.map((registration) => [registration.descriptor.name, registration]));
    return {
        list(cursor) {
            const offset = decodeCursor(cursor);
            const page = registrations.slice(offset, offset + pageSize).map((entry) => entry.descriptor);
            const next = offset + page.length;
            return next < registrations.length ? { tools: page, nextCursor: encodeCursor(next) } : { tools: page };
        },
        get(name) { return byName.get(name); }
    };
}
function descriptorFromTool(tool) {
    const riskClass = foundryRiskClass(tool);
    const intelligence = foundryToolIntelligence(tool);
    return {
        name: tool.name,
        ...(tool.title ? { title: tool.title } : {}),
        description: tool.description,
        inputSchema: intelligence?.model_input_schema ?? tool.input_schema,
        outputSchema: tool.output_schema,
        annotations: {
            readOnlyHint: tool.annotations.read_only,
            destructiveHint: tool.annotations.destructive,
            idempotentHint: tool.annotations.idempotent,
            openWorldHint: tool.annotations.open_world
        },
        _meta: {
            toolId: tool.id,
            toolRevision: tool.revision ?? null,
            riskClass,
            approvalRequired: tool.approval_ref !== undefined,
            requiredScopes: [...tool.required_scopes].sort(),
            ...(intelligence?.quality ? { toolQualityScore: intelligence.quality.score, toolQualityStatus: intelligence.quality.status } : {}),
            ...(tool.approval_ref === undefined ? {} : {
                ui: { resourceUri: APPROVAL_WIDGET_URI, visibility: ['model'] },
                'ui.resourceUri': APPROVAL_WIDGET_URI,
                'openai/outputTemplate': APPROVAL_WIDGET_URI,
                'openai/widgetAccessible': true,
                'openai/toolInvocation/invoking': 'Waiting for secure approval…',
                'openai/toolInvocation/invoked': 'Governed action completed.'
            })
        }
    };
}
function foundryToolIntelligence(tool) {
    const foundry = tool.extensions?.foundry;
    if (typeof foundry !== 'object' || foundry === null || Array.isArray(foundry)) return undefined;
    const value = foundry.tool_intelligence;
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : undefined;
}
function foundryRiskClass(tool) {
    const foundry = tool.extensions?.foundry;
    if (typeof foundry === 'object' && foundry !== null && !Array.isArray(foundry)) {
        const value = foundry.risk_class;
        if (typeof value === 'string') return value;
    }
    return 'R0';
}
function encodeCursor(offset) { return Buffer.from(String(offset), 'utf8').toString('base64'); }
function decodeCursor(cursor) {
    if (cursor === undefined) return 0;
    const decoded = Number(Buffer.from(cursor, 'base64').toString('utf8'));
    if (!Number.isInteger(decoded) || decoded < 0) throw new Error('INVALID_CURSOR');
    return decoded;
}
