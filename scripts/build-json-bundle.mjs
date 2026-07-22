import { buildJsonBundle } from '../dist/src/bundle/json-bundle-builder.js';

const index = await buildJsonBundle('.', 'bundle');
process.stdout.write(`Bundled ${index.file_count} JSON files into bundle/json\n`);
