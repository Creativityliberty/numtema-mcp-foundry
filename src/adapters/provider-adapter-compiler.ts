import { createHash } from 'node:crypto';
import type { ContractBundle, ToolContract } from '../contracts/types.js';
import type {
  ProviderAdapterBundle,
  ProviderAdapterContract,
  ProviderBodyBinding,
  ProviderHttpMethod,
  ProviderParameterBinding,
  ProviderParameterLocation,
  ProviderResponseMatcher,
  ProviderResponseNormalizer
} from './types.js';

type JsonRecord = Record<string, unknown>;

interface FoundryExtension {
  source_method?: string;
  source_path?: string;
  parameter_contract?: unknown[];
  response_contract?: {
    success?: unknown[];
    errors?: unknown[];
    other?: unknown[];
  };
  media_contract?: {
    request_content_types?: unknown[];
    response_content_types?: unknown[];
    binary_request?: boolean;
    binary_response?: boolean;
  };
}

export function compileProviderAdapters(bundle: ContractBundle): ProviderAdapterBundle {
  const adapters: ProviderAdapterContract[] = [];
  const warnings: ProviderAdapterBundle['warnings'] = [];

  for (const tool of [...bundle.tools].sort((left, right) => left.name.localeCompare(right.name))) {
    const foundry = foundryExtension(tool);
    if (!isHttpMethod(foundry.source_method) || typeof foundry.source_path !== 'string') {
      warnings.push({
        code: 'UNSUPPORTED_PROVIDER_BINDING',
        message: 'Tool does not expose an HTTP method and source path in extensions.foundry.',
        tool_id: tool.id
      });
      continue;
    }
    adapters.push(compileToolAdapter(tool, foundry));
  }

  const withoutIntegrity = {
    artifact_type: 'provider_adapter_bundle' as const,
    artifact_version: '0.6' as const,
    source_bundle_version: bundle.bundle_version,
    adapters,
    summary: {
      adapter_count: adapters.length,
      authenticated_count: adapters.filter((adapter) => adapter.credential.auth_ref !== null).length,
      idempotency_required_count: adapters.filter((adapter) => adapter.request.idempotency.mode === 'required').length,
      body_binding_count: adapters.filter((adapter) => adapter.request.body !== null).length,
      binary_binding_count: adapters.filter((adapter) => adapter.request.body?.binary === true).length,
      skipped_tool_count: bundle.tools.length - adapters.length
    },
    warnings
  };

  return {
    ...withoutIntegrity,
    integrity: { algorithm: 'sha256', digest: digest(withoutIntegrity) }
  };
}

function compileToolAdapter(tool: ToolContract, foundry: FoundryExtension): ProviderAdapterContract {
  const parameters = compileParameterBindings(foundry.parameter_contract ?? []);
  const body = compileBodyBinding(tool, foundry);
  const response = {
    success: compileResponseMatchers(foundry.response_contract?.success ?? [], foundry.media_contract?.binary_response === true),
    errors: compileResponseMatchers(foundry.response_contract?.errors ?? [], false),
    other: compileResponseMatchers(foundry.response_contract?.other ?? [], foundry.media_contract?.binary_response === true)
  };
  const base = {
    id: `adapter:${tool.name}`,
    version: '0.6.0' as const,
    provider_kind: 'http_openapi' as const,
    tool_id: tool.id,
    tool_name: tool.name,
    tool_revision: tool.revision ?? digest(tool),
    credential: {
      auth_ref: tool.auth_ref ?? null,
      required_scopes: [...tool.required_scopes].sort()
    },
    request: {
      method: foundry.source_method!.toUpperCase() as ProviderHttpMethod,
      path_template: foundry.source_path!,
      parameters,
      body,
      idempotency: {
        mode: idempotencyMode(tool),
        header_name: 'Idempotency-Key' as const
      }
    },
    response
  };
  const revision = digest(base);
  return {
    ...base,
    revision,
    integrity: { algorithm: 'sha256', digest: revision }
  };
}

