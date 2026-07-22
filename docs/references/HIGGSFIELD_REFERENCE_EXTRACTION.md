# Higgsfield Reference Extraction

The reference tool catalog demonstrates several patterns adopted by Foundry:

1. `apps_search → apps_describe → apps_invoke` separates discovery, contract inspection, and execution.
2. `manifest_revision` blocks invocation against a stale contract.
3. Public tools and private/internal confirmation actions are separated.
4. Expensive and destructive actions require user confirmation.
5. Long-running operations return queued jobs and use status tools rather than resubmission.
6. Media upload uses prepare/upload/confirm and passes media identifiers to generation tools.
7. `get_cost` supports preflight without execution.
8. `recovery_tool` turns recoverable failures into explicit next transitions.
9. Widgets are used as upload and confirmation surfaces with explicit content-security policies.

Foundry generalizes these ideas without copying Higgsfield-specific provider behavior.
