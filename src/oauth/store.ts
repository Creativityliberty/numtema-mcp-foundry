import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { OAuthClient, OAuthStoreState } from './types.js';

export class OAuthStore {
  readonly directory: string;
  readonly filePath: string;
  readonly lockPath: string;
  readonly staticClients: OAuthClient[];

  constructor(directory: string, staticClients: OAuthClient[] = []) {
    this.directory = directory;
    this.filePath = join(directory, 'oauth-state.json');
    this.lockPath = join(directory, '.oauth-lock');
    this.staticClients = staticClients;
  }

  async read(): Promise<OAuthStoreState> {
    await mkdir(this.directory, { recursive: true });
    const state = await readState(this.filePath);
    return mergeClients(state, this.staticClients);
  }

  async mutate<T>(fn: (state: OAuthStoreState) => T | Promise<T>): Promise<T> {
    await mkdir(this.directory, { recursive: true });
    await acquireLock(this.lockPath);
    try {
      const state = mergeClients(await readState(this.filePath), this.staticClients);
      const result = await fn(state);
      await atomicWrite(this.filePath, state);
      return result;
    } finally {
      await rm(this.lockPath, { recursive: true, force: true });
    }
  }
}

function emptyState(): OAuthStoreState {
  return { version: 1, clients: [], authorization_codes: [], refresh_tokens: [], revoked_access_jti: [] };
}

async function readState(filePath: string): Promise<OAuthStoreState> {
  try {
    const value = JSON.parse(await readFile(filePath, 'utf8')) as unknown;
    if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.clients) || !Array.isArray(value.authorization_codes)
      || !Array.isArray(value.refresh_tokens) || !Array.isArray(value.revoked_access_jti)) {
      throw new Error('OAUTH_STORE_CORRUPT');
    }
    return value as unknown as OAuthStoreState;
  } catch (error) {
    if (error instanceof Error && (error.message === 'OAUTH_STORE_CORRUPT' || !isMissingFile(error))) throw error;
    return emptyState();
  }
}

function mergeClients(state: OAuthStoreState, staticClients: OAuthClient[]): OAuthStoreState {
  const byId = new Map<string, OAuthClient>();
  for (const client of [...staticClients, ...state.clients]) byId.set(client.client_id, client);
  state.clients = [...byId.values()].sort((a, b) => a.client_id.localeCompare(b.client_id));
  return state;
}

async function atomicWrite(filePath: string, value: unknown): Promise<void> {
  const temporary = `${filePath}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporary, filePath);
}

async function acquireLock(lockPath: string): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      await mkdir(lockPath);
      return;
    } catch (error) {
      if (!isAlreadyExists(error)) throw error;
      await wait(10);
    }
  }
  throw new Error('OAUTH_STORE_LOCK_TIMEOUT');
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

function isMissingFile(error: Error): boolean {
  return 'code' in error && (error as Error & { code?: string }).code === 'ENOENT';
}
function isAlreadyExists(error: unknown): boolean {
  return error instanceof Error && 'code' in error && (error as Error & { code?: string }).code === 'EEXIST';
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
