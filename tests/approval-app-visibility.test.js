import test from 'node:test';
import assert from 'node:assert/strict';
import { createApprovalToolRegistrations } from '../dist/src/apps/approval-tools.js';
import { createAppResourceRegistry } from '../dist/src/apps/resource-registry.js';
import { APPROVAL_WIDGET_URI } from '../dist/src/apps/approval-widget.js';

test('keeps approval helper tools app-only', () => {
  const tools = createApprovalToolRegistrations();
  const prepare = tools.find((entry) => entry.descriptor.name === 'foundry_approval_prepare').descriptor;
  const confirm = tools.find((entry) => entry.descriptor.name === 'foundry_approval_confirm').descriptor;
  assert.deepEqual(prepare._meta.ui.visibility, ['app']);
  assert.deepEqual(confirm._meta.ui.visibility, ['app']);
  assert.equal(prepare._meta.ui.resourceUri, APPROVAL_WIDGET_URI);
  assert.equal(confirm._meta.ui.resourceUri, APPROVAL_WIDGET_URI);
});

test('publishes a versioned approval resource with a unique domain and modern CSP', () => {
  const registry = createAppResourceRegistry({ widgetDomain: 'https://numtema-mcp-foundry.coolify.dallico.com' });
  const listed = registry.list();
  assert.equal(APPROVAL_WIDGET_URI, 'ui://numtema/approval/v1.5.html');
  assert.equal(listed.resources[0].uri, APPROVAL_WIDGET_URI);
  const resource = registry.read(APPROVAL_WIDGET_URI).contents[0];
  assert.equal(resource._meta.ui.domain, 'https://numtema-mcp-foundry.coolify.dallico.com');
  assert.equal(resource._meta.ui.prefersBorder, true);
  assert.deepEqual(resource._meta.ui.csp, { connectDomains: [], resourceDomains: [] });
  assert.equal(resource._meta['openai/widgetDomain'], 'https://numtema-mcp-foundry.coolify.dallico.com');
});
