import type { ContractBundle } from '../contracts/types.js';
import { type ValidationReport } from './issues.js';
export interface ValidateBundleOptions {
    schemaDirectory?: string;
}
export declare function validateBundle(bundle: ContractBundle, options?: ValidateBundleOptions): Promise<ValidationReport>;
