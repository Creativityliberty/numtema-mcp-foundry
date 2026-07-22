import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { ContractKind } from '../contracts/types.js';
import { resolvePackageAsset } from '../system/package-assets.js';

export type JsonSchema = Record<string, unknown>;

export interface SchemaRegistry {
  schemaDirectory: string;
  schemas: ReadonlyMap<ContractKind, JsonSchema>;
}

const SCHEMA_FILES: Record<ContractKind, string> = {
  tool: 'tool-contract.schema.json',
  auth: 'auth-contract.schema.json',
  policy: 'policy-contract.schema.json',
  approval: 'approval-contract.schema.json',
  recovery: 'recovery-contract.schema.json',
  receipt: 'receipt-contract.schema.json',
  artifact: 'foundry-artifact.schema.json'
};

export async function createSchemaRegistry(schemaDirectory?: string): Promise<SchemaRegistry> {
  const absoluteDirectory = resolve(schemaDirectory ?? resolvePackageAsset('schemas'));
  const entries = await Promise.all(
    (Object.entries(SCHEMA_FILES) as Array<[ContractKind, string]>).map(async ([kind, filename]) => {
      const source = await readFile(resolve(absoluteDirectory, filename), 'utf8');
      return [kind, JSON.parse(source) as JsonSchema] as const;
    })
  );

  return {
    schemaDirectory: absoluteDirectory,
    schemas: new Map(entries)
  };
}
