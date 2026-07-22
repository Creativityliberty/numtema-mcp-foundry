import type { IncomingMessage } from 'node:http';
export interface StudioApiContext {
    projectDirectory: string;
    csrfToken: string;
    bodyLimitBytes: number;
}
export interface StudioApiResult {
    status: number;
    body: unknown;
}
export declare function handleStudioApi(request: IncomingMessage, pathname: string, context: StudioApiContext): Promise<StudioApiResult | null>;
