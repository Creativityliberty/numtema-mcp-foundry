import { accessSync, constants, existsSync } from 'node:fs';
import { getPackageMetadata, getPackageRoot, resolvePackageAsset } from '../system/package-assets.js';

export interface DoctorCheck {
  code: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface DoctorReport {
  artifact_type: 'foundry_doctor_report';
  artifact_version: '0.8.1';
  healthy: boolean;
  package: {
    name: string;
    version: string;
    root: string;
  };
  runtime: {
    node: string;
    minimum_node_major: 22;
    current_directory: string;
  };
  checks: DoctorCheck[];
}

const REQUIRED_SCHEMAS = [
  'tool-contract.schema.json',
  'auth-contract.schema.json',
  'policy-contract.schema.json',
  'approval-contract.schema.json',
  'recovery-contract.schema.json',
  'receipt-contract.schema.json',
  'foundry-artifact.schema.json',
  'capability-map-artifact.schema.json',
  'mcp-runtime-config.schema.json',
  'signed-execution-receipt.schema.json'
];

export function runDoctorChecks(currentDirectory = process.cwd()): DoctorReport {
  const metadata = getPackageMetadata();
  const packageRoot = getPackageRoot();
  const nodeMajor = Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10);
  const checks: DoctorCheck[] = [];

  checks.push({
    code: 'NODE_VERSION',
    label: 'Node.js 22 or newer',
    passed: nodeMajor >= 22,
    detail: `detected ${process.version}`
  });

  checks.push({
    code: 'PACKAGE_METADATA',
    label: 'Package metadata',
    passed: metadata.name === '@numtema/mcp-foundry' && metadata.version.length > 0,
    detail: `${metadata.name}@${metadata.version}`
  });

  for (const filename of REQUIRED_SCHEMAS) {
    const path = resolvePackageAsset('schemas', filename);
    checks.push({
      code: `SCHEMA_${filename.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase()}`,
      label: `Schema ${filename}`,
      passed: existsSync(path),
      detail: path
    });
  }

  const demoPath = resolvePackageAsset('examples', 'openapi-schema-rich.json');
  checks.push({
    code: 'DEMO_ASSET',
    label: 'Bundled demo OpenAPI',
    passed: existsSync(demoPath),
    detail: demoPath
  });

  for (const filename of ['contract-bundle.auth.generated.json','provider-adapters.auth.generated.json','provider-auth-bindings.generated.json','credential-catalog.example.json','customer-get.arguments.json']) {
    const path = resolvePackageAsset('examples', filename);
    checks.push({
      code: `MCP_ASSET_${filename.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase()}`,
      label: `MCP demo asset ${filename}`,
      passed: existsSync(path),
      detail: path
    });
  }

  let writable = true;
  let writableDetail = currentDirectory;
  try {
    accessSync(currentDirectory, constants.W_OK);
  } catch (error) {
    writable = false;
    writableDetail = errorMessage(error);
  }
  checks.push({
    code: 'CURRENT_DIRECTORY_WRITABLE',
    label: 'Current directory writable',
    passed: writable,
    detail: writableDetail
  });

  return {
    artifact_type: 'foundry_doctor_report',
    artifact_version: '0.8.1',
    healthy: checks.every((check) => check.passed),
    package: {
      name: metadata.name,
      version: metadata.version,
      root: packageRoot
    },
    runtime: {
      node: process.version,
      minimum_node_major: 22,
      current_directory: currentDirectory
    },
    checks
  };
}

export function renderDoctorReport(report: DoctorReport): string {
  const lines = report.checks.map((check) =>
    `- ${check.passed ? 'PASS' : 'FAIL'} ${check.code}: ${check.detail}`
  );
  return [
    `${report.healthy ? 'DOCTOR_OK' : 'DOCTOR_FAILED'} ${report.package.name}@${report.package.version}`,
    ...lines
  ].join('\n');
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
