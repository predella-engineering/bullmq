/// <reference types="ioredis" />
/// <reference types="node" />
import { EventEmitter } from 'events';
import { QueueBaseOptions } from '../interfaces';
import { RedisConnection } from './redis-connection';
export declare class QueueBase extends EventEmitter {
    readonly name: string;
    opts: QueueBaseOptions;
    keys: {
        [index: string]: string;
    };
    closing: Promise<void>;
    protected connection: RedisConnection;
    constructor(name: string, opts?: QueueBaseOptions);
    toKey(type: string): string;
    get client(): Promise<import("ioredis").Redis>;
    waitUntilReady(): Promise<import("ioredis").Redis>;
    protected base64Name(): string;
    protected clientName(): string;
    close(): Promise<void>;
    disconnect(): Promise<void>;
}
