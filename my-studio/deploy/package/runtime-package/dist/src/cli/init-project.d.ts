export interface InitProjectOptions {
    directory: string;
    name?: string;
    force?: boolean;
}
export interface InitProjectReport {
    artifact_type: 'foundry_init_report';
    artifact_version: '0.8.1';
    project_name: string;
    directory: string;
    created_files: string[];
    next_commands: string[];
}
export declare function initializeProject(options: InitProjectOptions): Promise<InitProjectReport>;
export declare function renderInitProjectReport(report: InitProjectReport): string;
