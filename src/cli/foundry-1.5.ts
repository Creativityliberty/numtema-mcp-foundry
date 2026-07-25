#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCli as runLegacyCli, type CliIo } from './foundry.js';
import { auditToolTarget, assertToolQuality, renderToolQualityReport } from '../tools/audit.js';
import { buildStudioProject } from '../studio/pipeline-service.js';
import { buildDeploymentPackage } from '../studio/deployment-builder.js';
import { createStudioProject, importStudioSource, loadStudioProject, saveStudioProject } from '../studio/project-store.js';
import { resolvePackageAsset } from '../system/package-assets.js';

const defaultIo: CliIo = { out: (value) => process.stdout.write(`${value}\n`), error: (value) => process.stderr.write(`${value}\n`) };

export async function runCli(args: string[], io: CliIo = defaultIo): Promise<number> {
  if (args[0] === 'tools') return runTools(args.slice(1), io);
  if (args[0] === 'studio' && args[1] === 'init' && args.includes('--provider')) return runStudioInit(args.slice(2), io);
  if (args[0] === 'studio' && args[1] === 'build') return runStudioBuild(args.slice(2), io);
  return runLegacyCli(args, io);
}

async function runStudioInit(args: string[], io: CliIo): Promise<number> {
  let directory = 'numtema-foundry-studio'; let directorySet = false; let name: string | undefined; let provider: string | undefined;
  let publicBaseUrl: string | undefined; let force = false; let json = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === undefined) continue;
    if (!argument.startsWith('--') && !directorySet) { directory = argument; directorySet = true; continue; }
    if (argument === '--name') { name = requireValue(args, index, '--name'); index += 1; continue; }
    if (argument === '--provider') { provider = requireValue(args, index, '--provider'); index += 1; continue; }
    if (argument === '--public-base-url') { publicBaseUrl = requireValue(args, index, '--public-base-url'); index += 1; continue; }
    if (argument === '--force') { force = true; continue; }
    if (argument === '--json') { json = true; continue; }
    io.error(`USAGE_ERROR: unknown option ${argument}.`); return 2;
  }
  if (provider !== 'whatsapp') { io.error('USAGE_ERROR: --provider currently supports only `whatsapp`.'); return 2; }
  try {
    await createStudioProject(directory, { ...(name === undefined ? {} : { name }), force, withExample: false });
    const sourcePath = resolvePackageAsset('providers', 'whatsapp-cloud-api', 'openapi.json');
    const source = await readFile(sourcePath, 'utf8');
    await importStudioSource(directory, 'openapi.json', source);
    const project = await loadStudioProject(directory);
    project.provider = {
      base_url: 'https://graph.facebook.com', provider_ref: 'whatsapp-cloud-api', provider_account_ref: 'whatsapp-business-account-001',
      auth_mode: 'bearer', credential_handle: 'credential-handle-whatsapp-001', credential_environment: 'WHATSAPP_ACCESS_TOKEN'
    };
    if (publicBaseUrl !== undefined) {
      const normalized = new URL(publicBaseUrl).origin;
      project.chatgpt_app.public_base_url = normalized;
      project.chatgpt_app.allowed_origins = [...new Set(['https://chatgpt.com', normalized])];
    }
    await saveStudioProject(directory, project);
    const saved = await loadStudioProject(directory);
    io.out(json ? JSON.stringify(saved, null, 2) : `STUDIO_INIT_OK ${resolve(directory)}\n- project: ${saved.name}\n- provider: WhatsApp Cloud API\n- source: ${saved.source.file}\n- credential: environment://WHATSAPP_ACCESS_TOKEN\n- secrets in project: false\n- next: foundry studio build ${resolve(directory)}`);
    return 0;
  } catch (error) { io.error(`STUDIO_INIT_ERROR: ${error instanceof Error ? error.message : String(error)}`); return 2; }
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

function requireValue(args: string[], index: number, option: string): string {
  const value = args[index + 1]; if (value === undefined || value.startsWith('--')) throw new Error(`${option} requires a value.`); return value;
}
function isMain(): boolean { try { return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1] ?? ''); } catch { return false; } }
if (isMain()) { const code = await runCli(process.argv.slice(2)); process.exitCode = code; }
