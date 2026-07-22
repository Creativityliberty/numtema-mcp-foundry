import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { initializeChatGptApp } from '../src/apps/init-app.js';
import { validateValueAgainstSchema } from '../src/validation/schema-validator.js';

describe('ChatGPT App config schema', () => {
  it('validates a generated chatgpt_app_config v1.1', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'foundry-app-schema-'));
    try {
      const report = await initializeChatGptApp(directory, true, 'http://127.0.0.1:8788');
      const config = JSON.parse(await readFile(report.config_file, 'utf8')) as unknown;
      const schema = JSON.parse(await readFile('schemas/chatgpt-app-config.schema.json', 'utf8')) as Record<string, unknown>;
      assert.deepEqual(validateValueAgainstSchema(schema, config, 'chatgpt_app_config', 'v1.1'), []);
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
});
