import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
export class ApprovalChallengeStore {
    directory;
    constructor(directory) {
        this.directory = directory;
    }
    async create(challenge) {
        await this.mutate((state) => { state.challenges.push(challenge); });
    }
    async decide(challengeId, tenant, decision, at) {
        return this.mutate((state) => {
            const challenge = state.challenges.find((entry) => entry.challenge_id === challengeId);
            if (!challenge)
                throw new Error('APPROVAL_CHALLENGE_NOT_FOUND');
            requireTenant(challenge, tenant);
            if (Date.parse(challenge.expires_at) <= Date.parse(at))
                throw new Error('APPROVAL_CHALLENGE_EXPIRED');
            if (challenge.status !== 'pending')
                throw new Error('APPROVAL_CHALLENGE_ALREADY_DECIDED');
            challenge.status = decision === 'approve' ? 'confirmed' : 'denied';
            challenge.confirmed_at = at;
            return { ...challenge };
        });
    }
    async consume(match) {
        return this.mutate((state) => {
            const challenge = state.challenges.find((entry) => entry.status === 'confirmed'
                && entry.target_tool === match.target_tool && entry.tool_revision === match.tool_revision
                && entry.adapter_id === match.adapter_id && entry.adapter_revision === match.adapter_revision
                && entry.args_digest === match.args_digest && entry.subject_ref === match.tenant.subject_ref
                && entry.client_ref === match.tenant.client_ref && entry.workspace_ref === match.tenant.workspace_ref
                && Date.parse(entry.expires_at) > Date.parse(match.at));
            if (!challenge)
                return undefined;
            challenge.status = 'consumed';
            challenge.consumed_at = match.at;
            return { ...challenge };
        });
    }
    async read(challengeId) {
        const state = await readState(join(this.directory, 'approval-challenges.json'));
        return state.challenges.find((entry) => entry.challenge_id === challengeId);
    }
    async mutate(fn) {
        await mkdir(this.directory, { recursive: true });
        const lock = join(this.directory, '.approval-lock');
        await acquireLock(lock);
        try {
            const file = join(this.directory, 'approval-challenges.json');
            const state = await readState(file);
            const result = await fn(state);
            const temporary = `${file}.${randomUUID()}.tmp`;
            await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
            await rename(temporary, file);
            return result;
        }
        finally {
            await rm(lock, { recursive: true, force: true });
        }
    }
}
async function readState(path) {
    try {
        const value = JSON.parse(await readFile(path, 'utf8'));
        if (value.version !== 1 || !Array.isArray(value.challenges))
            throw new Error('APPROVAL_STORE_CORRUPT');
        return value;
    }
    catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
            return { version: 1, challenges: [] };
        throw error;
    }
}
async function acquireLock(path) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
        try {
            await mkdir(path);
            return;
        }
        catch (error) {
            if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST'))
                throw error;
            await new Promise((resolvePromise) => setTimeout(() => resolvePromise(), 10));
        }
    }
    throw new Error('APPROVAL_STORE_LOCK_TIMEOUT');
}
function requireTenant(challenge, tenant) {
    if (challenge.subject_ref !== tenant.subject_ref || challenge.client_ref !== tenant.client_ref || challenge.workspace_ref !== tenant.workspace_ref) {
        throw new Error('APPROVAL_CHALLENGE_TENANT_MISMATCH');
    }
}
//# sourceMappingURL=approval-store.js.map