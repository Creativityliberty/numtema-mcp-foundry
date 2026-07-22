import type { OpenApiDocument } from './types.js';
export declare class OpenApiLoadError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
export declare function loadOpenApiDocument(filePath: string): Promise<OpenApiDocument>;
