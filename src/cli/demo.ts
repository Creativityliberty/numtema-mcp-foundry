import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { compileProviderAdapters } from '../adapters/provider-adapter-compiler.js';
import { compileCapabilityMap } from '../compiler/tool-contract-compiler.js';
import { loadOpenApiDocument } from '../inspection/openapi-loader.js';
import { inspectOpenApi } from '../inspection/source-inspector.js';
import { mapCapabilities } from '../mapping/capability-mapper.js';
import { resolvePackageAsset } from '../system/package-assets.js';
import { validateBundle } from '../validation/validate-bundle.js';

export interface DemoReport {
  artifact_type: 'foundry_demo_report';
  artifact_version: '0.8.1';
  valid: boolean;
  network_executed: false;
  secret_material_included: false;
  source: string;
  output_directory: string | null;
  summary: {
    operation_count: number;
    capability_count: number;
    tool_count: number;
    policy_count: number;
    approval_count: number;
    recovery_count: number;
    adapter_count: number;
    error_count: number;
    warning_count: number;
  };
}

export interface DemoOptions {
  outputDirectory?: string;
}

export async function runDemoPipeline(options: DemoOptions = {}): Promise<DemoReport> {
  const source = resolvePackageAsset('examples', 'openapi-schema-rich.json');
  const document = await loadOpenApiDocument(source);
  const inspection = inspectOpenApi(document, source);
  const capabilityMap = mapCapabilities(inspection);
  const compilation = compileCapabilityMap(capabilityMap);
  const validation = await validateBundle(compilation.bundle);
  const adapters = compileProviderAdapters(compilation.bundle);
  const outputDirectory = options.outputDirectory === undefined ? null : resolve(options.outputDirectory);

  if (outputDirectory !== null) {
    await mkdir(outputDirectory, { recursive: true });
    await Promise.all([
      writeJson(resolve(outputDirectory, 'source-inspection.json'), inspection),
      writeJson(resolve(outputDirectory, 'capability-map.json'), capabilityMap),
      writeJson(resolve(outputDirectory, 'contract-bundle.json'), compilation.bundle),
      writeJson(resolve(outputDirectory, 'provider-adapters.json'), adapters)
    ]);
  }

  return {
    artifact_type: 'foundry_demo_report',
    artifact_version: '0.8.1',
    valid: validation.valid,
    network_executed: false,
    secret_material_included: false,
    source,
    output_directory: outputDirectory,
    summary: {
      operation_count: inspection.summary.operation_count,
      capability_count: capabilityMap.summary.capability_count,
      tool_count: compilation.summary.tool_count,
      policy_count: compilation.summary.policy_count,
      approval_count: compilation.summary.approval_count,
      recovery_count: compilation.summary.recovery_count,
      adapter_count: adapters.summary.adapter_count,
      error_count: validation.error_count,
      warning_count: validation.warning_count + compilation.warnings.length
    }
  };
}

export function renderDemoReport(report: DemoReport): string {
  return [
    `${report.valid ? 'DEMO_OK' : 'DEMO_INVALID'} — OpenAPI → governed contracts → HTTP adapters`,
    `- operations: ${report.summary.operation_count}`,
    `- capabilities: ${report.summary.capability_count}`,
    `- tools: ${report.summary.tool_count}`,
    `- policies: ${report.summary.policy_count}`,
    `- adapters: ${report.summary.adapter_count}`,
    `- errors: ${report.summary.error_count}`,
    `- warnings: ${report.summary.warning_count}`,
    `- network executed: false`,
    `- secret material included: false`,
    ...(report.output_directory === null ? [] : [`- artifacts: ${report.output_directory}`])
  ].join('\n');
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
