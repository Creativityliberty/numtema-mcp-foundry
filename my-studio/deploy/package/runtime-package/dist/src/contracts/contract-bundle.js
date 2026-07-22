import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
export class ContractBundleError extends Error {
    code;
    constructor(code, message) {
        super(`${code}: ${message}`);
        this.code = code;
        this.name = 'ContractBundleError';
    }
}
export async function loadContractBundle(filePath) {
    const absolutePath = resolve(filePath);
    const source = await readFile(absolutePath, 'utf8');
    const extension = extname(absolutePath).toLowerCase();
    let parsed;
    if (extension === '.json') {
        parsed = JSON.parse(source);
    }
    else if (extension === '.yaml' || extension === '.yml') {
        parsed = parseControlledYaml(source);
    }
    else {
        throw new ContractBundleError('UNSUPPORTED_BUNDLE_FORMAT', `Expected .json, .yaml, or .yml, received ${extension || 'no extension'}.`);
    }
    if (!isRecord(parsed)) {
        throw new ContractBundleError('INVALID_BUNDLE_ROOT', 'Bundle root must be an object.');
    }
    const collections = ['tools', 'auth', 'policies', 'approvals', 'recoveries', 'receipts', 'artifacts'];
    for (const key of collections) {
        if (!Array.isArray(parsed[key])) {
            throw new ContractBundleError('INVALID_BUNDLE_COLLECTION', `${key} must be an array.`);
        }
    }
    if (parsed.bundle_version !== '0.2') {
        throw new ContractBundleError('UNSUPPORTED_BUNDLE_VERSION', 'bundle_version must equal "0.2".');
    }
    return parsed;
}
export function indexContractBundle(bundle) {
    const byId = new Map();
    const toolsByName = new Map();
    const add = (id, contract) => {
        if (byId.has(id)) {
            throw new ContractBundleError('DUPLICATE_CONTRACT_ID', id);
        }
        byId.set(id, contract);
    };
    for (const value of bundle.tools) {
        add(value.id, { kind: 'tool', value });
        if (toolsByName.has(value.name)) {
            throw new ContractBundleError('DUPLICATE_TOOL_NAME', value.name);
        }
        toolsByName.set(value.name, value);
    }
    for (const value of bundle.auth)
        add(value.id, { kind: 'auth', value });
    for (const value of bundle.policies)
        add(value.id, { kind: 'policy', value });
    for (const value of bundle.approvals)
        add(value.id, { kind: 'approval', value });
    for (const value of bundle.recoveries)
        add(value.id, { kind: 'recovery', value });
    for (const value of bundle.receipts)
        add(value.receipt_id, { kind: 'receipt', value });
    for (const value of bundle.artifacts)
        add(value.artifact_id, { kind: 'artifact', value });
    return { byId, toolsByName };
}
export function parseControlledYaml(source) {
    const lines = source
        .split(/\r?\n/)
        .map((raw, index) => ({ raw: stripComment(raw), lineNumber: index + 1 }))
        .filter(({ raw }) => raw.trim().length > 0)
        .map(({ raw, lineNumber }) => ({
        indent: raw.length - raw.trimStart().length,
        content: raw.trimStart(),
        lineNumber
    }));
    if (lines.length === 0)
        return {};
    if (lines[0].indent !== 0) {
        throw yamlError(lines[0], 'Top-level content must start at indentation 0.');
    }
    const result = parseBlock(lines, 0, 0);
    if (result.nextIndex !== lines.length) {
        throw yamlError(lines[result.nextIndex], 'Unexpected trailing content.');
    }
    return result.value;
}
function parseBlock(lines, startIndex, indent) {
    const line = lines[startIndex];
    if (!line)
        return { value: null, nextIndex: startIndex };
    if (line.indent !== indent)
        throw yamlError(line, `Expected indentation ${indent}.`);
    return line.content.startsWith('-') ? parseSequence(lines, startIndex, indent) : parseMapping(lines, startIndex, indent);
}
function parseMapping(lines, startIndex, indent) {
    const output = {};
    let index = startIndex;
    while (index < lines.length) {
        const line = lines[index];
        if (line.indent < indent)
            break;
        if (line.indent > indent)
            throw yamlError(line, `Unexpected indentation; expected ${indent}.`);
        if (line.content.startsWith('-'))
            break;
        const pair = splitKeyValue(line.content);
        if (!pair)
            throw yamlError(line, 'Expected a key followed by a colon.');
        const [key, rawValue] = pair;
        if (key in output)
            throw yamlError(line, `Duplicate key ${key}.`);
        if (rawValue.length > 0) {
            output[key] = parseScalar(rawValue, line);
            index += 1;
            continue;
        }
        const next = lines[index + 1];
        if (!next || next.indent <= indent) {
            output[key] = null;
            index += 1;
            continue;
        }
        const child = parseBlock(lines, index + 1, next.indent);
        output[key] = child.value;
        index = child.nextIndex;
    }
    return { value: output, nextIndex: index };
}
function parseSequence(lines, startIndex, indent) {
    const output = [];
    let index = startIndex;
    while (index < lines.length) {
        const line = lines[index];
        if (line.indent < indent)
            break;
        if (line.indent > indent)
            throw yamlError(line, `Unexpected indentation; expected ${indent}.`);
        if (!line.content.startsWith('-'))
            break;
        const rest = line.content.slice(1).trimStart();
        if (rest.length === 0) {
            const next = lines[index + 1];
            if (!next || next.indent <= indent)
                throw yamlError(line, 'Sequence item requires a nested value.');
            const child = parseBlock(lines, index + 1, next.indent);
            output.push(child.value);
            index = child.nextIndex;
            continue;
        }
        const firstPair = splitKeyValue(rest);
        if (!firstPair) {
            output.push(parseScalar(rest, line));
            index += 1;
            continue;
        }
        const item = {};
        const [firstKey, firstRawValue] = firstPair;
        if (firstRawValue.length > 0) {
            item[firstKey] = parseScalar(firstRawValue, line);
            index += 1;
        }
        else {
            const next = lines[index + 1];
            if (!next || next.indent <= indent) {
                item[firstKey] = null;
                index += 1;
            }
            else {
                const child = parseBlock(lines, index + 1, next.indent);
                item[firstKey] = child.value;
                index = child.nextIndex;
            }
        }
        const continuation = lines[index];
        if (continuation && continuation.indent > indent) {
            const child = parseMapping(lines, index, continuation.indent);
            if (!isRecord(child.value))
                throw yamlError(continuation, 'Sequence object continuation must be a mapping.');
            for (const [key, value] of Object.entries(child.value)) {
                if (key in item)
                    throw yamlError(continuation, `Duplicate key ${key}.`);
                item[key] = value;
            }
            index = child.nextIndex;
        }
        output.push(item);
    }
    return { value: output, nextIndex: index };
}
function splitKeyValue(content) {
    let quote = null;
    for (let index = 0; index < content.length; index += 1) {
        const character = content[index];
        if ((character === '"' || character === "'") && content[index - 1] !== '\\') {
            quote = quote === character ? null : quote ?? character;
            continue;
        }
        if (character === ':' && quote === null) {
            const next = content[index + 1];
            if (next !== undefined && next !== ' ' && next !== '\t')
                continue;
            const key = content.slice(0, index).trim();
            if (!key)
                return null;
            return [unquoteKey(key), content.slice(index + 1).trim()];
        }
    }
    return null;
}
function parseScalar(raw, line) {
    if (raw === 'null' || raw === '~')
        return null;
    if (raw === 'true')
        return true;
    if (raw === 'false')
        return false;
    if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(raw))
        return Number(raw);
    if (raw.startsWith('[') || raw.startsWith('{') || raw.startsWith('"')) {
        try {
            return JSON.parse(raw);
        }
        catch {
            throw yamlError(line, `Invalid JSON-compatible scalar ${raw}.`);
        }
    }
    if (raw.startsWith("'") && raw.endsWith("'")) {
        return raw.slice(1, -1).replaceAll("''", "'");
    }
    return raw;
}
function stripComment(raw) {
    let quote = null;
    for (let index = 0; index < raw.length; index += 1) {
        const character = raw[index];
        if ((character === '"' || character === "'") && raw[index - 1] !== '\\') {
            quote = quote === character ? null : quote ?? character;
        }
        if (character === '#' && quote === null && (index === 0 || /\s/.test(raw[index - 1]))) {
            return raw.slice(0, index).trimEnd();
        }
    }
    return raw.trimEnd();
}
function unquoteKey(key) {
    if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
        return key.slice(1, -1);
    }
    return key;
}
function yamlError(line, message) {
    return new ContractBundleError('INVALID_YAML', `line ${line.lineNumber}: ${message}`);
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
//# sourceMappingURL=contract-bundle.js.map