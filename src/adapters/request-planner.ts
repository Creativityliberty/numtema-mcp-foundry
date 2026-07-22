import { URL, URLSearchParams } from 'node:url';
import type {
  ProviderAdapterContract,
  ProviderBodyBinding,
  ProviderExecutionPlan,
  ProviderHeaderValue,
  ProviderParameterBinding,
  ProviderPlanOptions,
  ProviderQueryValue
} from './types.js';
import { digest } from './provider-adapter-compiler.js';

type JsonRecord = Record<string, unknown>;

export class ProviderPlanError extends Error {
  constructor(public readonly code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = 'ProviderPlanError';
  }
}

export function planProviderRequest(
  adapter: ProviderAdapterContract,
  args: Record<string, unknown>,
  options: ProviderPlanOptions
): ProviderExecutionPlan {
  validateBaseUrl(options.baseUrl);
  const warnings: ProviderExecutionPlan['warnings'] = [];
  const query: ProviderQueryValue[] = [];
  const headers: ProviderHeaderValue[] = [];
  const cookies: ProviderQueryValue[] = [];
  let path = adapter.request.path_template;
  const consumed = new Set<string>();

  for (const binding of adapter.request.parameters) {
    const value = args[binding.argument_name];
    if (value === undefined || value === null) {
      if (binding.required) {
        throw new ProviderPlanError('MISSING_REQUIRED_ARGUMENT', `${binding.argument_name} is required for ${adapter.tool_name}.`);
      }
      continue;
    }
    consumed.add(binding.argument_name);
    if (binding.deprecated) {
      warnings.push({ code: 'DEPRECATED_ARGUMENT', message: `${binding.argument_name} is deprecated by the provider contract.` });
    }
    if (binding.location === 'path') {
      path = replacePathValue(path, binding, value);
    } else if (binding.location === 'query') {
      query.push(...serializeQuery(binding, value));
    } else if (binding.location === 'header') {
      headers.push({ name: binding.source_name, value: serializeScalarOrList(value, ',') });
    } else {
      cookies.push({ name: binding.source_name, value: serializeScalarOrList(value, ',') });
    }
  }

  if (/\{[^}]+\}/.test(path)) {
    throw new ProviderPlanError('UNRESOLVED_PATH_PARAMETER', `Path template still contains unresolved parameters: ${path}.`);
  }

  const body = planBody(adapter.request.body, args, consumed);
  if (body !== null) {
    headers.push({ name: 'Content-Type', value: body.content_type });
  }

  if (cookies.length > 0) {
    const value = cookies
      .sort((left, right) => left.name.localeCompare(right.name) || left.value.localeCompare(right.value))
      .map((cookie) => `${encodeURIComponent(cookie.name)}=${encodeURIComponent(cookie.value)}`)
      .join('; ');
    headers.push({ name: 'Cookie', value });
  }

  const idempotency = planIdempotency(adapter, args, options);
  if (idempotency.key !== null) {
    headers.push({ name: idempotency.header_name, value: idempotency.key });
  }

  for (const key of Object.keys(args).sort()) {
    if (!consumed.has(key)) {
      warnings.push({ code: 'UNUSED_ARGUMENT', message: `${key} is not bound by adapter ${adapter.id}.` });
    }
  }

  query.sort((left, right) => left.name.localeCompare(right.name) || left.value.localeCompare(right.value));
  headers.sort((left, right) => left.name.toLowerCase().localeCompare(right.name.toLowerCase()) || left.value.localeCompare(right.value));
  const url = buildUrl(options.baseUrl, path, query);
  const withoutIntegrity = {
    artifact_type: 'provider_execution_plan' as const,
    artifact_version: '0.6' as const,
    dry_run: true as const,
    adapter_id: adapter.id,
    adapter_revision: adapter.revision,
    tool_id: adapter.tool_id,
    tool_revision: adapter.tool_revision,
    arguments_hash: digest(args),
    credential_requirement: {
      auth_ref: adapter.credential.auth_ref,
      required_scopes: [...adapter.credential.required_scopes],
      secret_material_included: false as const
    },
    request: {
      method: adapter.request.method,
      url,
      path,
      query,
      headers,
      body
    },
    idempotency,
    response_plan: {
      success_statuses: adapter.response.success.map((matcher) => matcher.status),
      error_statuses: adapter.response.errors.map((matcher) => matcher.status),
      other_statuses: adapter.response.other.map((matcher) => matcher.status)
    },
    warnings
  };

  return {
    ...withoutIntegrity,
    integrity: { algorithm: 'sha256', digest: digest(withoutIntegrity) }
  };
}

function replacePathValue(path: string, binding: ProviderParameterBinding, value: unknown): string {
  const marker = `{${binding.source_name}}`;
  if (!path.includes(marker)) {
    throw new ProviderPlanError('PATH_PARAMETER_NOT_IN_TEMPLATE', `${binding.source_name} is not present in ${path}.`);
  }
  return path.replaceAll(marker, encodeURIComponent(serializeScalar(value)));
}

