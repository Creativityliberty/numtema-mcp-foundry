import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';

describe('npm installability', () => {
  it('packs, installs globally into an isolated prefix, and runs outside the source tree', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'foundry-install-'));
    const packDir = join(workspace, 'pack');
    const prefix = join(workspace, 'prefix');
    const unrelated = join(workspace, 'cwd');
    try {
      await mkdir(packDir, { recursive: true });
      await mkdir(unrelated, { recursive: true });
      const pack = spawnSync('npm', ['pack', '--json', '--pack-destination', packDir], {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: process.env
      });
      assert.equal(pack.status, 0, pack.stderr);
      const packReport = JSON.parse(pack.stdout) as Array<{ filename: string; files: Array<{ path: string }> }>;
      const tarball = join(packDir, packReport[0]!.filename);
      const packedPaths = packReport[0]!.files.map((entry) => entry.path);
      assert.ok(packedPaths.includes('dist/src/cli/foundry.js'));
      assert.ok(packedPaths.includes('schemas/tool-contract.schema.json'));
      assert.ok(packedPaths.includes('schemas/signed-dispatch-receipt.schema.json'));
      assert.ok(packedPaths.includes('examples/openapi-schema-rich.json'));
      assert.ok(packedPaths.includes('schemas/mcp-runtime-config.schema.json'));
      assert.ok(packedPaths.includes('schemas/signed-execution-receipt.schema.json'));
      assert.ok(packedPaths.includes('examples/contract-bundle.auth.generated.json'));
      assert.ok(packedPaths.includes('examples/mcp/runtime-config.template.json'));
      assert.ok(packedPaths.includes('examples/mcp/signed-execution-receipt.generated.json'));
      assert.ok(packedPaths.includes('studio/index.html'));
      assert.ok(packedPaths.includes('studio/assets/app.css'));
      assert.ok(packedPaths.includes('studio/assets/app.js'));
      assert.ok(packedPaths.includes('schemas/studio-project.schema.json'));
      assert.ok(packedPaths.includes('schemas/deployment-package-manifest.schema.json'));

      const install = spawnSync('npm', [
        'install', '--global', '--prefix', prefix, '--ignore-scripts', '--no-audit', '--no-fund', tarball
      ], { encoding: 'utf8', env: process.env });
      assert.equal(install.status, 0, install.stderr);

      const binary = join(prefix, 'bin', 'foundry');
      const doctor = spawnSync(binary, ['doctor', '--json'], { cwd: unrelated, encoding: 'utf8', env: process.env });
      assert.equal(doctor.status, 0, doctor.stderr);
      const doctorReport = JSON.parse(doctor.stdout) as { healthy: boolean };
      assert.equal(doctorReport.healthy, true);

      const demo = spawnSync(binary, ['demo', '--json'], { cwd: unrelated, encoding: 'utf8', env: process.env });
      assert.equal(demo.status, 0, demo.stderr);
      const demoReport = JSON.parse(demo.stdout) as { valid: boolean; network_executed: boolean };
      assert.equal(demoReport.valid, true);
      assert.equal(demoReport.network_executed, false);

      const starter = join(unrelated, 'starter');
      const init = spawnSync(binary, ['init', starter, '--name', 'starter', '--json'], { cwd: unrelated, encoding: 'utf8', env: process.env });
      assert.equal(init.status, 0, init.stderr);
      const inspect = spawnSync(binary, ['inspect', join(starter, 'openapi.json'), '--json'], { cwd: unrelated, encoding: 'utf8', env: process.env });
      assert.equal(inspect.status, 0, inspect.stderr);

      const mcpRuntime = join(unrelated, 'mcp-runtime');
      const mcpInit = spawnSync(binary, ['mcp', 'init', mcpRuntime], { cwd: unrelated, encoding: 'utf8', env: process.env });
      assert.equal(mcpInit.status, 0, mcpInit.stderr);
      const mcpInspect = spawnSync(binary, ['mcp', 'inspect', '--config', join(mcpRuntime, 'runtime-config.json'), '--json'], { cwd: unrelated, encoding: 'utf8', env: { ...process.env, CUSTOMER_API_TOKEN: 'demo-token' } });
      assert.equal(mcpInspect.status, 0, mcpInspect.stderr);
      const mcpSummary = JSON.parse(mcpInspect.stdout) as { tool_count: number; secrets_in_config: boolean };
      assert.equal(mcpSummary.tool_count, 4);
      assert.equal(mcpSummary.secrets_in_config, false);

      const studioProject = join(unrelated, 'studio-project');
      const studioInit = spawnSync(binary, ['studio', 'init', studioProject, '--name', 'Installed Studio'], { cwd: unrelated, encoding: 'utf8', env: process.env });
      assert.equal(studioInit.status, 0, studioInit.stderr);
      const studioBuild = spawnSync(binary, ['studio', 'build', studioProject, '--json'], { cwd: unrelated, encoding: 'utf8', env: process.env });
      assert.equal(studioBuild.status, 0, studioBuild.stderr);
      const studioReport = JSON.parse(studioBuild.stdout) as { report: { tool_count: number }; deployment_manifest: { private_keys_included: boolean } };
      assert.equal(studioReport.report.tool_count, 4);
      assert.equal(studioReport.deployment_manifest.private_keys_included, false);

      const installedPackage = JSON.parse(await readFile(join(prefix, 'lib', 'node_modules', '@numtema', 'mcp-foundry', 'package.json'), 'utf8')) as { dependencies?: unknown };
      assert.equal(installedPackage.dependencies, undefined);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});
