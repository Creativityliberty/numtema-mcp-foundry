import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export interface ApprovalChallenge {
  challenge_id: string;
  target_tool: string;
  tool_id: string;
  tool_revision: string;
  adapter_id: string;
  adapter_revision: string;
  approval_ref: string;
  risk_class: string;
  args_digest: string;
  arguments: Record<string, unknown>;
  subject_ref: string;
  client_ref: string;
  workspace_ref: string;
  created_at: string;
  expires_at: string;
  status: 'pending' | 'confirmed' | 'denied' | 'consumed';
  confirmed_at: string | null;
  consumed_at: string | null;
}

interface ApprovalStoreState { version: 1; challenges: ApprovalChallenge[]; }

export class ApprovalChallengeStore {
  constructor(readonly directory: string) {}

  async create(challenge: ApprovalChallenge): Promise<void> {
    await this.mutate((state) => { state.challenges.push(challenge); });
  }

  async decide(challengeId: string, tenant: { subject_ref: string; client_ref: string; workspace_ref: string }, decision: 'approve' | 'deny', at: string): Promise<ApprovalChallenge> {
    return this.mutate((state) => {
      const challenge = state.challenges.find((entry) => entry.challenge_id === challengeId);
      if (!challenge) throw new Error('APPROVAL_CHALLENGE_NOT_FOUND');
      requireTenant(challenge, tenant);
      if (Date.parse(challenge.expires_at) <= Date.parse(at)) throw new Error('APPROVAL_CHALLENGE_EXPIRED');
      if (challenge.status !== 'pending') throw new Error('APPROVAL_CHALLENGE_ALREADY_DECIDED');
      challenge.status = decision === 'approve' ? 'confirmed' : 'denied';
      challenge.confirmed_at = at;
      return { ...challenge };
    });
  }

  async consume(match: {
    target_tool: string; tool_revision: string; adapter_id: string; adapter_revision: string; args_digest: string;
    tenant: { subject_ref: string; client_ref: string; workspace_ref: string }; at: string;
  }): Promise<ApprovalChallenge | undefined> {
    return this.mutate((state) => {
      const challenge = state.challenges.find((entry) => entry.status === 'confirmed'
        && entry.target_tool === match.target_tool && entry.tool_revision === match.tool_revision
        && entry.adapter_id === match.adapter_id && entry.adapter_revision === match.adapter_revision
        && entry.args_digest === match.args_digest && entry.subject_ref === match.tenant.subject_ref
        && entry.client_ref === match.tenant.client_ref && entry.workspace_ref === match.tenant.workspace_ref
        && Date.parse(entry.expires_at) > Date.parse(match.at));
      if (!challenge) return undefined;
      challenge.status = 'consumed'; challenge.consumed_at = match.at;
      return { ...challenge };
    });
  }

  async read(challengeId: string): Promise<ApprovalChallenge | undefined> {
    const state = await readState(join(this.directory, 'approval-challenges.json'));
    return state.challenges.find((entry) => entry.challenge_id === challengeId);
  }

  private async mutate<T>(fn: (state: ApprovalStoreState) => T | Promise<T>): Promise<T> {
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
    } finally { await rm(lock, { recursive: true, force: true }); }
  }
}

async function readState(path: string): Promise<ApprovalStoreState> {
  try {
    const value = JSON.parse(await readFile(path, 'utf8')) as ApprovalStoreState;
    if (value.version !== 1 || !Array.isArray(value.challenges)) throw new Error('APPROVAL_STORE_CORRUPT');
    return value;
  } catch (error) {
    if (error instanceof Error && 'code' in error && (error as Error & { code?: string }).code === 'ENOENT') return { version: 1, challenges: [] };
    throw error;
  }
}
async function acquireLock(path: string): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try { await mkdir(path); return; }
    catch (error) {
      if (!(error instanceof Error && 'code' in error && (error as Error & { code?: string }).code === 'EEXIST')) throw error;
      await new Promise<void>((resolvePromise) => setTimeout(() => resolvePromise(), 10));
    }
  }
  throw new Error('APPROVAL_STORE_LOCK_TIMEOUT');
}
function requireTenant(challenge: ApprovalChallenge, tenant: { subject_ref: string; client_ref: string; workspace_ref: string }): void {
  if (challenge.subject_ref !== tenant.subject_ref || challenge.client_ref !== tenant.client_ref || challenge.workspace_ref !== tenant.workspace_ref) {
    throw new Error('APPROVAL_CHALLENGE_TENANT_MISMATCH');
  }
}
