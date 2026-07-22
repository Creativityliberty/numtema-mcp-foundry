import type { StudioBuildReport, StudioProject } from './types.js';
export declare function buildStudioProject(directory: string): Promise<StudioBuildReport>;
export declare function readStudioGeneratedArtifact(directory: string, kind: keyof StudioProject['paths']): Promise<unknown>;
export declare function studioSourceDigest(directory: string): Promise<string>;
