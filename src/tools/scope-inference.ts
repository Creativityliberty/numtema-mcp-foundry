import type { ToolContract } from '../contracts/types.js';

export function inferRequiredScopes(tool: ToolContract): string[] {
  if (tool.required_scopes.length > 0) return [...new Set(tool.required_scopes)].sort();
  const domain = toolDomain(tool).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tools';
  const action = actionFor(tool);
  return [`${domain}:${action}`];
}

export function toolDomain(tool: ToolContract): string {
  const foundry = asObject(asObject(tool.extensions).foundry);
  return typeof foundry.domain === 'string' && foundry.domain.trim() ? foundry.domain.trim() : tool.name.split('_')[0] || 'Tools';
}

function actionFor(tool: ToolContract): string {
  const verb = tool.name.split('_').at(-1)?.toLowerCase() ?? '';
  if (tool.annotations.destructive || /delete|remove|archive|revoke|cancel/.test(verb)) return 'delete';
  if (/approve|refund|publish|send|invite|assign|transfer/.test(verb)) return verb;
  if (tool.effects.writes) return 'write';
  return 'read';
}

function asObject(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
