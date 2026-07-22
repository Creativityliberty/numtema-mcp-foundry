
interface NodeBuffer extends Uint8Array {
  toString(encoding?: 'base64' | 'utf8'): string;
}
declare const Buffer: {
  from(value: string, encoding?: 'base64' | 'utf8' | 'hex'): NodeBuffer;
};

declare module 'node:test' {
  export function describe(name: string, fn: () => void): void;
  export function it(name: string, fn: () => void | Promise<void>): void;
  export function test(name: string, fn: () => void | Promise<void>): void;
}

declare module 'node:assert/strict' {
  interface Assert {
    equal(actual: unknown, expected: unknown, message?: string): void;
    notEqual(actual: unknown, expected: unknown, message?: string): void;
    deepEqual(actual: unknown, expected: unknown, message?: string): void;
    ok(value: unknown, message?: string): asserts value;
    match(value: string, regexp: RegExp, message?: string): void;
    rejects(fn: () => Promise<unknown>, expected?: RegExp | object): Promise<void>;
    throws(fn: () => unknown, expected?: RegExp | object): void;
  }
  const assert: Assert;
  export default assert;
}

declare module 'node:fs/promises' {
  export function readFile(path: string, encoding: 'utf8'): Promise<string>;
  export function writeFile(path: string, data: string, encoding?: 'utf8'): Promise<void>;
  export function readdir(path: string): Promise<string[]>;
  export function mkdir(path: string, options?: { recursive?: boolean }): Promise<string | undefined>;
  export function stat(path: string): Promise<{ isDirectory(): boolean; isFile(): boolean }>;
}

declare module 'node:path' {
  export function resolve(...paths: string[]): string;
  export function extname(path: string): string;
  export function dirname(path: string): string;
  export function basename(path: string): string;
  export function join(...paths: string[]): string;
  export function relative(from: string, to: string): string;
}

declare module 'node:crypto' {
  interface Hash {
    update(value: string): Hash;
    digest(encoding: 'hex'): string;
  }
  interface KeyObject {
    export(options: { type: 'spki' | 'pkcs8'; format: 'pem' }): string | { toString(): string };
  }
  interface KeyPair {
    publicKey: KeyObject;
    privateKey: KeyObject;
  }
  export function createHash(algorithm: 'sha256'): Hash;
  export function generateKeyPairSync(algorithm: 'ed25519'): KeyPair;
  export function randomUUID(): string;
  export function createPublicKey(key: string): KeyObject;
  export function createPrivateKey(key: string): KeyObject;
  export function sign(algorithm: null, data: string | NodeBuffer, key: KeyObject): NodeBuffer;
  export function verify(algorithm: null, data: string | NodeBuffer, key: KeyObject, signature: string | NodeBuffer): boolean;
}

declare module 'node:url' {
  export class URL {
    constructor(input: string, base?: string | URL);
    protocol: string;
    search: string;
    hash: string;
    searchParams: URLSearchParams;
    pathname: string;
    origin: string;
    hostname: string;
    port: string;
    toString(): string;
  }
  export class URLSearchParams {
    constructor(init?: string | Record<string, string> | Array<[string, string]>);
    append(name: string, value: string): void;
    get(name: string): string | null;
    getAll(name: string): string[];
    has(name: string): boolean;
    entries(): IterableIterator<[string, string]>;
    readonly size: number;
    toString(): string;
  }
}

declare module 'node:fs' {
  export function existsSync(path: string): boolean;
  export function readFileSync(path: string, encoding: 'utf8'): string;
  export function realpathSync(path: string): string;
  export function accessSync(path: string, mode?: number): void;
  export const constants: { W_OK: number };
}

