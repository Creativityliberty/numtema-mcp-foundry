import type { LoadedChatGptAppAssembly } from './app-assembly.js';
export declare function runChatGptAppSmoke(assembly: LoadedChatGptAppAssembly, input: {
    username: string;
    password: string;
    workspaceRef: string;
    toolName?: string;
    args?: Record<string, unknown>;
}): Promise<Record<string, unknown>>;
