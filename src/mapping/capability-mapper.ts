import type { PolicyDecision, RiskClass } from '../contracts/types.js';
import type {
  CapabilityCandidate,
  CapabilityDomain,
  CapabilityGovernance,
  CapabilityMapArtifact,
  OperationInspection,
  SourceInspectionArtifact,
  WorkflowHint
} from '../inspection/types.js';

const ACTION_WORDS = new Set([
  'list', 'get', 'search', 'find', 'create', 'add', 'update', 'patch', 'set', 'delete', 'remove',
  'refund', 'send', 'upload', 'download', 'generate', 'render', 'approve', 'cancel', 'revoke', 'confirm',
  'publish', 'export', 'import', 'process', 'start', 'stop', 'retry'
]);

export function mapCapabilities(inspection: SourceInspectionArtifact): CapabilityMapArtifact {
  const usedNames = new Map<string, number>();
  const capabilities = inspection.operations.map((operation) => mapOperation(operation, usedNames));
  const domains = buildDomains(capabilities);
  const workflowHints = detectWorkflowHints(inspection.operations);
  const riskCounts: Record<RiskClass, number> = { R0: 0, R1: 0, R2: 0, R3: 0, R4: 0, R5: 0 };
  for (const capability of capabilities) riskCounts[capability.risk_class] += 1;

  return {
    artifact_type: 'capability_map',
    artifact_version: '0.3',
    source_ref: inspection.source.ref,
    source_title: inspection.source.title,
    domains,
    capabilities,
    workflow_hints: workflowHints,
    summary: {
      capability_count: capabilities.length,
      workflow_hint_count: workflowHints.length,
      risk_counts: riskCounts,
      approval_required_count: capabilities.filter((capability) => capability.governance.approval_mode !== 'none').length
    },
    limitations: [
      'Capability candidates are proposals and are not executable ToolContracts.',
      'Risk and governance classifications require review before compilation.',
      'Workflow hints represent likely relations, not guaranteed provider state machines.'
    ]
  };
}

function mapOperation(operation: OperationInspection, usedNames: Map<string, number>): CapabilityCandidate {
  const baseName = proposeCapabilityName(operation);
  const name = uniqueName(baseName, operation.method, usedNames);
  const riskClass = classifyRisk(operation);
  const governance = governanceFor(riskClass, operation);
  const idempotent = operation.signals.read_only || operation.method === 'put' || operation.method === 'delete' || operation.method === 'head' || operation.method === 'options';
  const taskRequired = operation.signals.asynchronous;

  return {
    id: `cap:${name}`,
    name,
    title: operation.summary,
    description: `${operation.method.toUpperCase()} ${operation.path} — ${operation.summary}`,
    source_operation_id: operation.operation_id,
    domain: operation.domain,
    method: operation.method,
    path: operation.path,
    risk_class: riskClass,
    governance,
    required_scopes: operation.auth.required_scopes,
    annotations: {
      read_only: operation.signals.read_only,
      destructive: operation.signals.destructive,
      idempotent,
      open_world: operation.signals.external_communication
    },
    execution: {
      mode: taskRequired ? 'asynchronous' : 'synchronous',
      task_support: taskRequired ? 'required' : 'forbidden',
      idempotency: operation.signals.writes ? (idempotent ? 'supported' : 'required') : 'not_applicable'
    },
    evidence: operation.evidence,
    ...(operation.schema ? { schema: operation.schema } : {})
  };
}

function classifyRisk(operation: OperationInspection): RiskClass {
  if (operation.signals.credential_change && operation.signals.destructive) return 'R5';
  if (operation.signals.financial) return 'R4';
  if (operation.signals.destructive || operation.signals.credential_change || operation.signals.external_communication) return 'R3';
  if (operation.signals.writes) return 'R2';
  if (operation.signals.personal_data || operation.auth.required) return 'R1';
  return 'R0';
}

function governanceFor(risk: RiskClass, operation: OperationInspection): CapabilityGovernance {
  const reasons: string[] = [`Classified ${risk} from source inspection signals.`];
  let decision: PolicyDecision;
  let approvalMode: CapabilityGovernance['approval_mode'];

  switch (risk) {
    case 'R5':
      decision = 'require_approver';
      approvalMode = 'dual_control';
      reasons.push('Critical credential or irreversible destructive behavior requires an approver and dual control.');
      break;
    case 'R4':
      decision = 'require_widget';
      approvalMode = 'secure_widget';
      reasons.push('Financial behavior requires a secure confirmation surface.');
      break;
    case 'R3':
      decision = 'require_confirmation';
      approvalMode = 'chat_explicit';
      reasons.push('Destructive, credential, or external communication behavior requires explicit confirmation.');
      break;
    case 'R2':
      decision = operation.auth.required_scopes.length > 0 ? 'require_scope' : 'allow';
      approvalMode = 'none';
      reasons.push('Write behavior requires scoped authorization when scopes are declared.');
      break;
    case 'R1':
      decision = operation.auth.required_scopes.length > 0 ? 'require_scope' : 'allow';
      approvalMode = 'none';
      reasons.push('Authenticated or personal-data read requires least-privilege access.');
      break;
    default:
      decision = 'allow';
      approvalMode = 'none';
      reasons.push('No elevated side-effect signal was detected.');
  }

  return { decision, approval_mode: approvalMode, reasons };
}

