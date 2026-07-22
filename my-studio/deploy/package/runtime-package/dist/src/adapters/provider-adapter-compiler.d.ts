import type { ContractBundle } from '../contracts/types.js';
import type { ProviderAdapterBundle } from './types.js';
export declare function compileProviderAdapters(bundle: ContractBundle): ProviderAdapterBundle;
export declare function stableStringify(value: unknown): string;
export declare function digest(value: unknown): string;
