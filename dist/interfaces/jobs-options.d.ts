import { RepeatOptions } from './repeat-options';
import { BackoffOptions } from './backoff-options';
export interface JobsOptions {
    timestamp?: number;
    priority?: number;
    delay?: number;
    attempts?: number;
    repeat?: RepeatOptions;
    rateLimiterKey?: string;
    backoff?: number | BackoffOptions;
    lifo?: boolean;
    timeout?: number;
    jobId?: string;
    removeOnComplete?: boolean | number;
    removeOnFail?: boolean | number;
    stackTraceLimit?: number;
}
