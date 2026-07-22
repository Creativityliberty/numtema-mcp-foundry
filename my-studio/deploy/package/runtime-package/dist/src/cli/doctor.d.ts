export interface DoctorCheck {
    code: string;
    label: string;
    passed: boolean;
    detail: string;
}
export interface DoctorReport {
    artifact_type: 'foundry_doctor_report';
    artifact_version: '0.8.1';
    healthy: boolean;
    package: {
        name: string;
        version: string;
        root: string;
    };
    runtime: {
        node: string;
        minimum_node_major: 22;
        current_directory: string;
    };
    checks: DoctorCheck[];
}
export declare function runDoctorChecks(currentDirectory?: string): DoctorReport;
export declare function renderDoctorReport(report: DoctorReport): string;