function serializeQuery(binding: ProviderParameterBinding, value: unknown): ProviderQueryValue[] {
  if (Array.isArray(value)) {
    const explode = binding.explode ?? binding.style === 'form';
    if (explode) return value.map((item) => ({ name: binding.source_name, value: serializeScalar(item) }));
    return [{ name: binding.source_name, value: value.map(serializeScalar).join(',') }];
  }
  if (isRecord(value)) {
    const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
    if (binding.style === 'deepObject') {
      return entries.map(([key, item]) => ({ name: `${binding.source_name}[${key}]`, value: serializeScalar(item) }));
    }
    if (binding.explode === true) {
      return entries.map(([key, item]) => ({ name: key, value: serializeScalar(item) }));
    }
    return [{
      name: binding.source_name,
      value: entries.flatMap(([key, item]) => [key, serializeScalar(item)]).join(',')
    }];
  }
  return [{ name: binding.source_name, value: serializeScalar(value) }];
}

function planBody(
  binding: ProviderBodyBinding | null,
  args: Record<string, unknown>,
  consumed: Set<string>
): ProviderExecutionPlan['request']['body'] {
  if (binding === null) return null;
  const value = args[binding.argument_name];
  if (value === undefined || value === null) {
    if (binding.required) {
      throw new ProviderPlanError('MISSING_REQUIRED_ARGUMENT', `${binding.argument_name} is required.`);
    }
    return null;
  }
  consumed.add(binding.argument_name);
  const contentType = binding.preferred_content_type ?? 'application/octet-stream';
  if (binding.encoding === 'multipart_descriptor') {
    if (!isRecord(value)) throw new ProviderPlanError('INVALID_MULTIPART_BODY', 'Multipart body must be an object of named parts.');
    return {
      content_type: contentType,
      encoding: binding.encoding,
      value: {
        parts: Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([name, part]) => ({ name, value: part }))
      }
    };
  }
  if (binding.encoding === 'form_urlencoded') {
    if (!isRecord(value)) throw new ProviderPlanError('INVALID_FORM_BODY', 'Form body must be an object.');
    const serialized = Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .flatMap(([name, item]) => Array.isArray(item)
        ? item.map((entry) => `${encodeURIComponent(name)}=${encodeURIComponent(serializeScalar(entry))}`)
        : [`${encodeURIComponent(name)}=${encodeURIComponent(serializeScalar(item))}`])
      .join('&');
    return { content_type: contentType, encoding: binding.encoding, value: serialized };
  }
  if (binding.encoding === 'artifact_reference') {
    if (!(typeof value === 'string' || isRecord(value))) {
      throw new ProviderPlanError('INVALID_ARTIFACT_REFERENCE', 'Binary bodies must use an artifact/media reference, never raw bytes.');
    }
  }
  return { content_type: contentType, encoding: binding.encoding, value };
}

function planIdempotency(
  adapter: ProviderAdapterContract,
  args: Record<string, unknown>,
  options: ProviderPlanOptions
): ProviderExecutionPlan['idempotency'] {
  const mode = adapter.request.idempotency.mode;
  if (mode === 'none') {
    return { mode, header_name: 'Idempotency-Key', key_source: 'none', key: null };
  }
  if (options.idempotencyKey !== undefined) {
    if (options.idempotencyKey.trim().length === 0) {
      throw new ProviderPlanError('INVALID_IDEMPOTENCY_KEY', 'Idempotency key cannot be empty.');
    }
    return { mode, header_name: 'Idempotency-Key', key_source: 'provided', key: options.idempotencyKey };
  }
  if (mode === 'optional') {
    return { mode, header_name: 'Idempotency-Key', key_source: 'none', key: null };
  }
  const key = `dryrun_${digest({ tool_revision: adapter.tool_revision, arguments: args }).slice(0, 32)}`;
  return { mode, header_name: 'Idempotency-Key', key_source: 'dry_run_generated', key };
}

function buildUrl(baseUrl: string, path: string, query: ProviderQueryValue[]): string {
  const base = baseUrl.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const search = new URLSearchParams();
  for (const item of query) search.append(item.name, item.value);
  const suffix = search.size > 0 ? `?${search.toString()}` : '';
  return `${base}${normalizedPath}${suffix}`;
}

function validateBaseUrl(baseUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new ProviderPlanError('INVALID_BASE_URL', `${baseUrl} is not an absolute URL.`);
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new ProviderPlanError('INVALID_BASE_URL', 'Only http and https provider URLs are supported.');
  }
  if (parsed.search || parsed.hash) {
    throw new ProviderPlanError('INVALID_BASE_URL', 'Base URL cannot include query parameters or fragments.');
  }
}

function serializeScalarOrList(value: unknown, separator: string): string {
  return Array.isArray(value) ? value.map(serializeScalar).join(separator) : serializeScalar(value);
}

function serializeScalar(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
  if (value === null) return '';
  if (value instanceof Date) return value.toISOString();
  if (isRecord(value) || Array.isArray(value)) return JSON.stringify(value);
  throw new ProviderPlanError('UNSERIALIZABLE_ARGUMENT', `Cannot serialize argument of type ${typeof value}.`);
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Uint8Array);
}
