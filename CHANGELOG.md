# Changelog

## v1.3.0 — 2026-07-22

### Added

- Root `AGENTS.md` operating contract for coding agents
- GitHub contribution, security, pull-request, issue, and Node 22 CI templates
- Secret-audit and guarded GitHub publication scripts
- Exact manual Coolify configuration runbook for domain, Compose, variables, volume, healthcheck, and ChatGPT connection
- Public GitHub delivery bootstrap under `Creativityliberty/aimcp`

### Fixed

- Prevent recursive nesting when a Studio deployment package is rebuilt inside an existing generated project
- Align release README and GitHub publication commands with v1.3.0

### Security

- GitHub publication is blocked until secret audit, typecheck, and the complete test suite pass
- Provider tokens and administrator passwords are documented as runtime-only Coolify variables
- Durable cryptographic state remains isolated in the `/data` persistent volume

## v1.2.0 — 2026-07-22

### Added

- Local-first Foundry Studio served by the existing zero-dependency CLI
- OpenAPI JSON/YAML import, governed tool editor, OAuth/provider configuration, approval preview, and dry-run simulator
- Atomic Studio project store with traversal protection and 2 MB source limit
- Real kernel-backed pipeline producing inspection, CapabilityMap, ContractBundle, adapters, auth bindings, and credential catalog
- Safe overrides that may raise but cannot silently lower risk or approval requirements
- Self-contained Docker deployment package for Coolify and generic VPS hosts
- Required environment variables, persistent volume, healthcheck, bootstrap, and ChatGPT connection guide
- `foundry studio init`, `inspect`, `build`, and `serve` commands
- Loopback-only Studio server, CSRF-protected writes, CSP, and stable local API envelopes
- Studio project and deployment package JSON Schemas

### Security

- Provider secret values are never stored in Studio artifacts
- Deployment packages contain no private keys; Ed25519 keys are created on first container start
- Remote Studio binding is refused until an authenticated remote gateway is implemented
- Tool risk and approval downgrades are rejected

### Explicitly excluded

- Authenticated Coolify API deployment from the Studio
- Hosted multi-user Studio
- Live deployment logs and rollback controls
- Visual screenshot certification in restricted headless environments

## v1.1.0 — 2026-07-22

### Added

- ChatGPT App assembly over the governed MCP v1.0 runtime
- OAuth 2.1 Authorization Code gateway with mandatory PKCE S256
- RFC 9728 Protected Resource Metadata and RFC 8414 authorization-server discovery
- Ed25519 audience-bound access tokens, rotating refresh tokens, revocation, JWKS, userinfo, and DCR
- User, client, workspace, provider-account, and scope isolation
- Progressive 401/403 scope challenges for MCP operations
- Apps SDK `resources/list` and `resources/read` support
- Secure approval widget using `text/html;profile=mcp-app` and `ui://numtema/approval.html`
- Exact, one-time, tenant-bound approval challenges and proofs
- Automatic handoff from a high-risk tool call to the approval widget
- Optional direct TLS files and reverse-proxy deployment templates
- `foundry app init`, `inspect`, `smoke`, and `serve` commands
- ChatGPT App v1.1 JSON Schema and remote deployment guide

### Security

- Access tokens are accepted only for the configured MCP resource audience
- Authorization codes are single-use and redirect URIs are exact
- No OAuth token is passed through to a provider API
- Private OAuth and approval keys are generated locally and excluded from distributed examples
- Plaintext development passwords are displayed once and never stored in app configuration

### Explicitly excluded

- Automatic publication inside a user’s ChatGPT workspace
- Enterprise SAML/SCIM federation
- Distributed OAuth/approval storage and high-availability consensus
- Public app marketplace review submission

## v1.0.0 — 2026-07-22

### Added

