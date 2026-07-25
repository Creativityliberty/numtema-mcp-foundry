#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCli as runLegacyCli, type CliIo } from './foundry.js';
import { auditToolTarget, assertToolQuality, renderToolQualityReport } from '../tools/audit.js';
import { buildStudioProject } from '../studio/pipeline-service.js';
import { buildDeploymentPackage } from '../studio/deployment-builder.js';

const defaultIo: CliIo = { out: (value) => process.stdout.write(`${value}\n`), error: (value) => process.stderr.write(`${value}\n`) };

export async function runCli(args: string[], io: CliIo = defaultIo): Promise<number> {
  if (args[0] === 'tools') return runTools(args.slice(1), io);
  if (args[0] === 'studio' && args[1] === 'build') return runStudioBuild(args.slice(2), io);
  return runLegacyCli(args, io);
}

async function runTools(args: string[], io: CliIo): Promise<number> {
  if (args[0] !== 'audit') { io.error('USAGE_ERROR: expected `foundry tools audit TARGET [--json]`.'); return 2; }
  let target = '.'; let targetSet = false; let json = false;
  for (const argument of args.slice(1)) {
    if (argument === '--json') { json = true; continue; }
    if (!argument.startsWith('--') && !targetSet) { target = argument; targetSet = true; continue; }
    io.error(`USAGE_ERROR: unknown option ${argument}.`); return 2;
  }
  try {
    const report = await auditToolTarget(target);
    io.out(json ? JSON.stringify(report, null, 2) : renderToolQualityReport(report));
    return report.gate.passed ? 0 : 1;
  } catch (error) { io.error(`TOOLS_AUDIT_ERROR: ${error instanceof Error ? error.message : String(error)}`); return 2; }
}

async function runStudioBuild(args: string[], io: CliIo): Promise<number> {
  let directory = 'numtema-foundry-studio'; let directorySet = false; let json = false; let allowIncomplete = false;
  for (const argument of args) {
    if (argument === '--json') { json = true; continue; }
    if (argument === '--allow-incomplete') { allowIncomplete = true; continue; }
    if (!argument.startsWith('--') && !directorySet) { directory = argument; directorySet = true; continue; }
    io.error(`USAGE_ERROR: unknown option ${argument}.`); return 2;
  }
  try {
    const report = await buildStudioProject(directory) as unknown as { operation_count: number; tool_count: number; adapter_count: number; tool_quality: import('../tools/types.js').ToolQualityReport };
    assertToolQuality(report.tool_quality, allowIncomplete);
    const manifest = await buildDeploymentPackage(directory) as unknown as Record<string, unknown>;
    const output = { report, deployment_manifest: manifest };
    io.out(json ? JSON.stringify(output, null, 2) : `STUDIO_BUILD_OK ${resolve(directory)}\n- operations: ${report.operation_count}\n- tools: ${report.tool_count}\n- average quality: ${report.tool_quality.average_score}\n- quality gate: ${report.tool_quality.gate.passed ? 'passed' : 'bypassed'}\n- adapters: ${report.adapter_count}\n- private keys included: false`);
    return 0;
  } catch (error) { io.error(`STUDIO_BUILD_ERROR: ${error instanceof Error ? error.message : String(error)}`); return 2; }
}

function isMain(): boolean { try { return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1] ?? ''); } catch { return false; } }
if (isMain()) { const code = await runCli(process.argv.slice(2)); process.exitCode = code; }
