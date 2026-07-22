import type { OpenApiDocument, OperationSchemaEnvelope } from './types.js';
export declare function extractOperationSchema(document: OpenApiDocument, pathItem: Record<string, unknown>, operation: Record<string, unknown>): OperationSchemaEnvelope;
