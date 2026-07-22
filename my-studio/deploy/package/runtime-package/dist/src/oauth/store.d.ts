import type { OAuthClient, OAuthStoreState } from './types.js';
export declare class OAuthStore {
    readonly directory: string;
    readonly filePath: string;
    readonly lockPath: string;
    readonly staticClients: OAuthClient[];
    constructor(directory: string, staticClients?: OAuthClient[]);
    read(): Promise<OAuthStoreState>;
    mutate<T>(fn: (state: OAuthStoreState) => T | Promise<T>): Promise<T>;
}
