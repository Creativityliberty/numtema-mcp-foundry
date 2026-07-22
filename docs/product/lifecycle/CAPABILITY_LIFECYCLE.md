# Capability Lifecycle

## 1. Build-time lifecycle

```text
SourceInput
  ↓ Source Integrity Gate
SourceInspectionArtifact
  ↓ Capability Mapping Gate
CapabilityMapArtifact
  ↓ Contract Completeness Gate
ToolContractSetArtifact
  ↓ Auth Compatibility Gate
AuthContractArtifact
  ↓ Policy and Risk Gate
PolicyContractArtifact
  ↓ Build Specification Gate
FoundryBuildSpecArtifact
  ↓ Simulation and Security Gates
ValidationReportArtifact
  ↓ Packaging Gate
DeploymentPackageArtifact
```

## 2. Runtime lifecycle

```text
Discover
→ Describe
→ Preflight
→ Authorize
→ Confirm
→ Invoke
→ Observe
→ Recover
→ Receipt
```

### Discover

Locate capabilities by name, domain, description, provider, or required scopes. No external side effect.

### Describe

Return the exact contract revision, schemas, execution mode, cost semantics, side effects, and client presentation metadata.

### Preflight

Validate arguments, compute or estimate cost, resolve artifacts, check provider availability, and detect missing prerequisites without performing the primary side effect.

### Authorize

Validate identity, tenant, audience, scopes, and provider binding.

### Confirm

Obtain a policy-compliant approval when required. Approval is tied to the described revision and normalized arguments.

### Invoke

Submit exactly once under an idempotency key. A stale revision is rejected.

### Observe

For tasks, poll or subscribe to lifecycle state. Do not re-invoke the primary operation as a polling strategy.

### Recover

Apply a typed recovery route only within approved risk, scope, and cost boundaries.

### Receipt

Emit execution evidence for terminal states, including failure and cancellation.

## 3. Runtime task states

```text
accepted
queued
running
waiting_for_input
waiting_for_approval
succeeded
failed
cancelled
expired
```

Terminal states are `succeeded`, `failed`, `cancelled`, and `expired`.

## 4. Contract revision behavior

- `describe` returns `contract_revision`.
- `invoke` sends the same revision.
- A mismatch returns `contract_changed`.
- The client re-describes and re-runs preflight and policy evaluation.
- Existing approvals become invalid unless the new revision is proven approval-compatible.
