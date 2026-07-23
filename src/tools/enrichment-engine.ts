import type { ContractBundle, ToolContract } from '../contracts/types.js';
import { classifyToolArguments, buildModelInputSchema } from './argument-classifier.js';
import { enrichToolDescription } from './description-enricher.js';
import { inferRequiredScopes } from './scope-inference.js';
import { generateToolExamples } from './example-generator.js';
import { normalizeToolErrors } from './error-normalizer.js';
import { buildApprovalPresentation } from './approval-presentation.js';
import { scoreToolQuality } from './quality-scorer.js';
import { buildQualityReport, buildToolCatalog as catalogFromBundle } from './catalog-builder.js';
import type { EnrichedToolBundle, ToolIntelligence, ToolQualityEntry, ToolCatalog } from './types.js';

export function enrichToolBundle(input: ContractBundle): EnrichedToolBundle {
  const bundle = structuredClone(input);
  const entries: ToolQualityEntry[] = [];
  bundle.tools = bundle.tools.map((tool) => {
    const next = structuredClone(tool);
    next.required_scopes = inferRequiredScopes(next);
    next.description = enrichToolDescription(next);
    const argumentsList = classifyToolArguments(next);
    const modelInput = buildModelInputSchema(next, argumentsList);
    const base = {
      artifact_version: '1.0' as const,
      model_input_schema: modelInput,
      arguments: argumentsList,
      examples: generateToolExamples(next, modelInput),
      errors: normalizeToolErrors(next),
      approval: buildApprovalPresentation(next),
      effective_scopes: [...next.required_scopes]
    };
    const quality = scoreToolQuality(next, base);
    entries.push(quality);
    const intelligence: ToolIntelligence = { ...base, quality };
    next.extensions = mergeIntelligence(next, intelligence);
    return next;
  });
  const scopes = [...new Set(bundle.tools.flatMap((tool) => tool.required_scopes))].sort();
  for (const auth of bundle.auth) auth.required_scopes = [...new Set([...auth.required_scopes, ...scopes])].sort();
  const quality_report = buildQualityReport(entries);
  const catalog = catalogFromBundle(bundle);
  return { bundle, quality_report, catalog };
}

export function buildToolCatalog(bundle: ContractBundle): ToolCatalog { return catalogFromBundle(bundle); }
function mergeIntelligence(tool: ToolContract, intelligence: ToolIntelligence): Record<string, unknown> { const extensions = asObject(tool.extensions); const foundry = asObject(extensions.foundry); return { ...extensions, foundry: { ...foundry, tool_intelligence: intelligence } }; }
function asObject(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
