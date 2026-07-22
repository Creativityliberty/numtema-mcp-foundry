import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { runCli, type CliIo } from '../src/cli/foundry.js';
import { getPackageMetadata } from '../src/system/package-assets.js';

function captureIo(): { io: CliIo; stdout: string[]; stderr: string[] } {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    io: {
      out: (value) => stdout.push(value),
      error: (value) => stderr.push(value)
    }
  };
}

describe('first-run CLI', () => {
  it('shows help and package version', async () => {
    const help = captureIo();
    assert.equal(await runCli(['--help'], help.io), 0);
    assert.match(help.stdout.join('\n'), /foundry doctor/);
    assert.match(help.stdout.join('\n'), /foundry demo/);
    assert.match(help.stdout.join('\n'), /foundry init/);
    assert.match(help.stdout.join('\n'), /foundry ledger init/);
    assert.match(help.stdout.join('\n'), /foundry dispatch reserve/);

    const version = captureIo();
    assert.equal(await runCli(['--version'], version.io), 0);
    assert.equal(version.stdout.join('').trim(), getPackageMetadata().version);
  });

  it('reports a healthy installation from an unrelated working directory', async () => {
    const original = process.cwd();
    const unrelated = await mkdtemp(join(tmpdir(), 'foundry-doctor-'));
    try {
      process.chdir(unrelated);
      const captured = captureIo();
      assert.equal(await runCli(['doctor', '--json'], captured.io), 0);
      const report = JSON.parse(captured.stdout.join('')) as {
        artifact_type: string;
        healthy: boolean;
        checks: Array<{ code: string; passed: boolean }>;
      };
      assert.equal(report.artifact_type, 'foundry_doctor_report');
      assert.equal(report.healthy, true);
      assert.ok(report.checks.every((check) => check.passed));
    } finally {
      process.chdir(original);
      await rm(unrelated, { recursive: true, force: true });
    }
  });

  it('runs the bundled demo and optionally writes deterministic artifacts', async () => {
    const output = await mkdtemp(join(tmpdir(), 'foundry-demo-'));
    try {
      const captured = captureIo();
      assert.equal(await runCli(['demo', '--json', '--out-dir', output], captured.io), 0);
      const report = JSON.parse(captured.stdout.join('')) as {
        artifact_type: string;
        valid: boolean;
        network_executed: boolean;
        summary: { tool_count: number; adapter_count: number };
      };
      assert.equal(report.artifact_type, 'foundry_demo_report');
      assert.equal(report.valid, true);
      assert.equal(report.network_executed, false);
      assert.ok(report.summary.tool_count > 0);
      assert.ok(report.summary.adapter_count > 0);
      assert.deepEqual((await readdir(output)).sort(), [
        'capability-map.json',
        'contract-bundle.json',
        'provider-adapters.json',
        'source-inspection.json'
      ]);
    } finally {
      await rm(output, { recursive: true, force: true });
    }
  });

  it('initializes a dependency-free starter project and refuses unsafe overwrite', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'foundry-init-'));
    const target = join(parent, 'my-mcp');
    try {
      const captured = captureIo();
      assert.equal(await runCli(['init', target, '--name', 'my-mcp', '--json'], captured.io), 0);
      const report = JSON.parse(captured.stdout.join('')) as { artifact_type: string; created_files: string[] };
      assert.equal(report.artifact_type, 'foundry_init_report');
      assert.deepEqual(report.created_files.sort(), ['.gitignore', 'README.md', 'foundry.config.json', 'openapi.json', 'package.json']);
      const packageJson = JSON.parse(await readFile(join(target, 'package.json'), 'utf8')) as { dependencies?: unknown; scripts: Record<string, string> };
      assert.equal(packageJson.dependencies, undefined);
      assert.equal(packageJson.scripts.inspect, 'foundry inspect openapi.json --out generated/source-inspection.json');

      const inspect = captureIo();
      assert.equal(await runCli(['inspect', join(target, 'openapi.json'), '--out', join(target, 'generated', 'source-inspection.json')], inspect.io), 0);
      const map = captureIo();
      assert.equal(await runCli(['map', join(target, 'openapi.json'), '--out', join(target, 'generated', 'capability-map.json')], map.io), 0);
      const compile = captureIo();
      assert.equal(await runCli(['compile', join(target, 'generated', 'capability-map.json'), '--out', join(target, 'generated', 'contract-bundle.json')], compile.io), 0);
      const validate = captureIo();
      assert.equal(await runCli(['validate', join(target, 'generated', 'contract-bundle.json')], validate.io), 0);

      await writeFile(join(target, 'user-file.txt'), 'keep me', 'utf8');
      const second = captureIo();
      assert.equal(await runCli(['init', target], second.io), 2);
      assert.match(second.stderr.join('\n'), /INIT_REFUSED_NON_EMPTY/);

      const forced = captureIo();
      assert.equal(await runCli(['init', target, '--force', '--json'], forced.io), 0);
      assert.equal((await readdir(target)).includes('user-file.txt'), false);
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });
});
