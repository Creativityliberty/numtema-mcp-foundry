import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFile } from 'node:fs/promises';

describe('Foundry Studio assets', () => {
  it('ships a complete responsive workflow with accessible native controls', async () => {
    const html = await readFile('studio/index.html', 'utf8');
    const css = await readFile('studio/assets/app.css', 'utf8');
    const js = await readFile('studio/assets/app.js', 'utf8');
    for (const section of ['dashboard','source','inspection','tools','auth','widget','simulator','deployment']) assert.match(html, new RegExp(`view-${section}`));
    assert.match(html, /aria-label="Navigation principale"/);
    assert.match(html, /iframe[^>]+title=/);
    assert.match(css, /@media\(max-width:720px\)/);
    assert.match(css, /--sage:/);
    assert.match(js, /\/api\/deployment\/build/);
    assert.match(js, /network_executed: false|Aucun réseau/);
  });
});
