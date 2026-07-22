import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
export class OAuthStore {
    directory;
    filePath;
    lockPath;
    staticClients;
    constructor(directory, staticClients = []) {
        this.directory = directory;
        this.filePath = join(directory, 'oauth-state.json');
        this.lockPath = join(directory, '.oauth-lock');
        this.staticClients = staticClients;
    }
    async read() {
        await mkdir(this.directory, { recursive: true });
        const state = await readState(this.filePath);
        return mergeClients(state, this.staticClients);
    }
    async mutate(fn) {
        await mkdir(this.directory, { recursive: true });
        await acquireLock(this.lockPath);
        try {
            const state = mergeClients(await readState(this.filePath), this.staticClients);
            const result = await fn(state);
            await atomicWrite(this.filePath, state);
            return result;
        }
        finally {
            await rm(this.lockPath, { recursive: true, force: true });
        }
    }
}
function emptyState() {
    return { version: 1, clients: [], authorization_codes: [], refresh_tokens: [], revoked_access_jti: [] };
}
async function readState(filePath) {
    try {
        const value = JSON.parse(await readFile(filePath, 'utf8'));
        if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.clients) || !Array.isArray(value.authorization_codes)
            || !Array.isArray(value.refresh_tokens) || !Array.isArray(value.revoked_access_jti)) {
            throw new Error('OAUTH_STORE_CORRUPT');
        }
        return value;
    }
    catch (error) {
        if (error instanceof Error && (error.message === 'OAUTH_STORE_CORRUPT' || !isMissingFile(error)))
            throw error;
        return emptyState();
    }
}
function mergeClients(state, staticClients) {
    const byId = new Map();
    for (const client of [...staticClients, ...state.clients])
        byId.set(client.client_id, client);
    state.clients = [...byId.values()].sort((a, b) => a.client_id.localeCompare(b.client_id));
    return state;
}
async function atomicWrite(filePath, value) {
    const temporary = `${filePath}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await rename(temporary, filePath);
}
async function acquireLock(lockPath) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
        try {
            await mkdir(lockPath);
            return;
        }
        catch (error) {
            if (!isAlreadyExists(error))
                throw error;
            await wait(10);
        }
    }
    throw new Error('OAUTH_STORE_LOCK_TIMEOUT');
}
function wait(milliseconds) {
    return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}
function isMissingFile(error) {
    return 'code' in error && error.code === 'ENOENT';
}
function isAlreadyExists(error) {
    return error instanceof Error && 'code' in error && error.code === 'EEXIST';
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
//# sourceMappingURL=store.js.map