function compileParameterBindings(raw: unknown[]): ProviderParameterBinding[] {
  const records = raw.filter(isRecord);
  const counts = new Map<string, number>();
  for (const parameter of records) {
    const name = stringValue(parameter.name);
    if (name !== null) counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  const bindings: ProviderParameterBinding[] = [];
  for (const parameter of records) {
    const name = stringValue(parameter.name);
    const location = stringValue(parameter.location);
    if (name === null || !isParameterLocation(location)) continue;
    const binding: ProviderParameterBinding = {
      argument_name: (counts.get(name) ?? 0) > 1 ? `${location}_${name}` : name,
      source_name: name,
      location,
      required: parameter.required === true,
      deprecated: parameter.deprecated === true
    };
    if (typeof parameter.style === 'string') binding.style = parameter.style;
    if (typeof parameter.explode === 'boolean') binding.explode = parameter.explode;
    bindings.push(binding);
  }
  return bindings.sort((left, right) => parameterOrder(left.location) - parameterOrder(right.location) || left.argument_name.localeCompare(right.argument_name));
}

function compileBodyBinding(tool: ToolContract, foundry: FoundryExtension): ProviderBodyBinding | null {
  const contentTypes = stringArray(foundry.media_contract?.request_content_types);
  if (contentTypes.length === 0 && !inputHasBody(tool)) return null;
  const preferred = preferredContentType(contentTypes);
  const binary = foundry.media_contract?.binary_request === true;
  return {
    argument_name: 'body',
    required: inputBodyRequired(tool),
    content_types: contentTypes,
    preferred_content_type: preferred,
    binary,
    encoding: bodyEncoding(preferred, binary)
  };
}

function compileResponseMatchers(raw: unknown[], binary: boolean): ProviderResponseMatcher[] {
  return raw.filter(isRecord).map((response) => {
    const status = typeof response.status === 'string' ? response.status : 'default';
    const content = Array.isArray(response.content) ? response.content.filter(isRecord) : [];
    const contentTypes = content.map((item) => stringValue(item.media_type)).filter((value): value is string => value !== null).sort();
    return {
      status,
      content_types: contentTypes,
      normalizer: responseNormalizer(status, contentTypes, binary)
    };
  }).sort((left, right) => left.status.localeCompare(right.status));
}

function responseNormalizer(status: string, contentTypes: string[], binary: boolean): ProviderResponseNormalizer {
  if (status === '204' || contentTypes.length === 0) return 'empty';
  if (binary || contentTypes.some((value) => isBinaryContentType(value))) return 'binary';
  if (contentTypes.every((value) => isJsonContentType(value))) return 'json';
  if (contentTypes.every((value) => value.startsWith('text/'))) return 'text';
  return 'adaptive';
}

function idempotencyMode(tool: ToolContract): 'none' | 'optional' | 'required' {
  if (tool.execution.idempotency === 'required') return 'required';
  if (tool.execution.idempotency === 'supported') return 'optional';
  return 'none';
}

function inputHasBody(tool: ToolContract): boolean {
  const properties = isRecord(tool.input_schema.properties) ? tool.input_schema.properties : {};
  return 'body' in properties;
}

function inputBodyRequired(tool: ToolContract): boolean {
  return Array.isArray(tool.input_schema.required) && tool.input_schema.required.includes('body');
}

function preferredContentType(contentTypes: string[]): string | null {
  const priorities = ['application/json', 'application/x-www-form-urlencoded', 'multipart/form-data', 'application/octet-stream', 'text/plain'];
  for (const priority of priorities) {
    if (contentTypes.includes(priority)) return priority;
  }
  return contentTypes[0] ?? null;
}

function bodyEncoding(contentType: string | null, binary: boolean): ProviderBodyBinding['encoding'] {
  if (contentType === 'multipart/form-data') return 'multipart_descriptor';
  if (contentType === 'application/x-www-form-urlencoded') return 'form_urlencoded';
  if (binary || contentType === 'application/octet-stream') return 'artifact_reference';
  if (contentType !== null && isJsonContentType(contentType)) return 'json';
  if (contentType?.startsWith('text/')) return 'text';
  return 'adaptive';
}

function foundryExtension(tool: ToolContract): FoundryExtension {
  const extensions = isRecord(tool.extensions) ? tool.extensions : {};
  return isRecord(extensions.foundry) ? extensions.foundry as FoundryExtension : {};
}

function parameterOrder(location: ProviderParameterLocation): number {
  return { path: 0, query: 1, header: 2, cookie: 3 }[location];
}

function isHttpMethod(value: unknown): value is Lowercase<ProviderHttpMethod> {
  return typeof value === 'string' && ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'].includes(value);
}

function isParameterLocation(value: string | null): value is ProviderParameterLocation {
  return value !== null && ['path', 'query', 'header', 'cookie'].includes(value);
}

function isJsonContentType(value: string): boolean {
  return value === 'application/json' || value.endsWith('+json');
}

function isBinaryContentType(value: string): boolean {
  return value === 'application/octet-stream' || value.startsWith('image/') || value.startsWith('audio/') || value.startsWith('video/') || value === 'application/pdf';
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').sort() : [];
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])]));
}

export function digest(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}
