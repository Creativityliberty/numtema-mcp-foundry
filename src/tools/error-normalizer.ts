import type { ToolContract } from '../contracts/types.js';
import type { ToolErrorCategory, ToolErrorContract } from './types.js';

export function normalizeToolErrors(tool: ToolContract): ToolErrorContract[] {
  const foundry = asObject(asObject(tool.extensions).foundry);
  const response = asObject(foundry.response_contract);
  const raw = Array.isArray(response.errors) ? response.errors : [];
  const mapped = raw.map((item) => normalizeOne(tool, asObject(item)));
  if (mapped.length === 0) mapped.push({ code: `${codePrefix(tool)}_PROVIDER_ERROR`, category: 'provider_error', retryable: false, user_message: 'The provider could not complete this request.', technical_message: 'No provider error response contract was declared.' });
  return mapped;
}
function normalizeOne(tool: ToolContract, raw: Record<string, unknown>): ToolErrorContract {
  const status = String(raw.status ?? 'unknown');
  const category = categoryFor(status);
  const content = Array.isArray(raw.content) ? raw.content : [];
  const schema = content.length > 0 ? asObject(asObject(content[0]).schema) : undefined;
  return {
    code: `${codePrefix(tool)}_${category.toUpperCase()}`,
    category,
    retryable: category === 'rate_limit' || category === 'provider_error' || category === 'timeout',
    user_message: messageFor(category),
    technical_message: typeof raw.description === 'string' ? raw.description : `Provider returned HTTP ${status}.`,
    source_status: status,
    ...(schema && Object.keys(schema).length > 0 ? { schema } : {})
  };
}
function categoryFor(status: string): ToolErrorCategory {
  if (status === '400' || status === '422') return 'validation';
  if (status === '401') return 'authentication';
  if (status === '403') return 'authorization';
  if (status === '404') return 'not_found';
  if (status === '409') return 'conflict';
  if (status === '408' || status === '504') return 'timeout';
  if (status === '429') return 'rate_limit';
  if (/^5/.test(status)) return 'provider_error';
  return 'unknown';
}
function messageFor(category: ToolErrorCategory): string { return ({ validation: 'Some supplied information is invalid.', authentication: 'The provider credential is missing or invalid.', authorization: 'The connected account is not allowed to perform this action.', not_found: 'The requested resource was not found.', conflict: 'The request conflicts with the current provider state.', rate_limit: 'The provider is temporarily rate limiting requests.', provider_error: 'The provider encountered an error while processing the request.', network_error: 'The provider could not be reached.', timeout: 'The provider did not respond in time.', unknown: 'The provider could not complete this request.' })[category]; }
function codePrefix(tool: ToolContract): string { return tool.name.toUpperCase().replace(/[^A-Z0-9]+/g, '_'); }
function asObject(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
