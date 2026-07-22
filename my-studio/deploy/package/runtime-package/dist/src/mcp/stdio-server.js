import { createInterface } from 'node:readline';
export async function handleStdioLine(router, line) {
    let message;
    try {
        message = JSON.parse(line);
    }
    catch {
        return JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
    }
    const response = await router.handle(message);
    return response === null ? null : JSON.stringify(response);
}
export async function startStdioServer(router) {
    const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
    for await (const line of lines) {
        if (line.trim().length === 0)
            continue;
        const output = await handleStdioLine(router, line);
        if (output !== null)
            process.stdout.write(`${output}\n`);
    }
}
//# sourceMappingURL=stdio-server.js.map