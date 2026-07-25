import { stat, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { ContractBundle } from '../contracts/types.js';
import { buildStudioProject } from '../studio/pipeline-service.js';
import { enrichToolBundle } from './enrichment-engine.js';
import type { ToolQualityReport } from './types.js';

export async function auditToolTarget(target: string): Promise<ToolQualityReport> {
  const absolute = resolve(target);
  const info = await stat(absolute);
  if (info.isDirectory()) return (await buildStudioProject(absolute) as unknown as { tool_quality: ToolQualityReport }).tool_quality;
  const bundle = JSON.parse(await readFile(absolute, 'utf8')) as ContractBundle;
  return enrichToolBundle(bundle).quality_report;
}

export function assertToolQuality(report: ToolQualityReport, allowIncomplete = false): void {
  if (!allowIncomplete && !report.gate.passed) throw new Error(`TOOL_QUALITY_GATE_FAILED: ${report.gate.failing_tools.join(', ')}`);
}

export function renderToolQualityReport(report: ToolQualityReport): string {
  const status = report.gate.passed ? 'TOOLS_AUDIT_OK' : 'TOOLS_AUDIT_FAILED';
  const premium = report.entries.filter((entry) => entry.status === 'premium').length;
  const ready = report.entries.filter((entry) => entry.status === 'ready').length;
  return `${status}\n- tools: ${report.tool_count}\n- average score: ${report.average_score}\n- minimum score: ${report.minimum_score}\n- premium: ${premium}\n- ready: ${ready}\n- failing: ${report.gate.failing_tools.length ? report.gate.failing_tools.join(', ') : 'none'}`;
}
