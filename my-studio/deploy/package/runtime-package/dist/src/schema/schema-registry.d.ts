import type { ContractKind } from '../contracts/types.js';
export type JsonSchema = Record<string, unknown>;
export interface SchemaRegistry {
    schemaDirectory: string;
    schemas: ReadonlyMap<ContractKind, JsonSchema>;
}
export declare function createSchemaRegistry(schemaDirectory?: string): Promise<SchemaRegistry>;
