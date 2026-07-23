import type { ContractBundle, ToolContract } from '../contracts/types.js';
import type { ToolCatalog, ToolIntelligence, ToolQualityEntry, ToolQualityReport } from './types.js';
import { toolDomain } from './scope-inference.js';

export function buildQualityReport(entries: ToolQualityEntry[]): ToolQualityReport {
  const scores = entries.map((entry) => entry.score);
  const failing = entries.filter((entry) => entry.score < 85).map((entry) => entry.tool_name).sort();
  return { artifact_type: 'tool_quality_report', artifact_version: '1.0', tool_count: entries.length, average_score: entries.length ? round(scores.reduce((a,b) => a+b,0) / entries.length) : 0, minimum_score: entries.length ? Math.min(...scores) : 0, entries: [...entries].sort((a,b) => a.tool_name.localeCompare(b.tool_name)), gate: { threshold: 85, passed: failing.length === 0, failing_tools: failing } };
}

export function buildToolCatalog(bundle: ContractBundle): ToolCatalog {
  const groups = new Map<string, ToolContract[]>();
  for (const tool of bundle.tools) { const domain = toolDomain(tool); groups.set(domain, [...(groups.get(domain) ?? []), tool]); }
  const entries = bundle.tools.map((tool) => intelligence(tool)?.quality).filter((value): value is ToolQualityEntry => Boolean(value));
  const report = buildQualityReport(entries);
  const domains = [...groups.entries()].sort(([a],[b]) => a.localeCompare(b)).map(([name, tools]) => ({ name, tools: tools.sort((a,b) => a.name.localeCompare(b.name)).map((tool) => { const intel = intelligence(tool); const foundry = asObject(asObject(tool.extensions).foundry); return { id: tool.id, name: tool.name, title: tool.title ?? tool.name, description: tool.description, risk_class: typeof foundry.risk_class === 'string' ? foundry.risk_class : 'R1', scopes: [...tool.required_scopes], score: intel?.quality.score ?? 0, status: intel?.quality.status ?? 'incomplete' }; }) }));
  return { artifact_type: 'tool_catalog', artifact_version: '1.0', summary: { tool_count: bundle.tools.length, domain_count: domains.length, average_score: report.average_score, premium: entries.filter((e) => e.status === 'premium').length, ready: entries.filter((e) => e.status === 'ready').length, usable: entries.filter((e) => e.status === 'usable').length, incomplete: entries.filter((e) => e.status === 'incomplete' || e.status === 'needs_improvement').length }, domains };
}
function intelligence(tool: ToolContract): ToolIntelligence | undefined { const foundry = asObject(asObject(tool.extensions).foundry); return asObject(foundry.tool_intelligence) as unknown as ToolIntelligence | undefined; }
function asObject(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function round(value: number): number { return Math.round(value * 100) / 100; }
