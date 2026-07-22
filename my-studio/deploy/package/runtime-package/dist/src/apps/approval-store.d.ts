export interface ApprovalChallenge {
    challenge_id: string;
    target_tool: string;
    tool_id: string;
    tool_revision: string;
    adapter_id: string;
    adapter_revision: string;
    approval_ref: string;
    risk_class: string;
    args_digest: string;
    arguments: Record<string, unknown>;
    subject_ref: string;
    client_ref: string;
    workspace_ref: string;
    created_at: string;
    expires_at: string;
    status: 'pending' | 'confirmed' | 'denied' | 'consumed';
    confirmed_at: string | null;
    consumed_at: string | null;
}
export declare class ApprovalChallengeStore {
    readonly directory: string;
    constructor(directory: string);
    create(challenge: ApprovalChallenge): Promise<void>;
    decide(challengeId: string, tenant: {
        subject_ref: string;
        client_ref: string;
        workspace_ref: string;
    }, decision: 'approve' | 'deny', at: string): Promise<ApprovalChallenge>;
    consume(match: {
        target_tool: string;
        tool_revision: string;
        adapter_id: string;
        adapter_revision: string;
        args_digest: string;
        tenant: {
            subject_ref: string;
            client_ref: string;
            workspace_ref: string;
        };
        at: string;
    }): Promise<ApprovalChallenge | undefined>;
    read(challengeId: string): Promise<ApprovalChallenge | undefined>;
    private mutate;
}
