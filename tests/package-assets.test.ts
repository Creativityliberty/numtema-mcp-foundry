import assert from 'node:assert/strict';
import { stat, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { getPackageMetadata, getPackageRoot, resolvePackageAsset } from '../src/system/package-assets.js';

describe('portable package assets', () => {
  it('locates package metadata and assets outside the project working directory', async () => {
    const original = process.cwd();
    const unrelated = await mkdtemp(join(tmpdir(), 'foundry-assets-'));
    try {
      process.chdir(unrelated);
      const metadata = getPackageMetadata();
      assert.equal(metadata.name, '@numtema/mcp-foundry');
      assert.match(metadata.version, /^\d+\.\d+\.\d+$/);
      assert.ok((await stat(join(getPackageRoot(), 'package.json'))).isFile());
      assert.ok((await stat(resolvePackageAsset('schemas', 'tool-contract.schema.json'))).isFile());
      assert.ok((await stat(resolvePackageAsset('examples', 'openapi-schema-rich.json'))).isFile());
    } finally {
      process.chdir(original);
      await rm(unrelated, { recursive: true, force: true });
    }
  });
});
