import type { ContractKind } from '../contracts/types.js';
import type { JsonSchema, SchemaRegistry } from '../schema/schema-registry.js';
import { type ValidationIssue } from './issues.js';
export declare function validateContract(registry: SchemaRegistry, kind: ContractKind, value: unknown): ValidationIssue[];
export declare function validateValueAgainstSchema(schema: JsonSchema, value: unknown, kind?: string, valueId?: string): ValidationIssue[];
