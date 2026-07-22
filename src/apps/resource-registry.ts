import type { McpResourceRegistry } from '../mcp/types.js';
import { APPROVAL_WIDGET_URI, renderApprovalWidget } from './approval-widget.js';

export function createAppResourceRegistry(): McpResourceRegistry {
  const descriptor = {
    uri: APPROVAL_WIDGET_URI,
    name: 'numtema-secure-approval',
    title: 'Nümtema Secure Approval',
    description: 'Review, approve, and execute an exact high-risk tool call.',
    mimeType: 'text/html;profile=mcp-app',
    _meta: { 'openai/widgetDescription': 'Secure approval card for governed tool calls.', 'openai/widgetPrefersBorder': true }
  };
  return {
    list(cursor) {
      if (cursor !== undefined) throw new Error('INVALID_CURSOR');
      return { resources: [descriptor] };
    },
    read(uri) {
      if (uri !== APPROVAL_WIDGET_URI) return undefined;
      return { contents: [{ uri, mimeType: descriptor.mimeType, text: renderApprovalWidget(), _meta: {
        'openai/widgetDescription': descriptor._meta['openai/widgetDescription'],
        'openai/widgetPrefersBorder': true,
        'openai/widgetCSP': { connect_domains: [], resource_domains: [] }
      } }] };
    }
  };
}
