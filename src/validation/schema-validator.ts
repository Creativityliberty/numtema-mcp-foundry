import type { ContractKind } from '../contracts/types.js';
import type { JsonSchema, SchemaRegistry } from '../schema/schema-registry.js';
import { sortValidationIssues, type ValidationIssue } from './issues.js';

type JsonObject = Record<string, unknown>;

export function validateContract(
  registry: SchemaRegistry,
  kind: ContractKind,
  value: unknown
): ValidationIssue[] {
  const schema = registry.schemas.get(kind);
  if (!schema) {
    return [{
      code: 'SCHEMA_NOT_REGISTERED',
      severity: 'error',
      path: '',
      message: `No schema is registered for contract kind ${kind}.`,
      contract_kind: kind
    }];
  }

  const contractId = isObject(value) && typeof value.id === 'string'
    ? value.id
    : isObject(value) && typeof value.receipt_id === 'string'
      ? value.receipt_id
      : isObject(value) && typeof value.artifact_id === 'string'
        ? value.artifact_id
        : undefined;

  return validateValueAgainstSchema(schema, value, kind, contractId);
}

export function validateValueAgainstSchema(
  schema: JsonSchema,
  value: unknown,
  kind = 'value',
  valueId?: string
): ValidationIssue[] {
  return sortValidationIssues(evaluateSchema(schema, value, '', kind, valueId));
}

function evaluateSchema(
  schema: JsonSchema,
  value: unknown,
  path: string,
  kind: string,
  contractId?: string
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const issue = (code: string, message: string, issuePath = path): void => {
    const record: ValidationIssue = {
      code,
      severity: 'error',
      path: issuePath,
      message,
      contract_kind: kind
    };
    if (contractId !== undefined) record.contract_id = contractId;
    issues.push(record);
  };

  if (Array.isArray(schema.allOf)) {
    for (const child of schema.allOf) {
      if (isObject(child)) issues.push(...evaluateSchema(child, value, path, kind, contractId));
    }
  }

  if (isObject(schema.if) && isObject(schema.then)) {
    const conditionIssues = evaluateSchema(schema.if, value, path, kind, contractId);
    if (conditionIssues.length === 0) {
      issues.push(...evaluateSchema(schema.then, value, path, kind, contractId));
    }
  }

  if ('const' in schema && !deepEqual(value, schema.const)) {
    issue('SCHEMA_CONST', `Value must equal ${JSON.stringify(schema.const)}.`);
    return issues;
  }

  if (Array.isArray(schema.enum) && !schema.enum.some((candidate) => deepEqual(candidate, value))) {
    issue('SCHEMA_ENUM', `Value must be one of ${schema.enum.map(String).join(', ')}.`);
    return issues;
  }

  if (schema.type !== undefined) {
    const allowedTypes = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!allowedTypes.some((type) => matchesType(type, value))) {
      issue('SCHEMA_TYPE', `Expected ${allowedTypes.join(' or ')}.`);
      return issues;
    }
  }

  if (typeof value === 'string') {
    if (typeof schema.minLength === 'number' && value.length < schema.minLength) {
      issue('SCHEMA_MIN_LENGTH', `String must contain at least ${schema.minLength} characters.`);
    }
    if (typeof schema.maxLength === 'number' && value.length > schema.maxLength) {
      issue('SCHEMA_MAX_LENGTH', `String must contain at most ${schema.maxLength} characters.`);
    }
    if (typeof schema.pattern === 'string' && !new RegExp(schema.pattern).test(value)) {
      issue('SCHEMA_PATTERN', `String does not match pattern ${schema.pattern}.`);
    }
    if (schema.format === 'date-time' && !isDateTime(value)) {
      issue('SCHEMA_FORMAT', 'String must be a valid RFC 3339 date-time.');
    }
    if (schema.format === 'uri' && !isUri(value)) {
      issue('SCHEMA_FORMAT', 'String must be an absolute URI.');
    }
  }

  if (typeof value === 'number') {
    if (typeof schema.minimum === 'number' && value < schema.minimum) {
      issue('SCHEMA_MINIMUM', `Number must be at least ${schema.minimum}.`);
    }
    if (typeof schema.maximum === 'number' && value > schema.maximum) {
      issue('SCHEMA_MAXIMUM', `Number must be at most ${schema.maximum}.`);
    }
  }

  if (Array.isArray(value)) {
    if (schema.uniqueItems === true) {
      const serialized = value.map((item) => JSON.stringify(item));
      if (new Set(serialized).size !== serialized.length) {
        issue('SCHEMA_UNIQUE_ITEMS', 'Array items must be unique.');
      }
    }
    if (isObject(schema.items)) {
      value.forEach((item, index) => {
        issues.push(...evaluateSchema(schema.items as JsonSchema, item, joinPath(path, String(index)), kind, contractId));
      });
    }
    if (isObject(schema.contains)) {
      const containsMatch = value.some((item) => evaluateSchema(schema.contains as JsonSchema, item, path, kind, contractId).length === 0);
      if (!containsMatch) issue('SCHEMA_CONTAINS', 'Array does not contain a required value.');
    }
  }

  if (isObject(value)) {
    const required = Array.isArray(schema.required) ? schema.required : [];
    for (const requiredKey of required) {
      if (typeof requiredKey === 'string' && !(requiredKey in value)) {
        issue('SCHEMA_REQUIRED', `Required property ${requiredKey} is missing.`, joinPath(path, requiredKey));
      }
    }

    const properties = isObject(schema.properties) ? schema.properties : {};
    for (const [key, childSchema] of Object.entries(properties)) {
      if (key in value && isObject(childSchema)) {
        issues.push(...evaluateSchema(childSchema, value[key], joinPath(path, key), kind, contractId));
      }
    }

    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in properties)) {
          issue('SCHEMA_ADDITIONAL_PROPERTY', `Property ${key} is not allowed.`, joinPath(path, key));
        }
      }
    }
  }

  return issues;
}

function matchesType(type: unknown, value: unknown): boolean {
  switch (type) {
    case 'object': return isObject(value);
    case 'array': return Array.isArray(value);
    case 'string': return typeof value === 'string';
    case 'boolean': return typeof value === 'boolean';
    case 'number': return typeof value === 'number' && Number.isFinite(value);
    case 'integer': return typeof value === 'number' && Number.isInteger(value);
    case 'null': return value === null;
    default: return true;
  }
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function joinPath(base: string, segment: string): string {
  const escaped = segment.replaceAll('~', '~0').replaceAll('/', '~1');
  return `${base}/${escaped}`;
}

function isDateTime(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && !Number.isNaN(Date.parse(value));
}

function isUri(value: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(value);
}

function deepEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
