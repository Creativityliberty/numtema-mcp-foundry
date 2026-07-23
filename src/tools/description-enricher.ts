import type { ToolContract } from '../contracts/types.js';
import { toolDomain } from './scope-inference.js';

export function enrichToolDescription(tool: ToolContract): string {
  const action = humanize(tool.name.split('_').slice(1).join(' ') || tool.name);
  const domain = toolDomain(tool).toLowerCase();
  const result = resultSummary(tool.output_schema);
  const effect = tool.effects.writes
    ? `This operation changes ${domain} data${tool.annotations.destructive ? ' and may be destructive' : ''}.`
    : `This operation reads ${domain} data and does not modify the provider.`;
  const use = `Use this tool when the user wants to ${action} ${domain}.`;
  const caution = tool.effects.personal_data ? 'It may return or store personal data, so use only the minimum necessary fields.' : 'Use only the arguments required for the request.';
  return `${sentence(tool.title ?? humanize(tool.name))} ${use} ${result} ${effect} ${caution}`.slice(0, 680);
}

function resultSummary(schema: Record<string, unknown>): string {
  const properties = schema.properties && typeof schema.properties === 'object' && !Array.isArray(schema.properties) ? Object.keys(schema.properties as Record<string, unknown>) : [];
  if (properties.length === 0) return 'It returns the provider response normalized by the runtime.';
  return `It returns ${properties.slice(0, 5).join(', ')}${properties.length > 5 ? ', and related fields' : ''}.`;
}
function humanize(value: string): string { return value.replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim().toLowerCase(); }
function sentence(value: string): string { const text = value.trim().replace(/[.]+$/, ''); return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`; }
