import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
const EXCLUDED_DIRECTORIES = new Set(['.git', 'node_modules', 'bundle']);
export async function listProjectJsonFiles(rootDirectory = '.') {
    const root = resolve(rootDirectory);
    const files = [];
    await walk(root, root, files);
    return files.sort();
}
export async function buildJsonBundle(rootDirectory = '.', outputDirectory = 'bundle') {
    const root = resolve(rootDirectory);
    const output = resolve(outputDirectory);
    const sourceFiles = await listProjectJsonFiles(root);
    const entries = [];
    for (const sourcePath of sourceFiles) {
        const absoluteSource = resolve(root, sourcePath);
        const bundlePath = join('json', sourcePath);
        const absoluteTarget = resolve(output, bundlePath);
        const content = await readFile(absoluteSource, 'utf8');
        await mkdir(dirname(absoluteTarget), { recursive: true });
        await writeFile(absoluteTarget, content, 'utf8');
        entries.push({
            source_path: sourcePath,
            bundle_path: bundlePath.replaceAll('\\', '/'),
            sha256: createHash('sha256').update(content).digest('hex'),
            size_bytes: content.length
        });
    }
    const base = {
        artifact_type: 'json_bundle_index',
        artifact_version: '0.7',
        generated_from: '.',
        file_count: entries.length,
        entries
    };
    const digest = createHash('sha256').update(stableStringify(base)).digest('hex');
    const index = {
        ...base,
        integrity: { algorithm: 'sha256', digest }
    };
    await mkdir(output, { recursive: true });
    await writeFile(resolve(output, 'index.json'), `${JSON.stringify(index, null, 2)}\n`, 'utf8');
    return index;
}
async function walk(root, current, files) {
    const names = (await readdir(current)).sort();
    for (const name of names) {
        if (EXCLUDED_DIRECTORIES.has(name))
            continue;
        const absolute = join(current, name);
        const info = await stat(absolute);
        if (info.isDirectory()) {
            await walk(root, absolute, files);
            continue;
        }
        if (!info.isFile() || !name.endsWith('.json'))
            continue;
        files.push(relative(root, absolute).replaceAll('\\', '/'));
    }
}
function stableStringify(value) {
    return JSON.stringify(sortValue(value));
}
function sortValue(value) {
    if (Array.isArray(value))
        return value.map(sortValue);
    if (typeof value !== 'object' || value === null)
        return value;
    const record = value;
    return Object.fromEntries(Object.keys(record).sort().map((key) => [key, sortValue(record[key])]));
}
//# sourceMappingURL=json-bundle-builder.js.map