declare module 'node:fs/promises' {
  export function mkdtemp(prefix: string): Promise<string>;
  export function rm(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void>;
  export function copyFile(source: string, destination: string): Promise<void>;
  export function access(path: string, mode?: number): Promise<void>;
}

declare module 'node:os' {
  export function tmpdir(): string;
}

declare module 'node:child_process' {
  export interface SpawnSyncResult {
    status: number | null;
    stdout: string;
    stderr: string;
    error?: Error;
  }
  export function spawnSync(
    command: string,
    args?: string[],
    options?: { cwd?: string; encoding?: 'utf8'; env?: Record<string, string | undefined> }
  ): SpawnSyncResult;
}

declare module 'node:url' {
  export function fileURLToPath(url: string | URL): string;
}

declare const process: {
  argv: string[];
  version: string;
  versions: { node: string };
  env: Record<string, string | undefined>;
  exitCode: number | undefined;
  stdin: unknown;
  stdout: { write(value: string): void };
  stderr: { write(value: string): void };
  cwd(): string;
  chdir(directory: string): void;
};

interface ImportMeta {
  url: string;
}


declare module 'node:fs/promises' {
  interface FileHandle {
    writeFile(data: string, encoding?: 'utf8'): Promise<void>;
    sync(): Promise<void>;
    close(): Promise<void>;
  }
  export function open(path: string, flags: 'a' | 'w'): Promise<FileHandle>;
  export function rename(oldPath: string, newPath: string): Promise<void>;
}

declare function setTimeout(callback: () => void, milliseconds: number): unknown;

declare module 'node:test' {
  export function afterEach(fn: () => void | Promise<void>): void;
}

declare module 'node:http' {
  export interface IncomingHttpHeaders { [key: string]: string | string[] | undefined; }
  export interface IncomingMessage {
    headers: IncomingHttpHeaders;
    method?: string;
    url?: string;
    on(event: 'data', listener: (chunk: NodeBuffer) => void): this;
    on(event: 'end', listener: () => void): this;
    on(event: 'error', listener: (error: Error) => void): this;
  }
  export interface ServerResponse {
    writeHead(statusCode: number, headers?: Record<string, string>): this;
    end(data?: string | NodeBuffer): void;
  }
  export interface AddressInfo { address: string; family: string; port: number; }
  export interface Server {
    listen(port: number, host: string, callback: () => void): this;
    close(callback: (error?: Error) => void): void;
    address(): AddressInfo | string | null;
    once(event: 'error', listener: (error: Error) => void): this;
  }
  export type RequestListener = (request: IncomingMessage, response: ServerResponse) => void;
  export function createServer(listener?: RequestListener): Server;
}

declare class AbortSignal {}
declare class AbortController {
  readonly signal: AbortSignal;
  abort(reason?: unknown): void;
}
interface FetchHeaders {
  forEach(callback: (value: string, key: string) => void): void;
  get(name: string): string | null;
}
interface FetchResponse {
  status: number;
  headers: FetchHeaders;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
}
declare function fetch(input: string, init?: {
  method?: string;
  headers?: Record<string, string>;
  body?: string | Uint8Array;
  signal?: AbortSignal;
  redirect?: 'follow' | 'manual' | 'error';
}): Promise<FetchResponse>;

declare function clearTimeout(handle: unknown): void;

declare module 'node:readline' {
  interface ReadLine extends AsyncIterable<string> {}
  export function createInterface(options: { input: unknown; crlfDelay?: number }): ReadLine;
}

declare module 'node:http' {
  export interface ServerResponse { headersSent: boolean; }
}

declare module 'node:crypto' {
  export function timingSafeEqual(left: Uint8Array, right: Uint8Array): boolean;
}

interface NodeBuffer { readonly byteLength: number; }


declare module 'node:crypto' {
  interface Hash {
    digest(encoding: 'base64'): string;
  }
  interface KeyObject {
    export(options: { format: 'jwk' }): Record<string, unknown>;
  }
  export function randomBytes(size: number): NodeBuffer;
  export function scryptSync(password: string, salt: string | NodeBuffer, keylen: number): NodeBuffer;
}

interface NodeBuffer {
  toString(encoding: 'hex'): string;
}

declare module 'node:fs/promises' {
  export function chmod(path: string, mode: number): Promise<void>;
}

declare module 'node:https' {
  import type { RequestListener, Server } from 'node:http';
  export function createServer(options: { cert: string; key: string }, listener?: RequestListener): Server;
}
