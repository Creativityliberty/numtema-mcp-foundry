import type {
  JsonSchemaObject,
  NormalizedParameter,
  OpenApiDocument,
  OperationSchemaEnvelope,
  RequestBodyInspection,
  ResponseHeaderInspection,
  ResponseInspection,
  SchemaContent
} from './types.js';

const PAGINATION_FIELDS = new Set(['cursor', 'next_cursor', 'next_page_token', 'page', 'page_size', 'per_page', 'offset', 'limit', 'total', 'has_more']);

export function extractOperationSchema(
  document: OpenApiDocument,
  pathItem: Record<string, unknown>,
  operation: Record<string, unknown>
): OperationSchemaEnvelope {
  const unresolved = new Set<string>();
  const resolve = (value: unknown): unknown => resolveLocalRefs(document, value, unresolved, new Set<string>());
  const parameters = mergeParameters(pathItem.parameters, operation.parameters, resolve);
  const requestBody = inspectRequestBody(resolve(operation.requestBody));
  const responses = inspectResponses(resolve(operation.responses));
  const successResponses = responses.filter((response) => /^2\d\d$/.test(response.status));
  const errorResponses = responses.filter((response) => response.status === 'default' || /^[45]\d\d$/.test(response.status));
  const otherResponses = responses.filter((response) => !successResponses.includes(response) && !errorResponses.includes(response));
  const requestContentTypes = requestBody?.content.map((entry) => entry.media_type).sort() ?? [];
  const responseContentTypes = uniqueSorted(responses.flatMap((response) => response.content.map((entry) => entry.media_type)));
  const requestPagination = paginationFromParameters(parameters);
  const responseFields = uniqueSorted(successResponses.flatMap((response) => response.content.flatMap((entry) => paginationFields(entry.schema))));

  const envelope: OperationSchemaEnvelope = {
    parameters,
    success_responses: successResponses,
    error_responses: errorResponses,
    other_responses: otherResponses,
    media: {
      request_content_types: requestContentTypes,
      response_content_types: responseContentTypes,
      binary_request: requestBody?.content.some((entry) => isBinary(entry.media_type, entry.schema)) ?? false,
      binary_response: responses.some((response) => response.content.some((entry) => isBinary(entry.media_type, entry.schema)))
    },
    pagination: {
      style: requestPagination.style,
      request_parameters: requestPagination.parameters,
      response_fields: responseFields
    },
    unresolved_refs: [...unresolved].sort()
  };
  if (requestBody) envelope.request_body = requestBody;
  return envelope;
}

function mergeParameters(
  pathParameters: unknown,
  operationParameters: unknown,
  resolve: (value: unknown) => unknown
): NormalizedParameter[] {
  const merged = new Map<string, NormalizedParameter>();
  for (const raw of [...array(pathParameters), ...array(operationParameters)]) {
    const value = resolve(raw);
    if (!isRecord(value) || typeof value.name !== 'string' || typeof value.in !== 'string') continue;
    const parameter: NormalizedParameter = {
      name: value.name,
      location: value.in,
      required: value.required === true || value.in === 'path',
      schema: schemaObject(resolve(value.schema)),
      deprecated: value.deprecated === true
    };
    if (typeof value.description === 'string') parameter.description = value.description;
    if (typeof value.style === 'string') parameter.style = value.style;
    if (typeof value.explode === 'boolean') parameter.explode = value.explode;
    merged.set(`${parameter.location}:${parameter.name}`, parameter);
  }
  return [...merged.values()].sort((left, right) => `${left.location}:${left.name}`.localeCompare(`${right.location}:${right.name}`));
}

function inspectRequestBody(value: unknown): RequestBodyInspection | undefined {
  if (!isRecord(value)) return undefined;
  const content = inspectContent(value.content);
  if (content.length === 0) return undefined;
  const body: RequestBodyInspection = { required: value.required === true, content };
  if (typeof value.description === 'string') body.description = value.description;
  return body;
}

function inspectResponses(value: unknown): ResponseInspection[] {
  if (!isRecord(value)) return [];
  return Object.keys(value).sort(statusCompare).flatMap((status) => {
    const raw = value[status];
    if (!isRecord(raw)) return [];
    return [{
      status,
      description: typeof raw.description === 'string' ? raw.description : '',
      content: inspectContent(raw.content),
      headers: inspectHeaders(raw.headers)
    }];
  });
}

function inspectContent(value: unknown): SchemaContent[] {
  if (!isRecord(value)) return [];
  return Object.keys(value).sort().map((mediaType) => {
    const media = value[mediaType];
    return {
      media_type: mediaType,
      schema: isRecord(media) ? schemaObject(media.schema) : {}
    };
  });
}

