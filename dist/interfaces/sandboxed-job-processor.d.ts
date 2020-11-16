import { SandboxedJob } from './sandboxed-job';
export declare type SandboxedJobProcessor<T = any, R = any> = ((job: SandboxedJob<T, R>) => R | PromiseLike<R>) | ((job: SandboxedJob<T, R>, callback: (error: unknown, result: R) => void) => void);
