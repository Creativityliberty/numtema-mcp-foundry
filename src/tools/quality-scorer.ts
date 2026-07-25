import type { ToolContract } from '../contracts/types.js';
import type { ToolIntelligence, ToolQualityEntry, ToolQualityStatus } from './types.js';

export function scoreToolQuality(tool: ToolContract, intelligence: Omit<ToolIntelligence, 'quality'>): ToolQualityEntry {
  const issues: string[] = [];
  const visibleProps = objectValue(intelligence.model_input_schema.properties);
  const describedProps = countDescribed(visibleProps);
  const inputCount = countProperties(visibleProps);
  const outputCount = countProperties(objectValue(tool.output_schema.properties));
  const breakdown = {
    name: /^[a-z][a-z0-9_]{0,63}$/.test(tool.name) ? 10 : 0,
    description: tool.description.length >= 120 && /Use this tool when/i.test(tool.description) ? 15 : tool.description.length >= 40 ? 8 : 0,
    input_schema: inputCount === 0 || describedProps === inputCount ? 15 : Math.round(15 * describedProps / Math.max(1, inputCount)),
    output_schema: Object.keys(tool.output_schema).length > 0 && (outputCount > 0 || tool.output_schema.type) ? 10 : 0,
    examples: intelligence.examples.valid.length >= 2 && intelligence.examples.rejected.length >= 1 ? 10 : 0,
    scopes: tool.required_scopes.length > 0 ? 10 : 0,
    governance: governanceScore(tool, intelligence),
    errors: intelligence.errors.length > 0 ? 10 : 0,
    provider_mapping: providerMapping(tool) ? 5 : 0,
    tests: 5
  };
  if (breakdown.name < 10) issues.push('Tool name is not MCP-safe.');
  if (breakdown.description < 15) issues.push('Description is not task-oriented enough.');
  if (breakdown.input_schema < 15) issues.push('Some model arguments lack descriptions.');
  if (breakdown.scopes < 10) issues.push('No effective scope is assigned.');
  if (breakdown.governance < 10) issues.push('Sensitive behavior lacks an approval presentation.');
  const score = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  return { tool_id: tool.id, tool_name: tool.name, score, status: statusFor(score), breakdown, issues };
}
function governanceScore(tool: ToolContract, intelligence: Omit<ToolIntelligence, 'quality'>): number {
  const sensitive = tool.effects.writes || tool.annotations.destructive || tool.effects.financial || tool.effects.credential_change;
  if (!sensitive) return 10;
  const presentation = intelligence.approval;
  return presentation.confirmation_text.trim().length >= 20 && presentation.affected_resource.trim().length > 0 ? 10 : 0;
}
function providerMapping(tool: ToolContract): boolean { const foundry = objectValue(objectValue(tool.extensions).foundry); return typeof foundry.source_method === 'string' && typeof foundry.source_path === 'string'; }
function statusFor(score: number): ToolQualityStatus { if (score >= 95) return 'premium'; if (score >= 85) return 'ready'; if (score >= 70) return 'usable'; if (score >= 50) return 'needs_improvement'; return 'incomplete'; }
function countProperties(value: Record<string, unknown>): number { let count = 0; for (const schema of Object.values(value)) { count += 1; const child = objectValue(objectValue(schema).properties); count += countProperties(child); } return count; }
function countDescribed(value: Record<string, unknown>): number { let count = 0; for (const schema of Object.values(value)) { const obj = objectValue(schema); if (typeof obj.description === 'string' && obj.description.trim()) count += 1; const child = objectValue(obj.properties); count += countDescribed(child); } return count; }
function objectValue(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
