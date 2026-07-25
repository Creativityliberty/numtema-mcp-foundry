// @ts-nocheck -- v1.5 source bridge; behavior is covered by executable integration tests.
import { APPROVAL_WIDGET_URI, renderApprovalWidget } from './approval-widget.js';
export function createAppResourceRegistry(options = {}) {
    const widgetDomain = normalizeDomain(options.widgetDomain ?? process.env.PUBLIC_BASE_URL ?? 'https://numtema-mcp-foundry.coolify.dallico.com');
    const ui = { domain: widgetDomain, prefersBorder: true, csp: { connectDomains: [], resourceDomains: [] } };
    const descriptor = {
        uri: APPROVAL_WIDGET_URI,
        name: 'numtema-secure-approval',
        title: 'Nümtema Secure Approval',
        description: 'Review, approve, and execute one exact governed tool call.',
        mimeType: 'text/html;profile=mcp-app',
        _meta: {
            ui,
            'openai/widgetDescription': 'Secure approval card for governed tool calls.',
            'openai/widgetPrefersBorder': true,
            'openai/widgetDomain': widgetDomain,
            'openai/widgetCSP': { connect_domains: [], resource_domains: [] }
        }
    };
    return {
        list(cursor) {
            if (cursor !== undefined) throw new Error('INVALID_CURSOR');
            return { resources: [descriptor] };
        },
        read(uri) {
            if (uri !== APPROVAL_WIDGET_URI) return undefined;
            return { contents: [{ uri, mimeType: descriptor.mimeType, text: renderApprovalWidget(), _meta: { ...descriptor._meta } }] };
        }
    };
}
function normalizeDomain(value) {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') throw new Error('INVALID_WIDGET_DOMAIN');
    return `${url.protocol}//${url.host}`;
}
