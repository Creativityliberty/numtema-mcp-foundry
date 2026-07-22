import type { IncomingMessage, ServerResponse } from 'node:http';
import { type OAuthService } from './service.js';
export interface OAuthHttpGateway {
    handle(request: IncomingMessage, response: ServerResponse): Promise<boolean>;
}
export declare function createOAuthHttpGateway(service: OAuthService): OAuthHttpGateway;
