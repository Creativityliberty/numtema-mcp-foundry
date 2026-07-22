export interface DemoReport {
    artifact_type: 'foundry_demo_report';
    artifact_version: '0.8.1';
    valid: boolean;
    network_executed: false;
    secret_material_included: false;
    source: string;
    output_directory: string | null;
    summary: {
        operation_count: number;
        capability_count: number;
        tool_count: number;
        policy_count: number;
        approval_count: number;
        recovery_count: number;
        adapter_count: number;
        error_count: number;
        warning_count: number;
    };
}
export interface DemoOptions {
    outputDirectory?: string;
}
export declare function runDemoPipeline(options?: DemoOptions): Promise<DemoReport>;
export declare function renderDemoReport(report: DemoReport): string;
