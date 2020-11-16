/// <reference types="node" />
import { EventEmitter } from 'events';
import * as IORedis from 'ioredis';
import { ConnectionOptions } from '../interfaces';
export declare class RedisConnection extends EventEmitter {
    private opts?;
    static minimumVersion: string;
    private _client;
    private initializing;
    private closing;
    constructor(opts?: ConnectionOptions);
    /**
     * Waits for a redis client to be ready.
     * @param {Redis} redis client
     */
    static waitUntilReady(client: IORedis.Redis): Promise<unknown>;
    get client(): Promise<IORedis.Redis>;
    private init;
    disconnect(): Promise<void>;
    reconnect(): Promise<void>;
    close(): Promise<void>;
    private getRedisVersion;
}
