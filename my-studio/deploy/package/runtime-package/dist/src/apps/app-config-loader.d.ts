import type { ChatGptAppConfig } from './app-config.js';
export declare function loadChatGptAppConfig(path: string): Promise<{
    config: ChatGptAppConfig;
    root: string;
}>;
