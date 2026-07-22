export interface PackageMetadata {
    name: string;
    version: string;
    description: string;
    engines: {
        node?: string;
    };
}
export declare function getPackageRoot(): string;
export declare function resolvePackageAsset(...segments: string[]): string;
export declare function getPackageMetadata(): PackageMetadata;
