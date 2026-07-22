export interface ChatGptAppInitReport {
    directory: string;
    config_file: string;
    username: string;
    password: string;
    workspace_ref: string;
    public_base_url: string;
    generated_private_keys: 5;
}
export declare function initializeChatGptApp(directory: string, force?: boolean, publicBaseUrl?: string): Promise<ChatGptAppInitReport>;