function inspectHeaders(value: unknown): ResponseHeaderInspection[] {
  if (!isRecord(value)) return [];
  return Object.keys(value).sort().flatMap((name) => {
    const raw = value[name];
    if (!isRecord(raw)) return [];
    const header: ResponseHeaderInspection = {
      name,
      required: raw.required === true,
      schema: schemaObject(raw.schema)
    };
    if (typeof raw.description === 'string') header.description = raw.description;
    return [header];
  });
}

function resolveLocalRefs(
  document: OpenApiDocument,
  value: unknown,
  unresolved: Set<string>,
  stack: Set<string>
): unknown {
  if (Array.isArray(value)) return value.map((entry) => resolveLocalRefs(document, entry, unresolved, stack));
  if (!isRecord(value)) return value;
  if (typeof value.$ref === 'string') {
    const ref = value.$ref;
    if (!ref.startsWith('#/')) {
      unresolved.add(ref);
      return cloneWithoutRef(value);
    }
    if (stack.has(ref)) return { $ref: ref };
    const target = pointer(document, ref);
    if (target === undefined) {
      unresolved.add(ref);
      return cloneWithoutRef(value);
    }
    const nextStack = new Set(stack);
    nextStack.add(ref);
    const resolvedTarget = resolveLocalRefs(document, target, unresolved, nextStack);
    const siblings = resolveLocalRefs(document, cloneWithoutRef(value), unresolved, nextStack);
    return isRecord(resolvedTarget) && isRecord(siblings) ? { ...resolvedTarget, ...siblings } : resolvedTarget;
  }
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) result[key] = resolveLocalRefs(document, value[key], unresolved, stack);
  return result;
}

function pointer(document: OpenApiDocument, ref: string): unknown {
  let current: unknown = document;
  for (const token of ref.slice(2).split('/').map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~'))) {
    if (!isRecord(current) || !(token in current)) return undefined;
    current = current[token];
  }
  return current;
}

function paginationFromParameters(parameters: NormalizedParameter[]): { style: OperationSchemaEnvelope['pagination']['style']; parameters: string[] } {
  const names = parameters.filter((parameter) => parameter.location === 'query' && PAGINATION_FIELDS.has(parameter.name.toLowerCase())).map((parameter) => parameter.name).sort();
  const lower = names.map((name) => name.toLowerCase());
  const style = lower.some((name) => ['cursor', 'after', 'before'].includes(name))
    ? 'cursor'
    : lower.includes('offset')
      ? 'offset'
      : lower.some((name) => ['page', 'page_size', 'per_page'].includes(name))
        ? 'page'
        : 'none';
  return { style, parameters: names };
}

function paginationFields(schema: JsonSchemaObject): string[] {
  const result = new Set<string>();
  collectPropertyNames(schema, result, 0);
  return [...result].filter((name) => PAGINATION_FIELDS.has(name.toLowerCase())).sort();
}

function collectPropertyNames(schema: unknown, result: Set<string>, depth: number): void {
  if (!isRecord(schema) || depth > 3) return;
  if (isRecord(schema.properties)) {
    for (const [name, child] of Object.entries(schema.properties)) {
      result.add(name);
      collectPropertyNames(child, result, depth + 1);
    }
  }
  if (isRecord(schema.items)) collectPropertyNames(schema.items, result, depth + 1);
  if (Array.isArray(schema.oneOf)) schema.oneOf.forEach((entry) => collectPropertyNames(entry, result, depth + 1));
  if (Array.isArray(schema.anyOf)) schema.anyOf.forEach((entry) => collectPropertyNames(entry, result, depth + 1));
}

function isBinary(mediaType: string, schema: JsonSchemaObject): boolean {
  if (mediaType === 'application/octet-stream' || mediaType.startsWith('image/') || mediaType.startsWith('video/') || mediaType.startsWith('audio/')) return true;
  return containsBinarySchema(schema);
}

function containsBinarySchema(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsBinarySchema);
  if (!isRecord(value)) return false;
  if (value.format === 'binary' || value.contentEncoding === 'base64') return true;
  return Object.values(value).some(containsBinarySchema);
}

function schemaObject(value: unknown): JsonSchemaObject {
  return isRecord(value) ? value : {};
}

function cloneWithoutRef(value: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) if (key !== '$ref') result[key] = entry;
  return result;
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function statusCompare(left: string, right: string): number {
  if (left === 'default') return 1;
  if (right === 'default') return -1;
  return left.localeCompare(right, undefined, { numeric: true });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
