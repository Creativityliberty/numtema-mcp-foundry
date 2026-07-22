#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileProviderAdapters } from '../adapters/provider-adapter-compiler.js';
import { planProviderRequest } from '../adapters/request-planner.js';
import { resolveCredentialPlan } from '../auth/credential-resolver.js';
import { loadCredentialCatalog, loadCredentialContext } from '../auth/loaders.js';
import { compileProviderAuthBindings } from '../auth/provider-auth-binding-compiler.js';
import { loadCapabilityMap } from '../compiler/capability-map-loader.js';
import { compileCapabilityMap } from '../compiler/tool-contract-compiler.js';
import { loadContractBundle } from '../contracts/contract-bundle.js';
import { loadOpenApiDocument } from '../inspection/openapi-loader.js';
import { inspectOpenApi } from '../inspection/source-inspector.js';
import { mapCapabilities } from '../mapping/capability-mapper.js';
import { validateBundle } from '../validation/validate-bundle.js';
import { authorizeExecution } from '../runtime/secure-preflight.js';
import { loadApprovalProof, loadBudgetAuthorization, loadCredentialResolutionPlan, loadProviderExecutionPlan, loadRuntimePolicyDecision, loadRuntimeTrustStore, loadAuthorizedExecutionEnvelope, loadSignedDispatchReceipt } from '../runtime/loaders.js';
import { commitDispatch, initializeDispatchLedger, readDispatchLedgerSnapshot, releaseDispatch, reserveDispatch, verifyDispatchReceipt } from '../dispatch/ledger-store.js';
import { getPackageMetadata, resolvePackageAsset } from '../system/package-assets.js';
import { renderDoctorReport, runDoctorChecks } from './doctor.js';
import { renderDemoReport, runDemoPipeline } from './demo.js';
import { initializeProject, renderInitProjectReport } from './init-project.js';
import { loadMcpAssembly } from '../mcp/config-loader.js';
import { startStdioServer } from '../mcp/stdio-server.js';
import { createMcpHttpServer } from '../mcp/http-server.js';
import { initializeMcpRuntime } from '../mcp/init-runtime.js';
import { initializeChatGptApp } from '../apps/init-app.js';
import { loadChatGptAppAssembly } from '../apps/app-assembly.js';
import { runChatGptAppSmoke } from '../apps/app-smoke.js';
import { createStudioProject, loadStudioProject } from '../studio/project-store.js';
import { buildStudioProject } from '../studio/pipeline-service.js';
import { buildDeploymentPackage } from '../studio/deployment-builder.js';
import { startStudioServer } from '../studio/server.js';
const defaultIo = {
    out: (value) => process.stdout.write(`${value}\n`),
    error: (value) => process.stderr.write(`${value}\n`)
};
export async function runCli(args, io = defaultIo) {
    const command = args[0];
    if (command === undefined || command === '--help' || command === '-h' || command === 'help') {
        io.out(renderHelp());
        return 0;
    }
    if (command === '--version' || command === '-v' || command === 'version') {
        io.out(getPackageMetadata().version);
        return 0;
    }
    if (command === 'doctor')
        return runDoctor(args.slice(1), io);
    if (command === 'demo')
        return runDemo(args.slice(1), io);
    if (command === 'init')
        return runInit(args.slice(1), io);
    if (command === 'validate')
        return runValidate(args.slice(1), io);
    if (command === 'inspect')
        return runInspect(args.slice(1), io);
    if (command === 'map')
        return runMap(args.slice(1), io);
    if (command === 'compile')
        return runCompile(args.slice(1), io);
    if (command === 'adapters')
        return runAdapters(args.slice(1), io);
    if (command === 'plan')
        return runPlan(args.slice(1), io);
    if (command === 'auth-bindings')
        return runAuthBindings(args.slice(1), io);
    if (command === 'auth-plan')
        return runAuthPlan(args.slice(1), io);
    if (command === 'preflight')
        return runPreflight(args.slice(1), io);
    if (command === 'ledger')
        return runLedger(args.slice(1), io);
    if (command === 'dispatch')
        return runDispatch(args.slice(1), io);
    if (command === 'mcp')
        return runMcp(args.slice(1), io);
    if (command === 'app')
        return runApp(args.slice(1), io);
    if (command === 'studio')
        return runStudio(args.slice(1), io);
    io.error(`USAGE_ERROR: unknown command ${command}. Run \`foundry --help\`.`);
    return 2;
}
async function runDoctor(args, io) {
    if (args.some((argument) => argument !== '--json')) {
        io.error('USAGE_ERROR: foundry doctor accepts only --json.');
        return 2;
    }
    try {
        const report = runDoctorChecks();
        io.out(args.includes('--json') ? `${JSON.stringify(report, null, 2)}\n` : renderDoctorReport(report));
        return report.healthy ? 0 : 1;
    }
    catch (error) {
        io.error(`DOCTOR_ERROR: ${errorMessage(error)}`);
        return 1;
    }
}
async function runDemo(args, io) {
    let json = false;
    let outputDirectory;
    for (let index = 0; index < args.length; index += 1) {
        const argument = args[index];
        if (argument === '--json') {
            json = true;
            continue;
        }
        if (argument === '--out-dir') {
            outputDirectory = requireOptionValue(args, index, '--out-dir');
            index += 1;
            continue;
        }
        io.error(`USAGE_ERROR: unknown option ${argument}.`);
        return 2;
    }
    try {
        const report = await runDemoPipeline(outputDirectory === undefined ? {} : { outputDirectory });
        io.out(json ? `${JSON.stringify(report, null, 2)}\n` : renderDemoReport(report));
        return report.valid ? 0 : 1;
    }
    catch (error) {
        io.error(`DEMO_ERROR: ${errorMessage(error)}`);
        return 2;
    }
}
async function runInit(args, io) {
    let directory = 'mcp-foundry-project';
    let name;
    let force = false;
    let json = false;
    let directorySet = false;
    for (let index = 0; index < args.length; index += 1) {
        const argument = args[index];
        if (!argument.startsWith('--') && !directorySet) {
            directory = argument;
            directorySet = true;
            continue;
        }
        if (argument === '--json') {
            json = true;
            continue;
        }
        if (argument === '--force') {
            force = true;
            continue;
        }
        if (argument === '--name') {
            name = requireOptionValue(args, index, '--name');
            index += 1;
            continue;
        }
        io.error(`USAGE_ERROR: unknown option ${argument}.`);
        return 2;
    }
    try {
        const options = name === undefined ? { directory, force } : { directory, name, force };
        const report = await initializeProject(options);
        io.out(json ? `${JSON.stringify(report, null, 2)}\n` : renderInitProjectReport(report));
        return 0;
    }
    catch (error) {
        io.error(`INIT_ERROR: ${errorMessage(error)}`);
        return 2;
    }
}
async function runValidate(args, io) {
    let parsed;
    try {
        parsed = parseValidateArguments(args);
    }
    catch (error) {
        io.error(`USAGE_ERROR: ${errorMessage(error)}`);
        return 2;
    }
    try {
        const bundle = await loadContractBundle(parsed.filePath);
        const report = await validateBundle(bundle, { schemaDirectory: parsed.schemaDirectory });
        io.out(parsed.json ? `${JSON.stringify(report, null, 2)}\n` : renderValidationReport(parsed.filePath, report));
        return report.valid ? 0 : 1;
    }
    catch (error) {
        io.error(`LOAD_ERROR: ${errorMessage(error)}`);
        return 2;
    }
}
async function runInspect(args, io) {
    let parsed;
    try {
        parsed = parseArtifactArguments(args, 'inspect');
    }
    catch (error) {
        io.error(`USAGE_ERROR: ${errorMessage(error)}`);
        return 2;
    }
    try {
        const document = await loadOpenApiDocument(parsed.filePath);
        const artifact = inspectOpenApi(document, parsed.filePath);
        await emitArtifact(artifact, parsed, io, renderInspectionReport(parsed.filePath, artifact));
        return 0;
    }
    catch (error) {
        io.error(`LOAD_ERROR: ${errorMessage(error)}`);
        return 2;
    }
}
async function runMap(args, io) {
    let parsed;
    try {
        parsed = parseArtifactArguments(args, 'map');
    }
    catch (error) {
        io.error(`USAGE_ERROR: ${errorMessage(error)}`);
        return 2;
    }
    try {
        const document = await loadOpenApiDocument(parsed.filePath);
        const inspection = inspectOpenApi(document, parsed.filePath);
        const artifact = mapCapabilities(inspection);
        await emitArtifact(artifact, parsed, io, renderCapabilityMapReport(parsed.filePath, artifact));
        return 0;
    }
    catch (error) {
        io.error(`LOAD_ERROR: ${errorMessage(error)}`);
        return 2;
    }
}
async function runCompile(args, io) {
    let parsed;
    try {
        parsed = parseCompileArguments(args);
    }
    catch (error) {
        io.error(`USAGE_ERROR: ${errorMessage(error)}`);
        return 2;
    }
    try {
        const capabilityMap = await loadCapabilityMap(parsed.filePath, { schemaDirectory: parsed.schemaDirectory });
        const result = compileCapabilityMap(capabilityMap);
        const report = await validateBundle(result.bundle, { schemaDirectory: parsed.schemaDirectory });
        const serialized = `${JSON.stringify(result.bundle, null, 2)}\n`;
        if (parsed.outFile !== null) {
            await writeFile(resolve(parsed.outFile), serialized, 'utf8');
        }
        if (parsed.json) {
            io.out(serialized);
        }
        else {
            const human = renderCompilationReport(parsed.filePath, result, report);
            io.out(parsed.outFile === null ? human : `${human}\nWROTE ${parsed.outFile}`);
        }
        return report.valid ? 0 : 1;
    }
    catch (error) {
        io.error(`LOAD_ERROR: ${errorMessage(error)}`);
        return 2;
    }
}
async function runAdapters(args, io) {
    let parsed;
    try {
        parsed = parseArtifactArguments(args, 'adapters');
    }
    catch (error) {
        io.error(`USAGE_ERROR: ${errorMessage(error)}`);
        return 2;
    }
    try {
        const bundle = await loadContractBundle(parsed.filePath);
        const artifact = compileProviderAdapters(bundle);
        await emitProviderArtifact(artifact, parsed, io, renderAdapterReport(parsed.filePath, artifact));
        return 0;
    }
    catch (error) {
        io.error(`LOAD_ERROR: ${errorMessage(error)}`);
        return 2;
    }
}
async function runPlan(args, io) {
    let parsed;
    try {
        parsed = parsePlanArguments(args);
    }
    catch (error) {
        io.error(`USAGE_ERROR: ${errorMessage(error)}`);
        return 2;
    }
    try {
        const bundle = await loadContractBundle(parsed.filePath);
        const adapters = compileProviderAdapters(bundle);
        const adapter = adapters.adapters.find((candidate) => candidate.tool_name === parsed.toolName || candidate.tool_id === parsed.toolName);
        if (!adapter)
            throw new Error(`UNKNOWN_TOOL: ${parsed.toolName}`);
        const rawArguments = JSON.parse(await readFile(resolve(parsed.argsFile), 'utf8'));
        if (!isRecord(rawArguments))
            throw new Error('INVALID_ARGUMENTS: arguments file root must be an object.');
        const options = parsed.idempotencyKey === undefined
            ? { baseUrl: parsed.baseUrl }
            : { baseUrl: parsed.baseUrl, idempotencyKey: parsed.idempotencyKey };
        const artifact = planProviderRequest(adapter, rawArguments, options);
        await emitProviderArtifact(artifact, parsed, io, renderPlanReport(parsed.filePath, artifact));
        return 0;
    }
    catch (error) {
        io.error(`LOAD_ERROR: ${errorMessage(error)}`);
        return 2;
    }
}
async function runAuthBindings(args, io) {
    let parsed;
    try {
        parsed = parseArtifactArguments(args, 'auth-bindings');
    }
    catch (error) {
        io.error(`USAGE_ERROR: ${errorMessage(error)}`);
        return 2;
    }
    try {
        const bundle = await loadContractBundle(parsed.filePath);
        const adapters = compileProviderAdapters(bundle);
        const artifact = compileProviderAuthBindings(bundle, adapters);
        await emitProviderArtifact(artifact, parsed, io, renderAuthBindingReport(parsed.filePath, artifact));
        return 0;
    }
    catch (error) {
        io.error(`LOAD_ERROR: ${errorMessage(error)}`);
        return 2;
    }
}
async function runAuthPlan(args, io) {
    let parsed;
    try {
        parsed = parseAuthPlanArguments(args);
    }
    catch (error) {
        io.error(`USAGE_ERROR: ${errorMessage(error)}`);
        return 2;
    }
    try {
        const bundle = await loadContractBundle(parsed.filePath);
        const adapters = compileProviderAdapters(bundle);
        const adapter = adapters.adapters.find((candidate) => candidate.tool_name === parsed.toolName || candidate.tool_id === parsed.toolName);
        if (!adapter)
            throw new Error(`UNKNOWN_TOOL: ${parsed.toolName}`);
        if (adapter.credential.auth_ref === null)
            throw new Error(`AUTH_NOT_REQUIRED: ${parsed.toolName}`);
        const bindings = compileProviderAuthBindings(bundle, adapters);
        const binding = bindings.bindings.find((candidate) => candidate.auth_ref === adapter.credential.auth_ref);
        if (!binding)
            throw new Error(`AUTH_BINDING_NOT_FOUND: ${adapter.credential.auth_ref}`);
        const catalog = await loadCredentialCatalog(parsed.credentialsFile);
        const context = await loadCredentialContext(parsed.contextFile);
        const artifact = resolveCredentialPlan(binding, adapter, catalog, context);
        await emitProviderArtifact(artifact, parsed, io, renderAuthPlanReport(parsed.filePath, artifact));
        return artifact.ready ? 0 : 1;
    }
    catch (error) {
        io.error(`LOAD_ERROR: ${errorMessage(error)}`);
        return 2;
    }
}
async function runPreflight(args, io) {
    let parsed;
    try {
        parsed = parsePreflightArguments(args);
    }
    catch (error) {
        io.error(`USAGE_ERROR: ${errorMessage(error)}`);
        return 2;
    }
    try {
        const executionPlan = await loadProviderExecutionPlan(parsed.executionPlanFile);
        const credentialPlan = await loadCredentialResolutionPlan(parsed.credentialPlanFile);
        const policy = await loadRuntimePolicyDecision(parsed.policyFile);
        const trustStore = await loadRuntimeTrustStore(parsed.trustStoreFile);
        const input = { executionPlan, credentialPlan, policy, trustStore, at: parsed.at };
        if (parsed.approvalFile !== null)
            input.approval = await loadApprovalProof(parsed.approvalFile);
        if (parsed.budgetFile !== null)
            input.budget = await loadBudgetAuthorization(parsed.budgetFile);
        const artifact = authorizeExecution(input);
        await emitRuntimeArtifact(artifact, parsed, io, renderPreflightReport(artifact));
        return artifact.dispatch_permitted ? 0 : 1;
    }
    catch (error) {
        io.error(`LOAD_ERROR: ${errorMessage(error)}`);
        return 2;
    }
}
async function runLedger(args, io) {
    const subcommand = args[0];
    try {
        if (subcommand === 'init') {
            const directory = args[1];
            if (!directory || directory.startsWith('--'))
                throw new Error('ledger directory is required.');
            let at = new Date().toISOString();
            let ledgerId;
            let json = false;
            for (let index = 2; index < args.length; index += 1) {
                const argument = args[index];
                if (argument === '--json') {
                    json = true;
                    continue;
                }
                if (argument === '--at') {
                    at = requireOptionValue(args, index, '--at');
                    index += 1;
                    continue;
                }
                if (argument === '--ledger-id') {
                    ledgerId = requireOptionValue(args, index, '--ledger-id');
                    index += 1;
                    continue;
                }
                throw new Error(`unknown option ${argument}.`);
            }
            const input = ledgerId === undefined ? { directory, at } : { directory, at, ledgerId };
            const metadata = await initializeDispatchLedger(input);
            io.out(json ? `${JSON.stringify(metadata, null, 2)}\n` : `LEDGER_READY ${metadata.ledger_id}\n- directory: ${resolve(directory)}\n- storage: append-only JSONL`);
            return 0;
        }
        if (subcommand === 'status') {
            let directory = null;
            let json = false;
            let outFile = null;
            for (let index = 1; index < args.length; index += 1) {
                const argument = args[index];
                if (argument === '--json') {
                    json = true;
                    continue;
                }
                if (argument === '--ledger') {
                    directory = requireOptionValue(args, index, '--ledger');
                    index += 1;
                    continue;
                }
                if (argument === '--out') {
                    outFile = requireOptionValue(args, index, '--out');
                    index += 1;
                    continue;
                }
                throw new Error(`unknown option ${argument}.`);
            }
            if (directory === null)
                throw new Error('--ledger is required.');
            const snapshot = await readDispatchLedgerSnapshot(directory);
            const serialized = `${JSON.stringify(snapshot, null, 2)}\n`;
            if (outFile !== null)
                await writeFile(resolve(outFile), serialized, 'utf8');
            if (json)
                io.out(serialized);
            else
                io.out(`LEDGER_STATUS ${snapshot.ledger_id}\n- sequence: ${snapshot.sequence}\n- reservations: ${snapshot.reservations.length}\n- active budget bindings: ${snapshot.budget_totals.filter((entry) => entry.active_amount > 0).length}${outFile === null ? '' : `\nWROTE ${outFile}`}`);
            return 0;
        }
        throw new Error('expected `ledger init` or `ledger status`.');
    }
    catch (error) {
        io.error(`LEDGER_ERROR: ${errorMessage(error)}`);
        return isDispatchRejection(error) ? 1 : 2;
    }
}
async function runDispatch(args, io) {
    const subcommand = args[0];
    try {
        if (subcommand === 'verify') {
            let receiptFile = null;
            let trustStoreFile = null;
            let at = null;
            let json = false;
            for (let index = 1; index < args.length; index += 1) {
                const argument = args[index];
                if (argument === '--json') {
                    json = true;
                    continue;
                }
                if (argument === '--receipt') {
                    receiptFile = requireOptionValue(args, index, '--receipt');
                    index += 1;
                    continue;
                }
                if (argument === '--trust-store') {
                    trustStoreFile = requireOptionValue(args, index, '--trust-store');
                    index += 1;
                    continue;
                }
                if (argument === '--at') {
                    at = requireOptionValue(args, index, '--at');
                    index += 1;
                    continue;
                }
                throw new Error(`unknown option ${argument}.`);
            }
            if (receiptFile === null)
                throw new Error('--receipt is required.');
            if (trustStoreFile === null)
                throw new Error('--trust-store is required.');
            if (at === null)
                throw new Error('--at is required.');
            const receipt = await loadSignedDispatchReceipt(receiptFile);
            const result = verifyDispatchReceipt(receipt, await loadRuntimeTrustStore(trustStoreFile), at);
            io.out(json ? `${JSON.stringify(result, null, 2)}\n` : `${result.valid ? 'RECEIPT_VALID' : 'RECEIPT_INVALID'} ${receipt.receipt_id}\n- errors: ${result.errors.length}`);
            return result.valid ? 0 : 1;
        }
        let ledger = null;
        let envelopeFile = null;
        let reservationId = null;
        let signingKeyFile = null;
        let keyId = null;
        let at = null;
        let reason = null;
        let json = false;
        let outFile = null;
        for (let index = 1; index < args.length; index += 1) {
            const argument = args[index];
            if (argument === '--json') {
                json = true;
                continue;
            }
            if (argument === '--ledger') {
                ledger = requireOptionValue(args, index, '--ledger');
                index += 1;
                continue;
            }
            if (argument === '--envelope') {
                envelopeFile = requireOptionValue(args, index, '--envelope');
                index += 1;
                continue;
            }
            if (argument === '--reservation') {
                reservationId = requireOptionValue(args, index, '--reservation');
                index += 1;
                continue;
            }
            if (argument === '--signing-key') {
                signingKeyFile = requireOptionValue(args, index, '--signing-key');
                index += 1;
                continue;
            }
            if (argument === '--key-id') {
                keyId = requireOptionValue(args, index, '--key-id');
                index += 1;
                continue;
            }
            if (argument === '--at') {
                at = requireOptionValue(args, index, '--at');
                index += 1;
                continue;
            }
            if (argument === '--reason') {
                const value = requireOptionValue(args, index, '--reason');
                if (value !== 'cancelled' && value !== 'expired')
                    throw new Error('--reason must be cancelled or expired.');
                reason = value;
                index += 1;
                continue;
            }
            if (argument === '--out') {
                outFile = requireOptionValue(args, index, '--out');
                index += 1;
                continue;
            }
            throw new Error(`unknown option ${argument}.`);
        }
        if (ledger === null)
            throw new Error('--ledger is required.');
        if (signingKeyFile === null)
            throw new Error('--signing-key is required.');
        if (keyId === null)
            throw new Error('--key-id is required.');
        if (at === null)
            throw new Error('--at is required.');
        const signingKeyPem = await readFile(resolve(signingKeyFile), 'utf8');
        let result;
        if (subcommand === 'reserve') {
            if (envelopeFile === null)
                throw new Error('--envelope is required.');
            const envelope = await loadAuthorizedExecutionEnvelope(envelopeFile);
            result = await reserveDispatch({ directory: ledger, envelope, signingKeyPem, keyId, at });
        }
        else if (subcommand === 'commit') {
            if (reservationId === null)
                throw new Error('--reservation is required.');
            result = await commitDispatch({ directory: ledger, reservationId, signingKeyPem, keyId, at });
        }
        else if (subcommand === 'release') {
            if (reservationId === null)
                throw new Error('--reservation is required.');
            if (reason === null)
                throw new Error('--reason is required.');
            result = await releaseDispatch({ directory: ledger, reservationId, reason, signingKeyPem, keyId, at });
        }
        else {
            throw new Error('expected `dispatch reserve`, `dispatch commit`, `dispatch release`, or `dispatch verify`.');
        }
        await emitDispatchReceipt(result.receipt, outFile, json, io, renderDispatchReport(result));
        return 0;
    }
    catch (error) {
        io.error(`DISPATCH_ERROR: ${errorMessage(error)}`);
        return isDispatchRejection(error) ? 1 : 2;
    }
}
async function runMcp(args, io) {
    const subcommand = args[0];
    if (subcommand !== 'inspect' && subcommand !== 'serve' && subcommand !== 'smoke' && subcommand !== 'init') {
        io.error('USAGE_ERROR: expected `foundry mcp init`, `foundry mcp inspect`, `foundry mcp serve`, or `foundry mcp smoke`.');
        return 2;
    }
    if (subcommand === 'init') {
        let directory = 'numtema-mcp-runtime';
        let force = false;
        for (let index = 1; index < args.length; index += 1) {
            const argument = args[index];
            if (argument === '--force') {
                force = true;
                continue;
            }
            if (argument.startsWith('--')) {
                io.error(`USAGE_ERROR: unknown option ${argument}.`);
                return 2;
            }
            directory = argument;
        }
        try {
            const report = await initializeMcpRuntime(directory, force);
            io.out(`MCP_INIT_OK ${report.directory}\n- config: ${report.config_file}\n- mock provider: ${report.mock_provider_file}\n- generated demo keys: ${report.generated_private_keys}\n- secret material in config: false`);
            return 0;
        }
        catch (error) {
            io.error(`MCP_INIT_ERROR: ${errorMessage(error)}`);
            return 2;
        }
    }
    let configFile = null;
    let json = false;
    let toolName = null;
    let argsFile = null;
    for (let index = 1; index < args.length; index += 1) {
        const argument = args[index];
        if (argument === '--json') {
            json = true;
            continue;
        }
        if (argument === '--config') {
            configFile = requireOptionValue(args, index, '--config');
            index += 1;
            continue;
        }
        if (argument === '--tool') {
            toolName = requireOptionValue(args, index, '--tool');
            index += 1;
            continue;
        }
        if (argument === '--args') {
            argsFile = requireOptionValue(args, index, '--args');
            index += 1;
            continue;
        }
        io.error(`USAGE_ERROR: unknown option ${argument}.`);
        return 2;
    }
    if (configFile === null) {
        io.error('USAGE_ERROR: --config is required.');
        return 2;
    }
    try {
        const assembly = await loadMcpAssembly(configFile);
        if (subcommand === 'inspect') {
            io.out(json ? `${JSON.stringify(assembly.summary, null, 2)}\n` : renderMcpSummary(assembly.summary));
            return 0;
        }
        if (subcommand === 'smoke') {
            const initialized = await assembly.router.handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: assembly.summary.protocol_version, capabilities: {}, clientInfo: { name: 'foundry-smoke', version: getPackageMetadata().version } } });
            const listed = await assembly.router.handle({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
            let called = null;
            if (toolName !== null) {
                const toolArgs = argsFile === null ? {} : JSON.parse(await readFile(resolve(argsFile), 'utf8'));
                called = await assembly.router.handle({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: toolName, arguments: toolArgs, _meta: { idempotencyKey: `smoke-${Date.now()}` } } });
            }
            const report = { initialized, listed, called, network_call_requested: toolName !== null };
            io.out(json ? `${JSON.stringify(report, null, 2)}\n` : renderMcpSmoke(report));
            if (called && typeof called === 'object' && 'result' in called) {
                const result = called.result;
                return result.isError === true ? 1 : 0;
            }
            return 0;
        }
        if (assembly.config.server.transport.type === 'stdio') {
            await startStdioServer(assembly.router);
            return 0;
        }
        const server = createMcpHttpServer(assembly.router, {
            path: assembly.http.path,
            allowedOrigins: assembly.http.allowedOrigins,
            ...(assembly.http.bearerToken === undefined ? {} : { bearerToken: assembly.http.bearerToken }),
            requireMcpHeaders: assembly.http.requireMcpHeaders
        });
        await new Promise((resolvePromise) => server.listen(assembly.http.port, assembly.http.host, resolvePromise));
        io.error(`MCP_HTTP_READY http://${assembly.http.host}:${assembly.http.port}${assembly.http.path}`);
        await new Promise(() => { });
        return 0;
    }
    catch (error) {
        io.error(`MCP_ERROR: ${errorMessage(error)}`);
        return 2;
    }
}
function renderMcpSummary(summary) {
    return [
        `MCP_RUNTIME_READY ${summary.server_name}@${summary.server_version}`,
        `- protocol: ${summary.protocol_version}`,
        `- transport: ${summary.transport}`,
        `- tools: ${summary.tool_count}`,
        `- adapters: ${summary.adapter_count}`,
        `- authenticated tools: ${summary.authenticated_tool_count}`,
        `- high-risk tools: ${summary.high_risk_tool_count}`,
        `- provider: ${summary.provider_base_url}`,
        `- ledger: ${summary.ledger_directory}`,
        '- secrets in config: false'
    ].join('\n');
}
function renderMcpSmoke(report) {
    const listed = report.listed && typeof report.listed === 'object' && 'result' in report.listed
        ? (report.listed.result.tools?.length ?? 0)
        : 0;
    const callError = report.called && typeof report.called === 'object' && 'result' in report.called
        ? (report.called.result.isError ?? false)
        : false;
    return [
        'MCP_SMOKE_OK',
        `- tools listed: ${listed}`,
        `- provider call requested: ${report.network_call_requested}`,
        `- tool result error: ${callError}`
    ].join('\n');
}
async function emitDispatchReceipt(receipt, outFile, json, io, humanReport) {
    const serialized = `${JSON.stringify(receipt, null, 2)}\n`;
    if (outFile !== null)
        await writeFile(resolve(outFile), serialized, 'utf8');
    if (json)
        io.out(serialized);
    else
        io.out(outFile === null ? humanReport : `${humanReport}\nWROTE ${outFile}`);
}
function renderDispatchReport(result) {
    return [
        `${result.reservation.state === 'reserved' ? 'DISPATCH_RESERVED' : result.reservation.state === 'dispatched' ? 'DISPATCH_COMMITTED' : 'DISPATCH_RELEASED'} ${result.reservation.reservation_id}`,
        `- authorization: ${result.reservation.authorization_id}`,
        `- sequence: ${result.reservation.sequence}`,
        `- replayed: ${result.replayed}`,
        `- receipt: ${result.receipt.receipt_id}`,
        `- network executed: false`
    ].join('\n');
}
function isDispatchRejection(error) {
    const message = errorMessage(error);
    return /(?:CONFLICT|CONSUMED|EXCEEDED|EXPIRED|NOT_AUTHORIZED|TRANSITION|TERMINAL|ALREADY_|CORRUPT|SECRET_MATERIAL|INTEGRITY_MISMATCH)/.test(message);
}
async function emitProviderArtifact(artifact, parsed, io, humanReport) {
    const serialized = `${JSON.stringify(artifact, null, 2)}\n`;
    if (parsed.outFile !== null)
        await writeFile(resolve(parsed.outFile), serialized, 'utf8');
    if (parsed.json)
        io.out(serialized);
    else if (parsed.outFile !== null)
        io.out(`${humanReport}\nWROTE ${parsed.outFile}`);
    else
        io.out(humanReport);
}
async function emitRuntimeArtifact(artifact, parsed, io, humanReport) {
    const serialized = `${JSON.stringify(artifact, null, 2)}\n`;
    if (parsed.outFile !== null)
        await writeFile(resolve(parsed.outFile), serialized, 'utf8');
    if (parsed.json)
        io.out(serialized);
    else if (parsed.outFile !== null)
        io.out(`${humanReport}\nWROTE ${parsed.outFile}`);
    else
        io.out(humanReport);
}
async function emitArtifact(artifact, parsed, io, humanReport) {
    const serialized = `${JSON.stringify(artifact, null, 2)}\n`;
    if (parsed.outFile !== null) {
        await writeFile(resolve(parsed.outFile), serialized, 'utf8');
    }
    if (parsed.json) {
        io.out(serialized);
    }
    else if (parsed.outFile !== null) {
        io.out(`${humanReport}\nWROTE ${parsed.outFile}`);
    }
    else {
        io.out(humanReport);
    }
}
function parseValidateArguments(args) {
    const filePath = args[0];
    if (!filePath || filePath.startsWith('--')) {
        throw new Error('bundle path is required.');
    }
    let json = false;
    let schemaDirectory = resolvePackageAsset('schemas');
    for (let index = 1; index < args.length; index += 1) {
        const argument = args[index];
        if (argument === '--json') {
            json = true;
            continue;
        }
        if (argument === '--schemas') {
            const value = args[index + 1];
            if (!value)
                throw new Error('--schemas requires a directory.');
            schemaDirectory = value;
            index += 1;
            continue;
        }
        throw new Error(`unknown option ${argument}.`);
    }
    return { filePath, json, schemaDirectory };
}
function parseCompileArguments(args) {
    const filePath = args[0];
    if (!filePath || filePath.startsWith('--')) {
        throw new Error('CapabilityMap artifact path is required for compile.');
    }
    let json = false;
    let outFile = null;
    let schemaDirectory = resolvePackageAsset('schemas');
    for (let index = 1; index < args.length; index += 1) {
        const argument = args[index];
        if (argument === '--json') {
            json = true;
            continue;
        }
        if (argument === '--out') {
            const value = args[index + 1];
            if (!value)
                throw new Error('--out requires a file path.');
            outFile = value;
            index += 1;
            continue;
        }
        if (argument === '--schemas') {
            const value = args[index + 1];
            if (!value)
                throw new Error('--schemas requires a directory.');
            schemaDirectory = value;
            index += 1;
            continue;
        }
        throw new Error(`unknown option ${argument}.`);
    }
    return { filePath, json, outFile, schemaDirectory };
}
function parseArtifactArguments(args, command) {
    const filePath = args[0];
    if (!filePath || filePath.startsWith('--')) {
        throw new Error(`OpenAPI source path is required for ${command}.`);
    }
    let json = false;
    let outFile = null;
    for (let index = 1; index < args.length; index += 1) {
        const argument = args[index];
        if (argument === '--json') {
            json = true;
            continue;
        }
        if (argument === '--out') {
            const value = args[index + 1];
            if (!value)
                throw new Error('--out requires a file path.');
            outFile = value;
            index += 1;
            continue;
        }
        throw new Error(`unknown option ${argument}.`);
    }
    return { filePath, json, outFile };
}
function parseAuthPlanArguments(args) {
    const filePath = args[0];
    if (!filePath || filePath.startsWith('--'))
        throw new Error('ContractBundle path is required for auth-plan.');
    let toolName = null;
    let credentialsFile = null;
    let contextFile = null;
    let json = false;
    let outFile = null;
    for (let index = 1; index < args.length; index += 1) {
        const argument = args[index];
        if (argument === '--json') {
            json = true;
            continue;
        }
        if (argument === '--tool') {
            toolName = requireOptionValue(args, index, '--tool');
            index += 1;
            continue;
        }
        if (argument === '--credentials') {
            credentialsFile = requireOptionValue(args, index, '--credentials');
            index += 1;
            continue;
        }
        if (argument === '--context') {
            contextFile = requireOptionValue(args, index, '--context');
            index += 1;
            continue;
        }
        if (argument === '--out') {
            outFile = requireOptionValue(args, index, '--out');
            index += 1;
            continue;
        }
        throw new Error(`unknown option ${argument}.`);
    }
    if (toolName === null)
        throw new Error('--tool is required.');
    if (credentialsFile === null)
        throw new Error('--credentials is required.');
    if (contextFile === null)
        throw new Error('--context is required.');
    return { filePath, toolName, credentialsFile, contextFile, json, outFile };
}
function parsePreflightArguments(args) {
    let executionPlanFile = null;
    let credentialPlanFile = null;
    let policyFile = null;
    let approvalFile = null;
    let budgetFile = null;
    let trustStoreFile = null;
    let at = null;
    let json = false;
    let outFile = null;
    for (let index = 0; index < args.length; index += 1) {
        const argument = args[index];
        if (argument === '--json') {
            json = true;
            continue;
        }
        if (argument === '--execution-plan') {
            executionPlanFile = requireOptionValue(args, index, '--execution-plan');
            index += 1;
            continue;
        }
        if (argument === '--credential-plan') {
            credentialPlanFile = requireOptionValue(args, index, '--credential-plan');
            index += 1;
            continue;
        }
        if (argument === '--policy') {
            policyFile = requireOptionValue(args, index, '--policy');
            index += 1;
            continue;
        }
        if (argument === '--approval') {
            approvalFile = requireOptionValue(args, index, '--approval');
            index += 1;
            continue;
        }
        if (argument === '--budget') {
            budgetFile = requireOptionValue(args, index, '--budget');
            index += 1;
            continue;
        }
        if (argument === '--trust-store') {
            trustStoreFile = requireOptionValue(args, index, '--trust-store');
            index += 1;
            continue;
        }
        if (argument === '--at') {
            at = requireOptionValue(args, index, '--at');
            index += 1;
            continue;
        }
        if (argument === '--out') {
            outFile = requireOptionValue(args, index, '--out');
            index += 1;
            continue;
        }
        throw new Error(`unknown option ${argument}.`);
    }
    if (executionPlanFile === null)
        throw new Error('--execution-plan is required.');
    if (credentialPlanFile === null)
        throw new Error('--credential-plan is required.');
    if (policyFile === null)
        throw new Error('--policy is required.');
    if (trustStoreFile === null)
        throw new Error('--trust-store is required.');
    if (at === null)
        throw new Error('--at is required.');
    return { executionPlanFile, credentialPlanFile, policyFile, approvalFile, budgetFile, trustStoreFile, at, json, outFile };
}
function parsePlanArguments(args) {
    const filePath = args[0];
    if (!filePath || filePath.startsWith('--'))
        throw new Error('ContractBundle path is required for plan.');
    let toolName = null;
    let baseUrl = null;
    let argsFile = null;
    let idempotencyKey;
    let json = false;
    let outFile = null;
    for (let index = 1; index < args.length; index += 1) {
        const argument = args[index];
        if (argument === '--json') {
            json = true;
            continue;
        }
        if (argument === '--tool') {
            toolName = requireOptionValue(args, index, '--tool');
            index += 1;
            continue;
        }
        if (argument === '--base-url') {
            baseUrl = requireOptionValue(args, index, '--base-url');
            index += 1;
            continue;
        }
        if (argument === '--args') {
            argsFile = requireOptionValue(args, index, '--args');
            index += 1;
            continue;
        }
        if (argument === '--idempotency-key') {
            idempotencyKey = requireOptionValue(args, index, '--idempotency-key');
            index += 1;
            continue;
        }
        if (argument === '--out') {
            outFile = requireOptionValue(args, index, '--out');
            index += 1;
            continue;
        }
        throw new Error(`unknown option ${argument}.`);
    }
    if (toolName === null)
        throw new Error('--tool is required.');
    if (baseUrl === null)
        throw new Error('--base-url is required.');
    if (argsFile === null)
        throw new Error('--args is required.');
    const result = { filePath, toolName, baseUrl, argsFile, json, outFile };
    if (idempotencyKey !== undefined)
        result.idempotencyKey = idempotencyKey;
    return result;
}
function requireOptionValue(args, index, option) {
    const value = args[index + 1];
    if (!value)
        throw new Error(`${option} requires a value.`);
    return value;
}
function renderValidationReport(filePath, report) {
    const status = report.valid ? 'VALID' : 'INVALID';
    const header = `${status} ${filePath} — ${report.error_count} error(s), ${report.warning_count} warning(s)`;
    if (report.issues.length === 0)
        return header;
    const details = report.issues.map((issue) => {
        const location = issue.path || '/';
        return `- [${issue.severity.toUpperCase()}] ${issue.code} ${location}: ${issue.message}`;
    });
    return [header, ...details].join('\n');
}
function renderInspectionReport(filePath, artifact) {
    const header = `INSPECTED ${filePath} — ${artifact.summary.operation_count} operation(s), ${artifact.summary.domains.length} domain(s), ${artifact.summary.security_scheme_count} security scheme(s)`;
    const lines = artifact.operations.map((operation) => {
        const signals = Object.entries(operation.signals)
            .filter(([, active]) => active)
            .map(([name]) => name)
            .join(', ');
        return `- ${operation.method.toUpperCase()} ${operation.path} → ${operation.operation_id} [${operation.domain}]${signals ? ` {${signals}}` : ''}`;
    });
    return [header, ...lines].join('\n');
}
function renderCapabilityMapReport(filePath, artifact) {
    const header = `MAPPED ${filePath} — ${artifact.summary.capability_count} capability candidate(s), ${artifact.summary.workflow_hint_count} workflow hint(s)`;
    const lines = artifact.capabilities.map((capability) => `- ${capability.name} [${capability.risk_class}/${capability.governance.decision}] ← ${capability.source_operation_id}`);
    return [header, ...lines].join('\n');
}
function renderCompilationReport(filePath, result, report) {
    const status = report.valid ? 'COMPILED' : 'COMPILED_INVALID';
    return [
        `${status} ${filePath} — ${result.summary.tool_count} tool(s), ${result.summary.policy_count} policy contract(s), ${result.summary.approval_count} approval contract(s), ${result.summary.recovery_count} recovery contract(s)`,
        `- validation: ${report.error_count} error(s), ${report.warning_count} warning(s)`,
        `- compiler warnings: ${result.warnings.length}`
    ].join('\n');
}
function renderAdapterReport(filePath, artifact) {
    return [
        `ADAPTED ${filePath} — ${artifact.summary.adapter_count} HTTP adapter(s), ${artifact.summary.skipped_tool_count} skipped tool(s)`,
        `- idempotency required: ${artifact.summary.idempotency_required_count}`,
        `- body bindings: ${artifact.summary.body_binding_count}`,
        `- binary bindings: ${artifact.summary.binary_binding_count}`
    ].join('\n');
}
function renderPlanReport(filePath, artifact) {
    return [
        `PLANNED ${filePath} — ${artifact.request.method} ${artifact.request.url}`,
        `- tool: ${artifact.tool_id}`,
        `- dry run: true`,
        `- credential material included: false`,
        `- idempotency: ${artifact.idempotency.mode}/${artifact.idempotency.key_source}`
    ].join('\n');
}
function renderAuthBindingReport(filePath, artifact) {
    return [
        `AUTH_BOUND ${filePath} — ${artifact.summary.binding_count} binding(s), ${artifact.summary.unreferenced_auth_count} unreferenced AuthContract(s)`,
        `- OAuth bindings: ${artifact.summary.oauth_binding_count}`,
        `- API key bindings: ${artifact.summary.api_key_binding_count}`,
        `- secret material allowed in artifacts: false`
    ].join('\n');
}
function renderAuthPlanReport(filePath, artifact) {
    return [
        `${artifact.ready ? 'AUTH_READY' : 'AUTH_BLOCKED'} ${filePath} — ${artifact.tool_id}`,
        `- credential selected: ${artifact.selected_credential?.account_id ?? 'none'}`,
        `- scopes missing: ${artifact.scope_check.missing.length}`,
        `- audience matched: ${artifact.audience_check.matched}`,
        `- secret material included: false`
    ].join('\n');
}
function renderPreflightReport(artifact) {
    return [
        `${artifact.dispatch_permitted ? 'PREFLIGHT_READY' : 'PREFLIGHT_BLOCKED'} ${artifact.binding.tool_id}`,
        `- authorization: ${artifact.authorization_id}`,
        `- risk: ${artifact.risk_class}`,
        `- failed checks: ${artifact.checks.filter((check) => check.status === 'fail').length}`,
        `- network executed: false`,
        `- secret material included: false`
    ].join('\n');
}
async function runApp(args, io) {
    const subcommand = args[0];
    if (!['init', 'inspect', 'serve', 'smoke'].includes(subcommand ?? '')) {
        io.error('USAGE_ERROR: expected `foundry app init`, `foundry app inspect`, `foundry app serve`, or `foundry app smoke`.');
        return 2;
    }
    if (subcommand === 'init') {
        let directory = 'numtema-chatgpt-app';
        let force = false;
        let publicBaseUrl = 'http://127.0.0.1:8788';
        for (let index = 1; index < args.length; index += 1) {
            const argument = args[index];
            if (argument === '--force') {
                force = true;
                continue;
            }
            if (argument === '--public-base-url') {
                publicBaseUrl = requireOptionValue(args, index, '--public-base-url');
                index += 1;
                continue;
            }
            if (argument.startsWith('--')) {
                io.error(`USAGE_ERROR: unknown option ${argument}.`);
                return 2;
            }
            directory = argument;
        }
        try {
            const report = await initializeChatGptApp(directory, force, publicBaseUrl);
            io.out(`APP_INIT_OK ${report.directory}\n- config: ${report.config_file}\n- public base URL: ${report.public_base_url}\n- username: ${report.username}\n- password: ${report.password}\n- workspace: ${report.workspace_ref}\n- generated private keys: ${report.generated_private_keys}\n- secret material in config: false`);
            return 0;
        }
        catch (error) {
            io.error(`APP_INIT_ERROR: ${errorMessage(error)}`);
            return 2;
        }
    }
    let configFile = null;
    let json = false;
    let username = null;
    let password = null;
    let workspace = 'workspace-001';
    let toolName;
    let argsFile;
    for (let index = 1; index < args.length; index += 1) {
        const argument = args[index];
        if (argument === '--json') {
            json = true;
            continue;
        }
        if (argument === '--config') {
            configFile = requireOptionValue(args, index, '--config');
            index += 1;
            continue;
        }
        if (argument === '--username') {
            username = requireOptionValue(args, index, '--username');
            index += 1;
            continue;
        }
        if (argument === '--password') {
            password = requireOptionValue(args, index, '--password');
            index += 1;
            continue;
        }
        if (argument === '--workspace') {
            workspace = requireOptionValue(args, index, '--workspace');
            index += 1;
            continue;
        }
        if (argument === '--tool') {
            toolName = requireOptionValue(args, index, '--tool');
            index += 1;
            continue;
        }
        if (argument === '--args') {
            argsFile = requireOptionValue(args, index, '--args');
            index += 1;
            continue;
        }
        io.error(`USAGE_ERROR: unknown option ${argument}.`);
        return 2;
    }
    if (configFile === null) {
        io.error('USAGE_ERROR: --config is required.');
        return 2;
    }
    try {
        const assembly = await loadChatGptAppAssembly(configFile);
        if (subcommand === 'inspect') {
            io.out(json ? JSON.stringify(assembly.summary, null, 2) : renderAppSummary(assembly.summary));
            return 0;
        }
        if (subcommand === 'serve') {
            await new Promise((resolvePromise, reject) => {
                assembly.server.once?.('error', reject);
                assembly.server.listen(assembly.config.server.port, assembly.config.server.host, () => {
                    io.error(`CHATGPT_APP_READY ${assembly.summary.mcp_endpoint}`);
                    resolvePromise();
                });
            });
            return await new Promise(() => { });
        }
        if (username === null || password === null) {
            io.error('USAGE_ERROR: app smoke requires --username and --password.');
            return 2;
        }
        const toolArgs = argsFile === undefined ? undefined : JSON.parse(await readFile(resolve(argsFile), 'utf8'));
        const report = await runChatGptAppSmoke(assembly, { username, password, workspaceRef: workspace, ...(toolName === undefined ? {} : { toolName }), ...(toolArgs === undefined ? {} : { args: toolArgs }) });
        io.out(json ? JSON.stringify(report, null, 2) : `APP_SMOKE_OK ${assembly.summary.mcp_endpoint}\n- OAuth subject: ${String(report.oauth.subject)}\n- tools/resources: ready\n- refresh token: issued\n- secret material in output: false`);
        return 0;
    }
    catch (error) {
        io.error(`APP_${String(subcommand).toUpperCase()}_ERROR: ${errorMessage(error)}`);
        return 2;
    }
}
async function runStudio(args, io) {
    const subcommand = args[0];
    if (!['init', 'inspect', 'build', 'serve'].includes(subcommand ?? '')) {
        io.error('USAGE_ERROR: expected `foundry studio init`, `foundry studio inspect`, `foundry studio build`, or `foundry studio serve`.');
        return 2;
    }
    let directory = 'numtema-foundry-studio';
    let directorySet = false;
    let name;
    let force = false;
    let empty = false;
    let json = false;
    let host = '127.0.0.1';
    let port = 4173;
    for (let index = 1; index < args.length; index += 1) {
        const argument = args[index];
        if (!argument.startsWith('--') && !directorySet) {
            directory = argument;
            directorySet = true;
            continue;
        }
        if (argument === '--name') {
            name = requireOptionValue(args, index, '--name');
            index += 1;
            continue;
        }
        if (argument === '--force') {
            force = true;
            continue;
        }
        if (argument === '--empty') {
            empty = true;
            continue;
        }
        if (argument === '--json') {
            json = true;
            continue;
        }
        if (argument === '--host') {
            host = requireOptionValue(args, index, '--host');
            index += 1;
            continue;
        }
        if (argument === '--port') {
            port = Number(requireOptionValue(args, index, '--port'));
            index += 1;
            continue;
        }
        io.error(`USAGE_ERROR: unknown option ${argument}.`);
        return 2;
    }
    try {
        if (subcommand === 'init') {
            const project = await createStudioProject(directory, { ...(name === undefined ? {} : { name }), force, withExample: !empty });
            io.out(json ? JSON.stringify(project, null, 2) : `STUDIO_INIT_OK ${resolve(directory)}\n- project: ${project.name}\n- source: ${project.source.file}\n- secrets in project: false\n- next: foundry studio serve ${resolve(directory)}`);
            return 0;
        }
        if (subcommand === 'inspect') {
            const project = await loadStudioProject(directory);
            io.out(json ? JSON.stringify(project, null, 2) : renderStudioProject(project, resolve(directory)));
            return 0;
        }
        if (subcommand === 'build') {
            const report = await buildStudioProject(directory);
            const manifest = await buildDeploymentPackage(directory);
            const output = { report, deployment_manifest: manifest };
            io.out(json ? JSON.stringify(output, null, 2) : `STUDIO_BUILD_OK ${resolve(directory)}\n- operations: ${report.operation_count}\n- tools: ${report.tool_count}\n- adapters: ${report.adapter_count}\n- deployment files: ${manifest.files.length}\n- private keys included: false`);
            return 0;
        }
        if (!Number.isInteger(port) || port < 0 || port > 65535)
            throw new Error('STUDIO_PORT_INVALID');
        const handle = await startStudioServer({ projectDirectory: directory, host, port });
        io.error(`FOUNDRY_STUDIO_READY ${handle.url}\n- project: ${resolve(directory)}\n- bind: loopback\n- secret material in browser: false`);
        return await new Promise(() => { });
    }
    catch (error) {
        io.error(`STUDIO_${String(subcommand).toUpperCase()}_ERROR: ${errorMessage(error)}`);
        return 2;
    }
}
function renderStudioProject(project, directory) {
    return `FOUNDRY_STUDIO_PROJECT ${directory}\n- name: ${project.name}\n- source: ${project.source.file}\n- provider: ${project.provider.provider_ref}\n- public URL: ${project.chatgpt_app.public_base_url}\n- last build: ${project.last_build?.completed_at ?? 'never'}\n- secret material in project: false`;
}
function renderAppSummary(summary) {
    return `CHATGPT_APP_READY ${String(summary.mcp_endpoint)}\n- issuer: ${String(summary.oauth_issuer)}\n- tools: ${String(summary.tool_count)}\n- resources: ${String(summary.resource_count)}\n- users: ${String(summary.user_count)}\n- workspaces: ${String(summary.workspace_count)}\n- dynamic registration: ${String(summary.dynamic_client_registration)}\n- secret material in config: false`;
}
function renderHelp() {
    return [
        `Nümtema MCP Foundry ${getPackageMetadata().version}`,
        '',
        'First run:',
        '  foundry doctor [--json]                 Verify the installation and bundled assets',
        '  foundry demo [--json] [--out-dir DIR]   Run the bundled OpenAPI-to-adapter demonstration',
        '  foundry init [DIR] [--name NAME]         Create a dependency-free starter project',
        '',
        'Foundry Studio:',
        '  foundry studio init [DIR] [--name NAME] [--empty] [--force]',
        '  foundry studio inspect [DIR] [--json]',
        '  foundry studio build [DIR] [--json]',
        '  foundry studio serve [DIR] [--host 127.0.0.1] [--port 4173]',
        '',
        'ChatGPT App & OAuth:',
        '  foundry app init [DIR] [--public-base-url URL] [--force]',
        '  foundry app inspect --config FILE [--json]',
        '  foundry app smoke --config FILE --username EMAIL --password PASS [--workspace ID] [--tool NAME --args FILE]',
        '  foundry app serve --config FILE',
        '',
        'MCP runtime:',
        '  foundry mcp init [DIR] [--force]',
        '  foundry mcp inspect --config FILE [--json]',
        '  foundry mcp smoke --config FILE [--tool NAME --args FILE]',
        '  foundry mcp serve --config FILE',
        '',
        'Pipeline:',
        '  foundry inspect OPENAPI [--out FILE]',
        '  foundry map OPENAPI [--out FILE]',
        '  foundry compile CAPABILITY_MAP [--out FILE]',
        '  foundry validate CONTRACT_BUNDLE',
        '  foundry adapters CONTRACT_BUNDLE [--out FILE]',
        '  foundry plan CONTRACT_BUNDLE --tool NAME --base-url URL --args FILE',
        '  foundry auth-bindings CONTRACT_BUNDLE [--out FILE]',
        '  foundry auth-plan CONTRACT_BUNDLE --tool NAME --credentials FILE --context FILE',
        '  foundry preflight --execution-plan FILE --credential-plan FILE --policy FILE --trust-store FILE',
        '  foundry ledger init DIR [--at TIME]',
        '  foundry ledger status --ledger DIR [--json]',
        '  foundry dispatch reserve --ledger DIR --envelope FILE --signing-key FILE --key-id ID --at TIME',
        '  foundry dispatch commit --ledger DIR --reservation ID --signing-key FILE --key-id ID --at TIME',
        '  foundry dispatch release --ledger DIR --reservation ID --reason cancelled|expired --signing-key FILE --key-id ID --at TIME',
        '  foundry dispatch verify --receipt FILE --trust-store FILE --at TIME',
        '',
        'Global options:',
        '  --help, -h      Show this help',
        '  --version, -v   Show the installed version'
    ].join('\n');
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
const directExecution = (() => {
    const entrypoint = process.argv[1];
    if (entrypoint === undefined)
        return false;
    try {
        return realpathSync(entrypoint) === realpathSync(fileURLToPath(import.meta.url));
    }
    catch {
        return false;
    }
})();
if (directExecution) {
    runCli(process.argv.slice(2)).then((exitCode) => {
        process.exitCode = exitCode;
    }).catch((error) => {
        defaultIo.error(`INTERNAL_ERROR: ${errorMessage(error)}`);
        process.exitCode = 2;
    });
}
//# sourceMappingURL=foundry.js.map