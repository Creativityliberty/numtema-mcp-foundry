import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { randomBytes, scryptSync } from 'node:crypto';

const dataDir = process.env.DATA_DIR || '/data';
const runtimeDir = join(dataDir, 'runtime');
const foundry = '/opt/foundry/dist/src/cli/foundry.js';
const publicBaseUrl = required('PUBLIC_BASE_URL').replace(/\/$/, '');
const providerBaseUrl = required('PROVIDER_BASE_URL').replace(/\/$/, '');
const adminUsername = required('ADMIN_USERNAME');
const adminPassword = required('ADMIN_PASSWORD');
if (adminPassword.length < 8) throw new Error('ADMIN_PASSWORD must contain at least 8 characters.');
await mkdir(runtimeDir, { recursive: true });
if (!existsSync(join(runtimeDir, 'chatgpt-app-config.json'))) {
  await run(process.execPath, [foundry, 'app', 'init', runtimeDir, '--public-base-url', publicBaseUrl, '--force']);
}
for (const name of ['contract-bundle.json','provider-adapters.json','provider-auth-bindings.json','credential-catalog.json']) {
  await copyFile(join('/opt/app/template/artifacts', name), join(runtimeDir, name));
}
const runtimePath = join(runtimeDir, 'runtime-config.json');
const runtime = JSON.parse(await readFile(runtimePath, 'utf8'));
runtime.server.name = "my-studio";
runtime.server.version = "1.3.0";
runtime.provider.base_url = providerBaseUrl;
runtime.artifacts.contract_bundle = './contract-bundle.json';
runtime.artifacts.provider_adapter_bundle = './provider-adapters.json';
runtime.artifacts.provider_auth_binding_bundle = './provider-auth-bindings.json';
runtime.artifacts.credential_catalog = './credential-catalog.json';
runtime.context.provider_ref = "provider-api";
runtime.context.provider_account_ref = "provider-account-001";
runtime.credentials.environment_by_handle = { "credential-handle-provider-001": "PROVIDER_API_TOKEN" };
await writeFile(runtimePath, JSON.stringify(runtime, null, 2) + '\n');
const appPath = join(runtimeDir, 'chatgpt-app-config.json');
const app = JSON.parse(await readFile(appPath, 'utf8'));
app.public_base_url = publicBaseUrl;
app.server.host = process.env.HOST || '0.0.0.0';
app.server.port = Number(process.env.PORT || 8788);
app.server.allowed_origins = ['https://chatgpt.com'];
app.oauth.issuer = publicBaseUrl;
app.oauth.resource = publicBaseUrl + '/mcp';
app.oauth.users[0].username = adminUsername;
app.oauth.users[0].display_name = 'Foundry Owner';
app.oauth.users[0].password_hash = hashPassword(adminPassword);
await writeFile(appPath, JSON.stringify(app, null, 2) + '\n');
const child = spawn(process.execPath, [foundry, 'app', 'serve', '--config', appPath], { stdio: 'inherit', env: process.env });
child.on('exit', (code) => { process.exitCode = code ?? 1; });

function required(name) { const value = process.env[name]; if (!value) throw new Error(name + ' is required.'); return value; }
function hashPassword(password) { const salt = randomBytes(16).toString('hex'); const digest = scryptSync(password, salt, 32).toString('hex'); return 'scrypt$' + salt + '$' + digest; }
function run(command, args) { return new Promise((resolve, reject) => { const child = spawn(command, args, { stdio: 'inherit', env: process.env }); child.on('error', reject); child.on('exit', (code) => code === 0 ? resolve() : reject(new Error('Command failed with exit ' + code))); }); }
