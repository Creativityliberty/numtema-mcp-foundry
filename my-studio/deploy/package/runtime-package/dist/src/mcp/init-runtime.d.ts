export interface McpInitReport {
    directory: string;
    config_file: string;
    mock_provider_file: string;
    generated_private_keys: 3;
    copied_artifacts: number;
    secret_material_in_config: false;
}
export declare function initializeMcpRuntime(directory: string, force?: boolean): Promise<McpInitReport>;
