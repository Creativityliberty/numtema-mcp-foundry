import test from 'node:test';
import assert from 'node:assert/strict';
import { loadOpenApiDocument } from '../dist/src/inspection/openapi-loader.js';
import { inspectOpenApi } from '../dist/src/inspection/source-inspector.js';
import { mapCapabilities } from '../dist/src/mapping/capability-mapper.js';
import { compileCapabilityMap } from '../dist/src/compiler/tool-contract-compiler.js';
import { compileProviderAdapters } from '../dist/src/adapters/provider-adapter-compiler.js';
import { enrichToolBundle } from '../dist/src/tools/enrichment-engine.js';
import {
  applyWhatsAppProviderPack,
  applyWhatsAppAdapterPack,
  resolveWhatsAppRuntimeArguments,
  WHATSAPP_TOOL_NAMES
} from '../dist/src/providers/whatsapp/provider-pack.js';

async function compilePack() {
  const document = await loadOpenApiDocument('providers/whatsapp-cloud-api/openapi.json');
  const inspection = inspectOpenApi(document, 'providers/whatsapp-cloud-api/openapi.json');
  const map = mapCapabilities(inspection);
  const compilation = compileCapabilityMap(map, { version: '1.5.0', auth_id: 'auth:provider', tenant_resolution: 'required' });
  const enriched = applyWhatsAppProviderPack(enrichToolBundle(compilation.bundle));
  const adapters = applyWhatsAppAdapterPack(compileProviderAdapters(enriched.bundle));
  return { enriched, adapters };
}

test('compiles exactly ten WhatsApp business tools and no demonstration tools', async () => {
  const { enriched } = await compilePack();
  const names = enriched.bundle.tools.map((tool) => tool.name).sort();
  assert.deepEqual(names, [...WHATSAPP_TOOL_NAMES].sort());
  assert.equal(names.some((name) => name.startsWith('customer_')), false);
  assert.equal(names.includes('file_upload'), false);
  assert.equal(enriched.quality_report.tool_count, 10);
  assert.ok(enriched.quality_report.minimum_score >= 90);
});

test('exposes model-safe WhatsApp schemas while keeping Meta identifiers runtime-managed', async () => {
  const { enriched } = await compilePack();
  for (const tool of enriched.bundle.tools) {
    const intelligence = tool.extensions.foundry.tool_intelligence;
    const schemaText = JSON.stringify(intelligence.model_input_schema);
    assert.doesNotMatch(schemaText, /graph_api_version|phone_number_id|waba_id|authorization|access_token|trace/i);
    assert.ok(tool.required_scopes.length > 0, `${tool.name} has scopes`);
  }
  const send = enriched.bundle.tools.find((tool) => tool.name === 'whatsapp_message_send_text');
  assert.deepEqual(Object.keys(send.extensions.foundry.tool_intelligence.model_input_schema.properties).sort(), ['message', 'preview_url', 'to']);
  assert.equal(send.extensions.foundry.risk_class, 'R3');
  assert.equal(send.extensions.foundry.tool_intelligence.approval.required, true);
});

test('rewrites generated adapters to official Meta Graph API routes', async () => {
  const { adapters } = await compilePack();
  const text = adapters.adapters.find((adapter) => adapter.tool_name === 'whatsapp_message_send_text');
  const templates = adapters.adapters.find((adapter) => adapter.tool_name === 'whatsapp_template_list');
  assert.equal(text.request.path_template, '/{graph_api_version}/{phone_number_id}/messages');
  assert.equal(templates.request.path_template, '/{graph_api_version}/{waba_id}/message_templates');
});

test('resolves WhatsApp runtime arguments without exposing secret material', async () => {
  const { enriched } = await compilePack();
  const tool = enriched.bundle.tools.find((item) => item.name === 'whatsapp_message_send_text');
  const resolved = resolveWhatsAppRuntimeArguments(tool, { to: '33600000000', message: 'Bonjour', preview_url: false }, {
    WHATSAPP_GRAPH_API_VERSION: 'v23.0',
    WHATSAPP_PHONE_NUMBER_ID: '1234567890',
    WHATSAPP_BUSINESS_ACCOUNT_ID: '9876543210'
  });
  assert.equal(resolved.graph_api_version, 'v23.0');
  assert.equal(resolved.phone_number_id, '1234567890');
  assert.deepEqual(resolved.body, {
    messaging_product: 'whatsapp', recipient_type: 'individual', to: '33600000000', type: 'text',
    text: { body: 'Bonjour', preview_url: false }
  });
  assert.doesNotMatch(JSON.stringify(resolved), /token|secret|authorization/i);
});
