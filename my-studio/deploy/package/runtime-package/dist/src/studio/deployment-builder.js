import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { getPackageMetadata, resolvePackageAsset } from '../system/package-assets.js';
import { buildStudioProject, studioSourceDigest } from './pipeline-service.js';
import { loadStudioProject, resolveStudioPath } from './project-store.js';
export async function buildDeploymentPackage(directory) {
    await buildStudioProject(directory);
    const project = await loadStudioProject(directory);
    const output = resolveStudioPath(directory, project.paths.deployment_directory);
    await rm(output, { recursive: true, force: true });
    await mkdir(join(output, 'template', 'artifacts'), { recursive: true });
    await mkdir(join(output, 'runtime-package'), { recursive: true });
    const artifactCopies = [
        [project.paths.contract_bundle, 'contract-bundle.json'],
        [project.paths.provider_adapters, 'provider-adapters.json'],
        [project.paths.provider_auth_bindings, 'provider-auth-bindings.json'],
        [project.paths.credential_catalog, 'credential-catalog.json'],
        [project.source.file, 'openapi-source.json']
    ];
    for (const [source, name] of artifactCopies) {
        await copyFile(resolveStudioPath(directory, source), join(output, 'template', 'artifacts', name));
    }
    await copyDirectory(resolvePackageAsset('dist', 'src'), join(output, 'runtime-package', 'dist', 'src'));
    await copyDirectory(resolvePackageAsset('schemas'), join(output, 'runtime-package', 'schemas'));
    await copyDirectory(resolvePackageAsset('examples'), join(output, 'runtime-package', 'examples'), output);
    await copyFile(resolvePackageAsset('package.json'), join(output, 'runtime-package', 'package.json'));
    await writeFile(join(output, 'Dockerfile'), dockerfile(), 'utf8');
    await writeFile(join(output, 'docker-compose.coolify.yml'), composeFile(project.provider.credential_environment), 'utf8');
    await writeFile(join(output, '.env.example'), envExample(project), 'utf8');
    await writeFile(join(output, 'bootstrap.mjs'), bootstrapScript(project), 'utf8');
    await writeFile(join(output, 'healthcheck.mjs'), healthcheckScript(), 'utf8');
    await writeFile(join(output, 'COOLIFY.md'), coolifyGuide(project), 'utf8');
    await writeFile(join(output, 'VPS.md'), vpsGuide(project), 'utf8');
    await writeFile(join(output, 'CHATGPT_CONNECT.md'), chatGptGuide(project), 'utf8');
    await writeFile(join(output, 'README.md'), packageReadme(project), 'utf8');
    const files = await inventory(output, ['deployment-manifest.json']);
    const base = project.chatgpt_app.public_base_url.replace(/\/$/, '');
    const manifest = {
        artifact_type: 'deployment_package_manifest', artifact_version: '1.2', project_name: project.name,
        generated_at: new Date().toISOString(), source_digest: await studioSourceDigest(directory), files,
        environment: [
            { name: 'PUBLIC_BASE_URL', required: true, secret: false, description: 'Public HTTPS origin of the deployed ChatGPT App.' },
            { name: 'PROVIDER_BASE_URL', required: true, secret: false, description: 'Base URL of the provider API.' },
            { name: project.provider.credential_environment, required: project.provider.auth_mode !== 'none', secret: true, description: 'Provider credential injected only at the execution boundary.' },
            { name: 'ADMIN_USERNAME', required: true, secret: false, description: 'Initial OAuth owner username.' },
            { name: 'ADMIN_PASSWORD', required: true, secret: true, description: 'Initial OAuth owner password; minimum 8 characters.' }
        ],
        endpoints: {
            mcp: `${base}/mcp`, health: `${base}/.well-known/oauth-protected-resource`,
            oauth_resource_metadata: `${base}/.well-known/oauth-protected-resource`,
            oauth_authorization_metadata: `${base}/.well-known/oauth-authorization-server`
        },
        private_keys_included: false
    };
    await writeFile(join(output, 'deployment-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    return manifest;
}
async function copyDirectory(source, destination, excludedRoot) {
    await mkdir(destination, { recursive: true });
    const excluded = excludedRoot ? resolve(excludedRoot) : undefined;
    for (const name of await readdir(source)) {
        const from = join(source, name);
        const absoluteFrom = resolve(from);
        if (excluded && (absoluteFrom === excluded || absoluteFrom.startsWith(`${excluded}/`) || absoluteFrom.startsWith(`${excluded}\\`)))
            continue;
        const to = join(destination, name);
        const info = await stat(from);
        if (info.isDirectory())
            await copyDirectory(from, to, excludedRoot);
        else if (info.isFile()) {
            await mkdir(dirname(to), { recursive: true });
            await copyFile(from, to);
        }
    }
}
async function inventory(root, ignored) {
    const entries = [];
    async function visit(directory) {
        for (const name of (await readdir(directory)).sort()) {
            const absolute = join(directory, name);
            const rel = relative(root, absolute).replace(/\\/g, '/');
            if (ignored.includes(rel))
                continue;
            const info = await stat(absolute);
            if (info.isDirectory())
                await visit(absolute);
            else if (info.isFile()) {
                const content = await readFile(absolute, 'utf8');
                entries.push({ path: rel, sha256: createHash('sha256').update(content).digest('hex'), size_bytes: content.length });
            }
        }
    }
    await visit(root);
    return entries.sort((left, right) => left.path.localeCompare(right.path));
}
function dockerfile() {
    return `FROM node:22-alpine\nWORKDIR /opt/foundry\nCOPY runtime-package/ ./\nWORKDIR /opt/app\nCOPY template/ ./template/\nCOPY bootstrap.mjs healthcheck.mjs ./\nENV HOST=0.0.0.0 PORT=8788 DATA_DIR=/data\nVOLUME [\"/data\"]\nEXPOSE 8788\nHEALTHCHECK --interval=20s --timeout=5s --start-period=20s --retries=5 CMD [\"node\", \"healthcheck.mjs\"]\nCMD [\"node\", \"bootstrap.mjs\"]\n`;
}
function composeFile(credentialEnvironment) {
    return `services:\n  foundry-app:\n    build: .\n    restart: unless-stopped\n    environment:\n      - SERVICE_URL_FOUNDRY_8788\n      - PUBLIC_BASE_URL=\${PUBLIC_BASE_URL:?}\n      - PROVIDER_BASE_URL=\${PROVIDER_BASE_URL:?}\n      - ${credentialEnvironment}=\${${credentialEnvironment}:?}\n      - ADMIN_USERNAME=\${ADMIN_USERNAME:?}\n      - ADMIN_PASSWORD=\${ADMIN_PASSWORD:?}\n      - PORT=8788\n      - HOST=0.0.0.0\n    expose:\n      - \"8788\"\n    volumes:\n      - foundry-data:/data\n    healthcheck:\n      test: [\"CMD\", \"node\", \"healthcheck.mjs\"]\n      interval: 20s\n      timeout: 5s\n      retries: 5\n      start_period: 20s\nvolumes:\n  foundry-data:\n`;
}
function envExample(project) {
    return `PUBLIC_BASE_URL=https://mcp.example.com\nPROVIDER_BASE_URL=${project.provider.base_url}\n${project.provider.credential_environment}=replace-me\nADMIN_USERNAME=owner@example.com\nADMIN_PASSWORD=replace-with-a-strong-password\n`;
}
function bootstrapScript(project) {
    const metadata = getPackageMetadata();
    return `import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';\nimport { existsSync } from 'node:fs';\nimport { join } from 'node:path';\nimport { spawn } from 'node:child_process';\nimport { randomBytes, scryptSync } from 'node:crypto';\n\nconst dataDir = process.env.DATA_DIR || '/data';\nconst runtimeDir = join(dataDir, 'runtime');\nconst foundry = '/opt/foundry/dist/src/cli/foundry.js';\nconst publicBaseUrl = required('PUBLIC_BASE_URL').replace(/\\\/$/, '');\nconst providerBaseUrl = required('PROVIDER_BASE_URL').replace(/\\\/$/, '');\nconst adminUsername = required('ADMIN_USERNAME');\nconst adminPassword = required('ADMIN_PASSWORD');\nif (adminPassword.length < 8) throw new Error('ADMIN_PASSWORD must contain at least 8 characters.');\nawait mkdir(runtimeDir, { recursive: true });\nif (!existsSync(join(runtimeDir, 'chatgpt-app-config.json'))) {\n  await run(process.execPath, [foundry, 'app', 'init', runtimeDir, '--public-base-url', publicBaseUrl, '--force']);\n}\nfor (const name of ['contract-bundle.json','provider-adapters.json','provider-auth-bindings.json','credential-catalog.json']) {\n  await copyFile(join('/opt/app/template/artifacts', name), join(runtimeDir, name));\n}\nconst runtimePath = join(runtimeDir, 'runtime-config.json');\nconst runtime = JSON.parse(await readFile(runtimePath, 'utf8'));\nruntime.server.name = ${JSON.stringify(slug(project.name))};\nruntime.server.version = ${JSON.stringify(metadata.version)};\nruntime.provider.base_url = providerBaseUrl;\nruntime.artifacts.contract_bundle = './contract-bundle.json';\nruntime.artifacts.provider_adapter_bundle = './provider-adapters.json';\nruntime.artifacts.provider_auth_binding_bundle = './provider-auth-bindings.json';\nruntime.artifacts.credential_catalog = './credential-catalog.json';\nruntime.context.provider_ref = ${JSON.stringify(project.provider.provider_ref)};\nruntime.context.provider_account_ref = ${JSON.stringify(project.provider.provider_account_ref)};\nruntime.credentials.environment_by_handle = { ${JSON.stringify(project.provider.credential_handle)}: ${JSON.stringify(project.provider.credential_environment)} };\nawait writeFile(runtimePath, JSON.stringify(runtime, null, 2) + '\\n');\nconst appPath = join(runtimeDir, 'chatgpt-app-config.json');\nconst app = JSON.parse(await readFile(appPath, 'utf8'));\napp.public_base_url = publicBaseUrl;\napp.server.host = process.env.HOST || '0.0.0.0';\napp.server.port = Number(process.env.PORT || 8788);\napp.server.allowed_origins = ['https://chatgpt.com'];\napp.oauth.issuer = publicBaseUrl;\napp.oauth.resource = publicBaseUrl + '/mcp';\napp.oauth.users[0].username = adminUsername;\napp.oauth.users[0].display_name = 'Foundry Owner';\napp.oauth.users[0].password_hash = hashPassword(adminPassword);\nawait writeFile(appPath, JSON.stringify(app, null, 2) + '\\n');\nconst child = spawn(process.execPath, [foundry, 'app', 'serve', '--config', appPath], { stdio: 'inherit', env: process.env });\nchild.on('exit', (code) => { process.exitCode = code ?? 1; });\n\nfunction required(name) { const value = process.env[name]; if (!value) throw new Error(name + ' is required.'); return value; }\nfunction hashPassword(password) { const salt = randomBytes(16).toString('hex'); const digest = scryptSync(password, salt, 32).toString('hex'); return 'scrypt$' + salt + '$' + digest; }\nfunction run(command, args) { return new Promise((resolve, reject) => { const child = spawn(command, args, { stdio: 'inherit', env: process.env }); child.on('error', reject); child.on('exit', (code) => code === 0 ? resolve() : reject(new Error('Command failed with exit ' + code))); }); }\n`;
}
function healthcheckScript() {
    return `const port = process.env.PORT || '8788';\ntry { const response = await fetch('http://127.0.0.1:' + port + '/.well-known/oauth-protected-resource'); if (!response.ok) process.exitCode = 1; } catch { process.exitCode = 1; }\n`;
}
function coolifyGuide(project) {
    return `# Coolify deployment\n\n1. Push this directory to a Git repository.\n2. In Coolify, create a Docker Compose resource from the repository.\n3. Use \`docker-compose.coolify.yml\` as the compose file.\n4. Assign a public HTTPS domain to service \`foundry-app\` on port 8788.\n5. Fill every required environment variable shown by Coolify.\n6. Deploy and wait for the health check.\n7. Verify \`/.well-known/oauth-protected-resource\` and \`/mcp\`.\n\nProvider credential environment: \`${project.provider.credential_environment}\`.\n\nThe compose file is the source of truth. No host port is published directly.\n`;
}
function vpsGuide(project) {
    return `# Generic VPS deployment\n\n\`docker compose -f docker-compose.coolify.yml --env-file .env up -d --build\`\n\nPlace Caddy, Nginx, or another TLS proxy in front of container port 8788. Set PUBLIC_BASE_URL to the exact HTTPS origin used by ChatGPT. Provider: ${project.provider.provider_ref}.\n`;
}
function chatGptGuide(project) {
    const base = project.chatgpt_app.public_base_url.replace(/\/$/, '');
    return `# Connect to ChatGPT\n\nMCP URL after deployment: \`${base}/mcp\`\n\n1. Open ChatGPT developer mode.\n2. Create an app and enter the public MCP URL.\n3. Choose OAuth and scan tools.\n4. Complete consent with the deployed ADMIN_USERNAME and ADMIN_PASSWORD.\n5. Test read-only tools first, then approval-bound tools.\n`;
}
function packageReadme(project) {
    return `# ${project.name} — Deployment Package\n\nGenerated by Nümtema MCP Foundry Studio v1.3.\n\n- Dockerfile included\n- Coolify Compose included\n- Runtime is self-contained\n- Private keys are generated only on first container start\n- Provider secrets are read from environment variables only\n\nRead COOLIFY.md, VPS.md, and CHATGPT_CONNECT.md.\n`;
}
function slug(value) { return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'numtema-foundry-app'; }
//# sourceMappingURL=deployment-builder.js.map