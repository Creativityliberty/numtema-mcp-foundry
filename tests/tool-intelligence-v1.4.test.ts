import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { ContractBundle, ToolContract } from '../src/contracts/types.js';
import { enrichToolBundle } from '../src/tools/enrichment-engine.js';
import { createMcpToolRegistry } from '../src/mcp/tool-registry.js';
import { buildStudioProject } from '../src/studio/pipeline-service.js';
import { buildDeploymentPackage } from '../src/studio/deployment-builder.js';
import { runCli } from '../src/cli/foundry-1.4.js';
import type { ProviderAdapterBundle } from '../src/adapters/types.js';

const repositoryRoot = process.cwd();
function customerTool(): ToolContract {
  return {
    id: 'tool:customer_get', name: 'customer_get', version: '1.3.0', title: 'Get customer',
    description: 'GET /customers/{customerId} — Get one customer.',
    input_schema: { type: 'object', properties: { Authorization: { type: 'string' }, 'X-Trace-ID': { type: 'string' }, customerId: { type: 'string', format: 'uuid' } }, required: ['customerId'], additionalProperties: false },
    output_schema: { type: 'object', properties: { id: { type: 'string' }, email: { type: 'string', format: 'email' } }, required: ['id'] },
    annotations: { read_only: true, destructive: false, idempotent: true, open_world: false },
    effects: { writes: false, external_communication: false, financial: false, credential_change: false, personal_data: true, reversible: null },
    execution: { mode: 'synchronous', task_support: 'forbidden', idempotency: 'not_applicable' },
    required_scopes: [], auth_ref: 'auth:provider',
    extensions: { foundry: { source_method: 'get', source_path: '/customers/{customerId}', domain: 'Customers', risk_class: 'R1', parameter_contract: [{ name: 'Authorization', location: 'header' }, { name: 'X-Trace-ID', location: 'header' }, { name: 'customerId', location: 'path' }], response_contract: { errors: [{ status: '404', description: 'Not found' }] } } }
  };
}
function bundle(tool = customerTool()): ContractBundle { return { bundle_version: '0.2', tools: [tool], auth: [], policies: [], approvals: [], recoveries: [], receipts: [], artifacts: [] }; }
function capture(): { io: { out(value: string): void; error(value: string): void }; out: string[]; error: string[] } { const out: string[] = []; const error: string[] = []; return { io: { out: (value) => out.push(value), error: (value) => error.push(value) }, out, error }; }

test('enriches a tool into a premium model-safe contract', () => {
  const result = enrichToolBundle(bundle()); const tool = result.bundle.tools[0]; assert.ok(tool);
  const foundry = tool.extensions?.foundry as Record<string, unknown>;
  const intelligence = foundry.tool_intelligence as { model_input_schema: { properties: Record<string, unknown> }; examples: { valid: unknown[]; rejected: unknown[] }; errors: Array<{ category: string }>; quality: { score: number; status: string } };
  assert.deepEqual(tool.required_scopes, ['customers:read']);
  assert.equal(intelligence.model_input_schema.properties.Authorization, undefined);
  assert.equal(intelligence.model_input_schema.properties['X-Trace-ID'], undefined);
  assert.ok((intelligence.model_input_schema.properties.customerId as { description?: string }).description);
  assert.equal(intelligence.examples.valid.length, 2); assert.equal(intelligence.examples.rejected.length, 1);
  assert.equal(intelligence.errors[0]?.category, 'not_found'); assert.equal(intelligence.quality.score, 100); assert.equal(intelligence.quality.status, 'premium');
});

test('MCP descriptor exposes the enriched input schema and quality metadata', () => {
  const enriched = enrichToolBundle(bundle()).bundle;
  const adapters = { artifact_type: 'provider_adapter_bundle', artifact_version: '0.6', adapters: [{ id: 'adapter:customer_get', tool_id: 'tool:customer_get', tool_name: 'customer_get' }], warnings: [] } as unknown as ProviderAdapterBundle;
  const descriptor = createMcpToolRegistry(enriched, adapters).get('customer_get')?.descriptor; assert.ok(descriptor);
  assert.equal((descriptor.inputSchema.properties as Record<string, unknown>).Authorization, undefined);
  assert.deepEqual(descriptor._meta.requiredScopes, ['customers:read']); assert.equal(descriptor._meta.toolQualityScore, 100); assert.equal(descriptor._meta.toolQualityStatus, 'premium');
});

test('Studio build writes catalog and quality artifacts and deployment package includes them', async () => {
  const root = await mkdtemp(join(tmpdir(), 'foundry-v14-')); const project = join(root, 'project');
  await cp(resolve(repositoryRoot, 'examples/studio/project'), project, { recursive: true });
  const report = await buildStudioProject(project); assert.equal(report.tool_quality.gate.passed, true); assert.ok(report.tool_quality.average_score >= 90);
  const catalog = JSON.parse(await readFile(join(project, 'generated/tool-catalog.json'), 'utf8')) as { summary: { tool_count: number } };
  assert.equal(catalog.summary.tool_count, report.tool_count);
  const manifest = await buildDeploymentPackage(project); assert.equal(manifest.tool_quality.gate.passed, true);
  await readFile(join(project, 'deploy/package/template/artifacts/tool-catalog.json'), 'utf8');
  await readFile(join(project, 'deploy/package/template/artifacts/tool-quality-report.json'), 'utf8');
});

test('tools audit exits non-zero for an incomplete bundle', async () => {
  const root = await mkdtemp(join(tmpdir(), 'foundry-v14-audit-')); const file = join(root, 'bundle.json'); const invalid = customerTool();
  invalid.name = 'INVALID NAME'; delete invalid.title; invalid.description = 'bad'; invalid.output_schema = {}; invalid.extensions = {};
  await writeFile(file, JSON.stringify(bundle(invalid))); const captured = capture(); const code = await runCli(['tools', 'audit', file], captured.io);
  assert.equal(code, 1); assert.match(captured.out[0] ?? '', /TOOLS_AUDIT_FAILED/);
});

test('Studio assets expose the tool quality companion', async () => {
  const companion = await readFile(resolve(repositoryRoot, 'studio/assets/tool-intelligence.js'), 'utf8');
  const index = await readFile(resolve(repositoryRoot, 'studio/index.html'), 'utf8');
  assert.match(companion, /toolCatalog/); assert.match(companion, /toolQuality/); assert.match(companion, /Score qualité/);
  assert.match(companion, /Arguments gérés/); assert.match(companion, /Exemples valides/); assert.match(companion, /Erreurs normalisées/);
  assert.match(companion, /\.quality-badge/); assert.match(companion, /\.tool-intelligence/); assert.match(index, /tool-intelligence\.js/);
});
