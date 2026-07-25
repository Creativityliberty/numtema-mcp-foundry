import type { ToolContract } from '../contracts/types.js';
import type { ToolExampleSet } from './types.js';

type Schema = Record<string, unknown>;
export function generateToolExamples(tool: ToolContract, modelSchema: Schema): ToolExampleSet {
  const minimal = exampleForSchema(modelSchema, false) as Record<string, unknown>;
  const realistic = exampleForSchema(modelSchema, true) as Record<string, unknown>;
  const required = Array.isArray(modelSchema.required) ? modelSchema.required.filter((value): value is string => typeof value === 'string') : [];
  const rejected = structuredClone(minimal);
  if (required[0]) delete rejected[required[0]]; else rejected.__unexpected = 'rejected';
  return {
    artifact_type: 'tool_example_set', artifact_version: '1.0', tool_id: tool.id,
    valid: [{ name: 'minimal', arguments: minimal }, { name: 'realistic', arguments: realistic }],
    rejected: [{ name: 'missing required input', arguments: rejected, reason: required[0] ? `Missing required property ${required[0]}.` : 'Contains an unexpected property.' }]
  };
}

function exampleForSchema(schema: Schema, realistic: boolean): unknown {
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return schema.enum[0];
  if ('example' in schema) return structuredClone(schema.example);
  const type = Array.isArray(schema.type) ? schema.type.find((value) => value !== 'null') : schema.type;
  if (type === 'object' || schema.properties) {
    const output: Record<string, unknown> = {};
    const props = asObject(schema.properties);
    const required = new Set(Array.isArray(schema.required) ? schema.required.filter((value): value is string => typeof value === 'string') : []);
    for (const [name, child] of Object.entries(props)) {
      if (required.has(name) || realistic) output[name] = valueForName(name, asObject(child), realistic);
    }
    return output;
  }
  if (type === 'array') return realistic ? [exampleForSchema(asObject(schema.items), realistic)] : [];
  if (type === 'integer' || type === 'number') return typeof schema.default === 'number' ? schema.default : realistic ? 20 : 1;
  if (type === 'boolean') return realistic;
  return realistic ? 'example' : 'value';
}
function valueForName(name: string, schema: Schema, realistic: boolean): unknown {
  if (schema.format === 'uuid' || /(^|_)id$/i.test(name) || /Id$/.test(name)) return '8bd4d2d2-3acf-41ab-9334-6769150c1141';
  if (schema.format === 'email' || /email/i.test(name)) return 'customer@example.com';
  if (/name/i.test(name)) return realistic ? 'Alice Martin' : 'Alice';
  if (/cursor/i.test(name)) return realistic ? 'cursor_next_page' : 'cursor_1';
  return exampleForSchema(schema, realistic);
}
function asObject(value: unknown): Schema { return value && typeof value === 'object' && !Array.isArray(value) ? value as Schema : {}; }
