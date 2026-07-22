import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import { listProjectJsonFiles, type JsonBundleIndex } from '../src/bundle/json-bundle-builder.js';

describe('JSON distribution bundle', () => {
  it('contains every project JSON file outside the bundle directory', async () => {
    const expected = await listProjectJsonFiles('.');
    const index = JSON.parse(await readFile('bundle/index.json', 'utf8')) as JsonBundleIndex;
    assert.equal(index.artifact_type, 'json_bundle_index');
    assert.equal(index.file_count, expected.length);
    assert.deepEqual(index.entries.map((entry) => entry.source_path), expected);
    assert.ok(index.entries.every((entry) => entry.bundle_path === `json/${entry.source_path}`));
    assert.ok(index.entries.every((entry) => entry.sha256.length === 64));
  });
});
