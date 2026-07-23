# Sprint 1.4 — Tool Intelligence & Catalog Completion Design

## Goal

Transform every compiled OpenAPI operation into a tool that is easy for ChatGPT to select, safe to execute, and complete enough to pass an objective production quality gate.

## Scope

Sprint 1.4 adds deterministic tool enrichment after contract compilation. It does not call an LLM, execute provider network requests, or weaken any existing policy, approval, credential, OAuth, or Ledger boundary.

## Architecture

The existing compiler remains the source of the governed `ToolContract`. A new `src/tools/` subsystem derives presentation and quality artifacts from each contract:

1. `argument-classifier.ts` classifies fields as model, runtime, credential, server-default, or hidden arguments.
2. `description-enricher.ts` produces concise task-oriented descriptions and fills missing property descriptions.
3. `scope-inference.ts` assigns deterministic domain/action scopes when the source API did not declare scopes.
4. `example-generator.ts` creates minimal and realistic valid examples plus a rejected example.
5. `error-normalizer.ts` converts provider response contracts into stable user-facing error categories.
6. `quality-scorer.ts` evaluates name, description, schemas, examples, scopes, governance, errors, mapping, and tests.
7. `catalog-builder.ts` assembles an auditable `ToolCatalog` and aggregate `ToolQualityReport`.

`enrichToolBundle()` orchestrates the subsystem and returns the original contract bundle with an additive `extensions.foundry.tool_intelligence` block. Existing contract semantics remain unchanged.

## Generated Artifacts

- `ToolExampleSet`
- `ToolErrorContract`
- `ToolScopeAssignment`
- `ToolApprovalPresentation`
- `ToolQualityReport`
- `ToolCatalog`

The Studio pipeline writes:

- `generated/tool-catalog.json`
- `generated/tool-quality-report.json`

## Tool Description Contract

Descriptions state what the tool does, when to use it, the primary result shape, and whether it reads or changes provider data. Descriptions remain deterministic and bounded to avoid excessive MCP context.

## Argument Exposure

Headers and parameters are classified as follows:

- authorization, API keys, cookies: `credential_managed`;
- trace IDs and idempotency keys: `runtime_managed`;
- pagination cursors and meaningful business filters: `model_argument`;
- values with safe fixed server defaults: `server_default`;
- unsupported transport-only fields: `hidden_internal`.

Only `model_argument` fields remain visible in the enriched input schema. The original parameter contract is retained for request planning.

## Scope Inference

If `required_scopes` is empty, the engine derives a pluralized domain scope:

- reads: `<domain>:read`;
- writes: `<domain>:write`;
- destructive actions: `<domain>:delete`;
- specialized actions use their verb, for example `invoices:approve` and `payments:refund`.

Declared scopes always win. Inference cannot remove or weaken a declared scope.

## Errors

Provider errors map into these stable categories:

- validation
- authentication
- authorization
- not_found
- conflict
- rate_limit
- provider_error
- network_error
- timeout
- unknown

Every normalized error includes a deterministic code, retryability, user message, technical source status, and optional schema.

## Quality Score

The score is out of 100:

- name: 10
- description: 15
- input schema: 15
- output schema: 10
- examples: 10
- scopes: 10
- risk and approval: 10
- error contract: 10
- provider mapping: 5
- tests/evaluation evidence: 5

Statuses:

- 0–49: incomplete
- 50–69: needs_improvement
- 70–84: usable
- 85–94: ready
- 95–100: premium

A production Studio build fails when any enabled tool scores below 85 unless `--allow-incomplete` is explicitly supplied.

## CLI

`foundry tools audit <project>` prints the aggregate report and exits non-zero when the quality gate fails.

`foundry tools audit <project> --json` emits the full report.

`foundry studio build <project> --allow-incomplete` bypasses only the tool quality threshold. It does not bypass schema, policy, approval, credential, or secret checks.

## Studio

The existing Tools screen gains quality status, score, inferred scopes, hidden/runtime arguments, examples, and normalized errors. Existing override rules continue to forbid risk and approval downgrades.

## Compatibility

- Node.js 22+.
- Zero runtime dependencies.
- Existing ToolContract fields and MCP names remain backward compatible.
- New metadata is additive under `extensions.foundry.tool_intelligence` and new generated artifacts.
- No secret value is accepted or emitted.

## Acceptance Criteria

- Every enabled demonstration tool has a title and task-oriented description.
- Every visible input property has a description.
- Technical auth, trace, and idempotency arguments are not exposed to the model.
- Every write has at least one required scope.
- Every sensitive tool has an approval presentation.
- Every tool has two valid examples and one rejected example.
- Every tool has a normalized error contract.
- Demo average quality is at least 90 and every enabled tool is at least 85.
- Existing 148 tests remain green.
- New tool intelligence, CLI audit, Studio build gate, schema, and install tests pass.
- Secret audit passes.
