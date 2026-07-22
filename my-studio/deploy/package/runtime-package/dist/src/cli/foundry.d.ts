#!/usr/bin/env node
export interface CliIo {
    out(value: string): void;
    error(value: string): void;
}
export declare function runCli(args: string[], io?: CliIo): Promise<number>;
