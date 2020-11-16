import { Redis } from 'ioredis';
export declare const errorObject: {
    [index: string]: any;
};
export declare function tryCatch(fn: (...args: any) => any, ctx: any, args: any[]): any;
export declare function isEmpty(obj: object): boolean;
export declare function array2obj(arr: string[]): {
    [index: string]: string;
};
export declare function delay(ms: number): Promise<void>;
export declare function isRedisInstance(obj: any): boolean;
export declare function removeAllQueueData(client: Redis, queueName: string, prefix?: string): Promise<unknown>;