function proposeCapabilityName(operation: OperationInspection): string {
  const words = splitWords(operation.operation_id).map((word) => word.toLowerCase());
  if (words.length === 0) return fallbackName(operation);
  const first = words[0]!;
  if (ACTION_WORDS.has(first) && words.length > 1) {
    const resource = singularizeWords(words.slice(1));
    return [...resource, normalizeAction(first)].join('_');
  }
  const last = words[words.length - 1]!;
  if (ACTION_WORDS.has(last) && words.length > 1) {
    return [...singularizeWords(words.slice(0, -1)), normalizeAction(last)].join('_');
  }
  return words.map(singularize).join('_');
}

function fallbackName(operation: OperationInspection): string {
  const pathWords = operation.path
    .split('/')
    .filter((part) => part.length > 0 && !part.startsWith('{'))
    .flatMap(splitWords)
    .map((word) => singularize(word.toLowerCase()));
  return [...pathWords, normalizeAction(operation.method)].join('_') || `root_${operation.method}`;
}

function uniqueName(baseName: string, method: string, usedNames: Map<string, number>): string {
  const current = usedNames.get(baseName) ?? 0;
  usedNames.set(baseName, current + 1);
  if (current === 0) return baseName;
  const methodName = `${baseName}_${method}`;
  if (!usedNames.has(methodName)) {
    usedNames.set(methodName, 1);
    return methodName;
  }
  return `${methodName}_${current + 1}`;
}

function buildDomains(capabilities: CapabilityCandidate[]): CapabilityDomain[] {
  const groups = new Map<string, string[]>();
  for (const capability of capabilities) {
    const names = groups.get(capability.domain) ?? [];
    names.push(capability.name);
    groups.set(capability.domain, names);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, capabilityNames]) => ({
      name,
      capability_names: capabilityNames.sort(),
      operation_count: capabilityNames.length
    }));
}

function detectWorkflowHints(operations: OperationInspection[]): WorkflowHint[] {
  const hints: WorkflowHint[] = [];
  const byDomain = new Map<string, OperationInspection[]>();
  for (const operation of operations) {
    const group = byDomain.get(operation.domain) ?? [];
    group.push(operation);
    byDomain.set(operation.domain, group);
  }

  for (const [domain, group] of byDomain) {
    for (const operation of group) {
      if (operation.signals.asynchronous && operation.signals.writes) {
        const rootTokens = semanticTokens(operation.operation_id).filter((token) => !['create', 'start', 'generate', 'process', 'job'].includes(token));
        const status = group.find((candidate) =>
          candidate.method === 'get' &&
          semanticTokens(candidate.operation_id).includes('status') &&
          sharesMeaningfulToken(rootTokens, semanticTokens(candidate.operation_id))
        );
        if (status) {
          hints.push({
            id: `workflow:${slug(domain)}:async-status:${operation.operation_id}`,
            kind: 'async_create_status',
            domain,
            steps: [operation.operation_id, status.operation_id],
            confidence: operation.response_statuses.includes('202') ? 'high' : 'medium',
            evidence: ['Asynchronous write operation and status-oriented GET operation share a domain/resource signal.']
          });
        }
      }

      if (operation.signals.upload) {
        const confirm = group.find((candidate) =>
          candidate.operation_id !== operation.operation_id && semanticTokens(candidate.operation_id).includes('confirm')
        );
        if (confirm) {
          hints.push({
            id: `workflow:${slug(domain)}:upload-confirm:${operation.operation_id}`,
            kind: 'upload_confirm',
            domain,
            steps: [operation.operation_id, confirm.operation_id],
            confidence: 'medium',
            evidence: ['Upload operation and confirmation operation share a domain.']
          });
        }
      }
    }
  }

  return hints.sort((a, b) => a.id.localeCompare(b.id));
}

function sharesMeaningfulToken(left: string[], right: string[]): boolean {
  const rightSet = new Set(right.filter((token) => !['get', 'status', 'job'].includes(token)));
  return left.some((token) => token.length > 2 && rightSet.has(token));
}

function semanticTokens(value: string): string[] {
  return splitWords(value).map((word) => singularize(word.toLowerCase()));
}

function splitWords(value: string): string[] {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replaceAll(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function singularizeWords(words: string[]): string[] {
  return words.map(singularize);
}

function singularize(value: string): string {
  if (value === 'status' || value === 'news') return value;
  if (value.endsWith('ies')) return `${value.slice(0, -3)}y`;
  if (value.endsWith('sses')) return value.slice(0, -2);
  if (value.endsWith('s') && !value.endsWith('ss') && value.length > 3) return value.slice(0, -1);
  return value;
}

function normalizeAction(action: string): string {
  if (action === 'get') return 'get';
  return action;
}

function slug(value: string): string {
  return value.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