- MCP JSON-RPC runtime with initialize, ping, tools/list, and tools/call
- Deterministic tool registry with MCP annotations and Foundry governance metadata
- Stdio and stateless Streamable HTTP transports
- Origin, bearer, Accept, protocol-version, and mirrored MCP header checks
- Governed provider runtime from tool call through policy, preflight, Ledger reservation, and HTTP execution
- Final-boundary environment credential injection with redacted artifacts
- Provider response normalization and signed Ed25519 execution receipts
- Durable dispatch commit on provider response and release on transport failure
- `foundry mcp init`, `inspect`, `smoke`, and `serve` commands
- Portable local mock-provider demonstration with locally generated signing keys
- MCP runtime configuration and signed execution receipt JSON Schemas

### Explicitly excluded

- Public OAuth authorization server and browser consent flow
- Apps SDK widgets and marketplace submission
- Multipart Artifact Gateway execution
- Distributed Ledger consensus

## v0.8.1 — 2026-07-22

### Added

- Portable package-root and asset resolution independent of the current working directory
- Global npm binary verified through a real symlinked installation
- `foundry doctor` installation diagnostics with JSON output
- `foundry demo` bundled deterministic first-run pipeline
- `foundry init` dependency-free starter project generator
- Safe non-empty-directory refusal and explicit `--force` replacement
- `foundry --help` and `foundry --version`
- macOS/Linux and Windows PowerShell installer scripts
- npm tarball file allowlist with compiled runtime, schemas, demo asset, and installation guide
- JSON Schemas for doctor, demo, and init reports
- Isolated npm pack/install integration tests
- 88 automated tests across 32 suites

### Fixed

- Schema and example lookup no longer depends on launching Foundry from its repository root
- Global npm symlink invocation now executes the CLI entrypoint correctly

### Explicitly excluded

- Provider network execution
- MCP transport server
- Live vault secret resolution
- Desktop DMG/EXE packaging
- Durable nonce and budget reservation

## v0.8.0 — 2026-07-22

### Added

- Secure Provider Runtime Preflight
- Canonical runtime payload hashing
- Ed25519 policy, approval, and budget proof verification
- Purpose-separated public RuntimeTrustStore
- Exact tool, adapter, revision, arguments, tenant, risk, and cost binding
- Approval expiry, nonce, single-use, and mode checks
- Budget limit and remaining-amount enforcement
- Secret-material scan across execution and credential plans
- Deterministic AuthorizedExecutionEnvelope
- `foundry preflight` CLI command
- Five new runtime JSON Schemas
- Signed static examples without distributed private keys

### Explicitly excluded

- Provider network execution
- Live vault secret resolution
- Token injection
- Durable nonce consumption
- Durable budget reservation
- Dispatch receipt signing
- MCP transport


## v0.7.0 — 2026-07-22

### Added

- ProviderAuthBindingContract compilation for OAuth 2.1, bearer, API key, Basic, HMAC, host-managed, and no-auth modes
- Deterministic credential account resolution across subject, client, workspace, provider, provider-account, and scope dimensions
- OAuth audience and resource-URI enforcement
- Scope, account-state, expiration, and tenant-isolation preflight checks
- Redacted credential injection envelopes with no secret locator or secret material
- `foundry auth-bindings` and `foundry auth-plan` CLI commands
- Credential catalog, auth-binding bundle, and credential-resolution-plan JSON Schemas
- Canonical documentation classification under `docs/`
- Exhaustive JSON distribution bundle under `bundle/json/` with SHA-256 catalog
- 71 automated tests across 24 suites

### Explicitly excluded

- Secret retrieval from a vault
- Live token or API-key injection
- Provider network execution
- OAuth browser authorization UI
- Automatic refresh-token rotation
- MCP transport server

## v0.6.0 — 2026-07-22

### Added

- Deterministic `ProviderAdapterContract` compilation from enriched ToolContracts
- HTTP path, query, header, cookie, request-body, response, auth-reference, and idempotency bindings
- JSON, form-urlencoded, multipart-descriptor, text, and artifact-reference body planning
- `ProviderExecutionPlan` dry-run artifacts with zero secret material
- Deterministic path substitution and OpenAPI-style query serialization
- Required and optional `Idempotency-Key` planning
- Response normalization for JSON, problem details, text, binary, and empty responses
- Retryability and provider-error categorization
- `foundry adapters` and `foundry plan` CLI commands
- Provider adapter and execution-plan JSON Schemas
- Generated provider adapter and dry-run plan examples
- 57 automated tests across 19 suites

