import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import { compileProviderAdapters } from '../src/adapters/provider-adapter-compiler.js';
import { planProviderRequest } from '../src/adapters/request-planner.js';
import { loadContractBundle } from '../src/contracts/contract-bundle.js';
import { validateValueAgainstSchema } from '../src/validation/schema-validator.js';

describe('Provider artifact schemas', () => {
  it('validates generated adapter bundles and dry-run execution plans', async () => {
    const bundle = await loadContractBundle('examples/contract-bundle.schema-rich.generated.json');
    const adapters = compileProviderAdapters(bundle);
    const adapterSchema = JSON.parse(await readFile('schemas/provider-adapter-bundle.schema.json', 'utf8')) as Record<string, unknown>;
    assert.deepEqual(validateValueAgainstSchema(adapterSchema, adapters, 'provider_adapter_bundle'), []);

    const customerGet = adapters.adapters.find((adapter) => adapter.tool_name === 'customer_get');
    assert.ok(customerGet);
    const plan = planProviderRequest(customerGet, { customerId: 'customer-7' }, { baseUrl: 'https://api.example.test' });
    const planSchema = JSON.parse(await readFile('schemas/provider-execution-plan.schema.json', 'utf8')) as Record<string, unknown>;
    assert.deepEqual(validateValueAgainstSchema(planSchema, plan, 'provider_execution_plan'), []);
  });
});
