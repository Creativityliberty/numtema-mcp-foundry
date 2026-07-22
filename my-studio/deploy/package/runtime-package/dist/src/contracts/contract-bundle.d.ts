import type { ApprovalContract, AuthContract, ContractBundle, FoundryArtifact, PolicyContract, ReceiptContract, RecoveryContract, ToolContract } from './types.js';
export interface IndexedContract {
    kind: 'tool' | 'auth' | 'policy' | 'approval' | 'recovery' | 'receipt' | 'artifact';
    value: ToolContract | AuthContract | PolicyContract | ApprovalContract | RecoveryContract | ReceiptContract | FoundryArtifact;
}
export interface ContractIndex {
    byId: ReadonlyMap<string, IndexedContract>;
    toolsByName: ReadonlyMap<string, ToolContract>;
}
export declare class ContractBundleError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
export declare function loadContractBundle(filePath: string): Promise<ContractBundle>;
export declare function indexContractBundle(bundle: ContractBundle): ContractIndex;
export declare function parseControlledYaml(source: string): unknown;