### Explicitly excluded

- Provider network calls
- Live credential resolution or token injection
- Multipart byte assembly
- Automatic retries
- MCP transport server
- Receipt signing

## v0.5.0 — 2026-07-22

### Added

- OpenAPI schema envelope across inspection and capability mapping
- Recursive local JSON Pointer `$ref` resolution
- External-reference recording without remote fetching
- Parameter schema, location, serialization, and required-state preservation
- Request body and media-type preservation
- Success, error, redirect, and informational response preservation
- Response-header extraction
- Binary media detection
- Cursor, page, and offset pagination contracts
- Exact ToolContract input and success-output schemas
- Error and response normalization metadata
- Schema-rich examples and pipeline command
- 42 automated tests across 14 suites

### Explicitly excluded

- Remote `$ref` downloads
- Provider network execution
- MCP transport
- Provider-specific OAuth
- Error-to-MCP runtime conversion
- Artifact upload runtime


## v0.4.0 — 2026-07-22

### Added

- Strict CapabilityMap JSON and controlled-YAML loader
- CapabilityMap artifact-schema validation
- Deterministic Tool Contract Compiler
- One ToolContract and exact PolicyContract per capability
- Draft host-managed AuthContract with tenant-aware credential binding
- R3 chat, R4 secure-widget, and R5 dual-control ApprovalContracts
- Workflow-derived bounded RecoveryContracts
- Stable SHA-256 tool manifest revisions
- Conservative input/output schema drafts with explicit fidelity metadata
- `foundry compile` CLI command with self-validation
- Generated reference ContractBundle
- ADR-0007 deterministic draft compilation
- Automated compiler and CLI tests

### Explicitly excluded

- Provider request execution
- MCP transport server
- Provider-specific OAuth configuration
- Approval-token issuance
- Widget implementation
- Receipt signing
- Full OpenAPI schema enrichment

## v0.3.0 — 2026-07-22

### Added

- OpenAPI 3.0 and 3.1 JSON/controlled-YAML loader
- Deterministic Source Inspector
- Evidence-bearing risk, auth, pagination, async, upload, callback, and data signals
- Capability Mapper with stable naming and collision handling
- R0–R5 classification and governance recommendations
- Async create/status and upload/confirm workflow hints
- `foundry inspect` and `foundry map` CLI commands
- SourceInspectionArtifact and CapabilityMapArtifact schemas

## v0.2.0 — 2026-07-22

### Added

- Executable zero-runtime-dependency Contract Kernel
- Canonical TypeScript models for seven contract families
- Controlled YAML and JSON ContractBundle loader
- Bundle indexing with duplicate ID and tool-name rejection
- Structural JSON Schema evaluator for the Foundry schema profile
- Constitutional semantic validator
- OAuth audience, PKCE, tenancy, and token-passthrough rules
- Risk, approval, scope, idempotency, recovery, receipt, and revision rules
- `foundry validate` CLI with human and JSON reports
- Stable exit codes for CI
- Valid and invalid fixtures
- Compiled JavaScript distribution
- Automated tests

## v0.1.0 — 2026-07-22

### Added

- Foundry Constitution v1
- Vendor-neutral reference architecture
- Stable MCP baseline decision
- Fundamental contract catalog
- JSON Schemas for Tool, Auth, Policy, Approval, Recovery, Receipt, and Foundry Artifact contracts
- Capability lifecycle and governance gates
- Security and trust model
- Initial ADR set
- Example `foundry.project.yaml`

## 1.3.0 — GitHub Publishing & Coolify Runbook

- Added root `AGENTS.md` with architecture, invariants, security rules, tests, and agent workflow.
- Added GitHub Actions CI, issue templates, pull request template, contribution and security policies.
- Added secret-audit and guarded GitHub publication scripts.
- Added exact field-by-field Coolify configuration and GitHub publishing guides.
- Fixed recursive self-copy when rebuilding a Studio deployment package inside the examples tree.
