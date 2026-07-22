export type JsonRpcId = string | number | null;
export interface McpAuthenticatedContext {
    subject_ref: string;
    client_ref: string;
    workspace_ref: string;
    scopes: string[];
}
export interface McpRequestContext {
    auth?: McpAuthenticatedContext;
}
export interface JsonRpcRequest {
    jsonrpc: '2.0';
    id?: JsonRpcId;
    method: string;
    params?: unknown;
}
export interface JsonRpcSuccess {
    jsonrpc: '2.0';
    id: JsonRpcId;
    result: unknown;
}
export interface JsonRpcFailure {
    jsonrpc: '2.0';
    id: JsonRpcId;
    error: {
        code: number;
        message: string;
        data?: unknown;
    };
}
export type JsonRpcResponse = JsonRpcSuccess | JsonRpcFailure;
export interface McpTextContent {
    type: 'text';
    text: string;
}
export interface McpCallToolResult {
    content: McpTextContent[];
    structuredContent?: Record<string, unknown>;
    isError?: boolean;
    _meta?: Record<string, unknown>;
}
export interface McpToolDescriptor {
    name: string;
    title?: string;
    description: string;
    inputSchema: Record<string, unknown>;
    outputSchema?: Record<string, unknown>;
    annotations: {
        readOnlyHint: boolean;
        destructiveHint: boolean;
        idempotentHint: boolean;
        openWorldHint: boolean;
    };
    _meta: {
        toolId: string;
        toolRevision: string | null;
        riskClass: string;
        approvalRequired: boolean;
        requiredScopes: string[];
        [key: string]: unknown;
    };
}
export interface McpRegisteredTool {
    descriptor: McpToolDescriptor;
    toolId: string;
    adapterId: string | null;
}
export interface McpToolRegistry {
    list(cursor?: string): {
        tools: McpToolDescriptor[];
        nextCursor?: string;
    };
    get(name: string): McpRegisteredTool | undefined;
}
export interface McpResourceDescriptor {
    uri: string;
    name: string;
    title?: string;
    description?: string;
    mimeType?: string;
    _meta?: Record<string, unknown>;
}
export interface McpResourceContent {
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string;
    _meta?: Record<string, unknown>;
}
export interface McpResourceRegistry {
    list(cursor?: string): {
        resources: McpResourceDescriptor[];
        nextCursor?: string;
    };
    read(uri: string): {
        contents: McpResourceContent[];
    } | undefined;
}
