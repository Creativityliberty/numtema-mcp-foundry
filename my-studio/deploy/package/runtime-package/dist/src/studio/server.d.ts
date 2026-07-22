import type { Server } from 'node:http';
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
export declare function startStudioServer(options: StudioServerOptions): Promise<StudioServerHandle>;
