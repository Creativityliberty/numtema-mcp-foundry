import type { ToolContract } from '../contracts/types.js';
import type { ToolApprovalPresentation } from './types.js';
import { toolDomain } from './scope-inference.js';

export function buildApprovalPresentation(tool: ToolContract): ToolApprovalPresentation {
  const risk = riskClass(tool);
  const required = Boolean(tool.approval_ref) || ['R3','R4','R5'].includes(risk) || tool.annotations.destructive || tool.effects.financial || tool.effects.credential_change;
  const title = required ? `Confirm ${humanize(tool.title ?? tool.name)}` : `No approval required for ${humanize(tool.title ?? tool.name)}`;
  const affected = toolDomain(tool);
  const effect = tool.annotations.destructive ? 'This action can remove or invalidate provider data.' : tool.effects.writes ? 'This action will change provider data.' : 'This action only reads provider data.';
  return {
    required,
    mode: required ? (['R4','R5'].includes(risk) ? 'secure_widget' : 'chat_explicit') : 'none',
    title,
    confirmation_text: required ? `${title}? ${effect} Affected resource: ${affected}.` : effect,
    affected_resource: affected,
    reversibility: tool.effects.reversible === true ? 'reversible' : tool.effects.reversible === false || tool.annotations.destructive ? 'irreversible' : 'unknown'
  };
}

function riskClass(tool: ToolContract): string { const foundry = asObject(asObject(tool.extensions).foundry); return typeof foundry.risk_class === 'string' ? foundry.risk_class : 'R1'; }
function asObject(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function humanize(value: string): string { return value.replace(/[_-]+/g, ' ').trim().toLowerCase(); }
