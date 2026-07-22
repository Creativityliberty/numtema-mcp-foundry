import type { StudioProject, StudioToolOverride } from './types.js';
export declare function createStudioProject(directory: string, options?: {
    name?: string;
    force?: boolean;
    withExample?: boolean;
}): Promise<StudioProject>;
export declare function loadStudioProject(directory: string): Promise<StudioProject>;
export declare function saveStudioProject(directory: string, project: StudioProject): Promise<void>;
export declare function loadStudioOverrides(directory: string, project?: StudioProject): Promise<StudioToolOverride[]>;
export declare function saveStudioOverrides(directory: string, overrides: StudioToolOverride[]): Promise<void>;
export declare function writeProjectJson(directory: string, relativePath: string, value: unknown): Promise<string>;
export declare function resolveStudioPath(directory: string, relativePath: string): string;
export declare function importStudioSource(directory: string, filename: string, content: string): Promise<StudioProject>;
