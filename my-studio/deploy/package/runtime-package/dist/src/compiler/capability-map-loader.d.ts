import type { CapabilityMapArtifact } from '../inspection/types.js';
export declare class CapabilityMapLoadError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
export interface CapabilityMapLoadOptions {
    schemaDirectory?: string;
}
export declare function loadCapabilityMap(filePath: string, options?: CapabilityMapLoadOptions): Promise<CapabilityMapArtifact>;
