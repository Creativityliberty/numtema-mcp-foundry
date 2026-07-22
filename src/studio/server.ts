import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { URL } from 'node:url';
import { resolvePackageAsset } from '../system/package-assets.js';
import { loadStudioProject } from './project-store.js';
import { handleStudioApi } from './api-router.js';

export interface StudioServerOptions {
  projectDirectory: string;
  host?: string;
  port?: number;
  bodyLimitBytes?: number;
}

export interface StudioServerHandle {
  server: Server;
  csrfToken: string;
  host: string;
  port: number;
  url: string;
  close(): Promise<void>;
}

const STATIC_FILES: Record<string, { file: string; contentType: string }> = {
  '/assets/app.css': { file: 'studio/assets/app.css', contentType: 'text/css; charset=utf-8' },
  '/assets/app.js': { file: 'studio/assets/app.js', contentType: 'text/javascript; charset=utf-8' },
  '/assets/components.js': { file: 'studio/assets/components.js', contentType: 'text/javascript; charset=utf-8' }
};

export async function startStudioServer(options: StudioServerOptions): Promise<StudioServerHandle> {
  const host = options.host ?? '127.0.0.1';
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) throw new Error('STUDIO_BIND_REFUSED: bind to loopback unless an authenticated remote gateway is added.');
  const csrfToken = randomUUID();
  const project = await loadStudioProject(options.projectDirectory);
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', `http://${host}`);
      const api = await handleStudioApi(request, url.pathname, {
        projectDirectory: options.projectDirectory,
        csrfToken,
        bodyLimitBytes: options.bodyLimitBytes ?? 2_000_000
      });
      if (api) {
        response.writeHead(api.status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
        response.end(JSON.stringify(api.body));
        return;
      }
      if (url.pathname === '/' || url.pathname === '/index.html') {
        const source = await readFile(resolvePackageAsset('studio', 'index.html'), 'utf8');
        const html = source.replaceAll('__FOUNDRY_CSRF__', escapeHtml(csrfToken)).replaceAll('__FOUNDRY_PROJECT__', escapeHtml(project.name));
        response.writeHead(200, securityHeaders('text/html; charset=utf-8'));
        response.end(html);
        return;
      }
      const asset = STATIC_FILES[url.pathname];
      if (asset) {
        const body = await readFile(resolvePackageAsset(...asset.file.split('/')), 'utf8');
        response.writeHead(200, securityHeaders(asset.contentType));
        response.end(body);
        return;
      }
      response.writeHead(404, securityHeaders('text/plain; charset=utf-8'));
      response.end('Not found');
    } catch (error) {
      response.writeHead(500, securityHeaders('application/json; charset=utf-8'));
      response.end(JSON.stringify({ ok: false, issues: [{ code: 'STUDIO_INTERNAL_ERROR', message: error instanceof Error ? error.message : String(error) }] }));
    }
  });
  const port = await new Promise<number>((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(options.port ?? 0, host, () => {
      const address = server.address();
      if (address === null || typeof address === 'string') { reject(new Error('STUDIO_LISTEN_FAILED')); return; }
      resolvePromise(address.port);
    });
  });
  return {
    server, csrfToken, host, port, url: `http://${host}:${port}`,
    close: () => new Promise<void>((resolvePromise, reject) => server.close((error) => error ? reject(error) : resolvePromise()))
  };
}

function securityHeaders(contentType: string): Record<string, string> {
  return {
    'content-type': contentType,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'SAMEORIGIN',
    'referrer-policy': 'no-referrer',
    'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; frame-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'"
  };
}

function escapeHtml(value: string): string { return value.replace(/[&<>\"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#039;' }[character] ?? character)); }
