import type { PolicyDecision, RiskClass } from '../contracts/types.js';
import type { CapabilityCandidate, CapabilityMapArtifact } from '../inspection/types.js';
import type { StudioToolOverride } from './types.js';

const RISK_ORDER: Record<RiskClass, number> = { R0: 0, R1: 1, R2: 2, R3: 3, R4: 4, R5: 5 };
const APPROVAL_ORDER = { none: 0, chat_explicit: 1, secure_widget: 2, approver: 3, dual_control: 4 } as const;

export function applyStudioOverrides(map: CapabilityMapArtifact, overrides: StudioToolOverride[]): CapabilityMapArtifact {
  const byOperation = new Map(overrides.map((override) => [override.source_operation_id, override]));
  const capabilities: CapabilityCandidate[] = [];
  const names = new Set<string>();
  for (const original of map.capabilities) {
    const override = byOperation.get(original.source_operation_id);
    if (override?.enabled === false) continue;
    const next = applyOverride(original, override);
    if (names.has(next.name)) throw new Error(`STUDIO_OVERRIDE_DUPLICATE_NAME: ${next.name}`);
    names.add(next.name);
    capabilities.push(next);
  }
  const capabilityNames = new Set(capabilities.map((item) => item.name));
  const domains = map.domains.map((domain) => ({
    ...domain,
    capability_names: domain.capability_names.filter((name) => capabilityNames.has(name) || capabilities.some((item) => item.domain === domain.name && item.name === name)),
    operation_count: capabilities.filter((item) => item.domain === domain.name).length
  })).filter((domain) => domain.operation_count > 0);
  const riskCounts: Record<RiskClass, number> = { R0: 0, R1: 0, R2: 0, R3: 0, R4: 0, R5: 0 };
  for (const capability of capabilities) riskCounts[capability.risk_class] += 1;
  return {
    ...map,
    capabilities,
    domains: domains.map((domain) => ({ ...domain, capability_names: capabilities.filter((item) => item.domain === domain.name).map((item) => item.name).sort() })),
    workflow_hints: map.workflow_hints.filter((hint) => hint.steps.every((operation) => capabilities.some((item) => item.source_operation_id === operation))),
    summary: {
      capability_count: capabilities.length,
      workflow_hint_count: map.workflow_hints.length,
      risk_counts: riskCounts,
      approval_required_count: capabilities.filter((item) => item.governance.approval_mode !== 'none').length
    }
  };
}

function applyOverride(original: CapabilityCandidate, override: StudioToolOverride | undefined): CapabilityCandidate {
  if (!override) return structuredCloneCandidate(original);
  const risk = override.risk_class ?? original.risk_class;
  if (RISK_ORDER[risk] < RISK_ORDER[original.risk_class]) throw new Error(`STUDIO_RISK_DOWNGRADE_FORBIDDEN: ${original.name} ${original.risk_class} -> ${risk}`);
  const approval = override.approval_mode ?? original.governance.approval_mode;
  if (APPROVAL_ORDER[approval] < APPROVAL_ORDER[original.governance.approval_mode]) throw new Error(`STUDIO_APPROVAL_DOWNGRADE_FORBIDDEN: ${original.name}`);
  const name = override.name?.trim() || original.name;
  if (!/^[a-z][a-z0-9_]{1,63}$/.test(name)) throw new Error(`STUDIO_TOOL_NAME_INVALID: ${name}`);
  const scopes = [...new Set([...original.required_scopes, ...(override.required_scopes ?? [])])].sort();
  return {
    ...structuredCloneCandidate(original),
    id: `capability:${name}`,
    name,
    title: override.title?.trim() || original.title,
    description: override.description?.trim() || original.description,
    risk_class: risk,
    required_scopes: scopes,
    governance: {
      decision: decisionForApproval(approval, scopes),
      approval_mode: approval,
      reasons: [...original.governance.reasons, 'Reviewed in Foundry Studio.']
    }
  };
}

function decisionForApproval(approval: CapabilityCandidate['governance']['approval_mode'], scopes: string[]): PolicyDecision {
  if (approval === 'chat_explicit') return 'require_confirmation';
  if (approval === 'secure_widget') return 'require_widget';
  if (approval === 'approver' || approval === 'dual_control') return 'require_approver';
  return scopes.length > 0 ? 'require_scope' : 'allow';
}

function structuredCloneCandidate(value: CapabilityCandidate): CapabilityCandidate {
  return JSON.parse(JSON.stringify(value)) as CapabilityCandidate;
}
