export interface JsonBundleEntry {
    source_path: string;
    bundle_path: string;
    sha256: string;
    size_bytes: number;
}
export interface JsonBundleIndex {
    artifact_type: 'json_bundle_index';
    artifact_version: '0.7';
    generated_from: string;
    file_count: number;
    entries: JsonBundleEntry[];
    integrity: {
        algorithm: 'sha256';
        digest: string;
    };
}
export declare function listProjectJsonFiles(rootDirectory?: string): Promise<string[]>;
export declare function buildJsonBundle(rootDirectory?: string, outputDirectory?: string): Promise<JsonBundleIndex>;
