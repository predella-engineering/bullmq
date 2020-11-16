import { JobsOptions, QueueOptions, RepeatOptions } from '../interfaces';
import { Job, QueueGetters, Repeat } from './';
export declare class Queue<T = any> extends QueueGetters {
    token: string;
    jobsOpts: JobsOptions;
    limiter: {
        groupKey: string;
    };
    private _repeat;
    constructor(name: string, opts?: QueueOptions);
    get defaultJobOptions(): JobsOptions;
    get repeat(): Promise<Repeat>;
    add(name: string, data: T, opts?: JobsOptions): Promise<Job<any, any>>;
    private jobIdForGroup;
    /**
     * Adds an array of jobs to the queue.
     * @method add
     * @param jobs: [] The array of jobs to add to the queue. Each job is defined by 3
     * properties, 'name', 'data' and 'opts'. They follow the same signature as 'Queue.add'.
     */
    addBulk(jobs: {
        name: string;
        data: T;
        opts?: JobsOptions;
    }[]): Promise<Job<T, any>[]>;
    /**
      Pauses the processing of this queue globally.
  
      We use an atomic RENAME operation on the wait queue. Since
      we have blocking calls with BRPOPLPUSH on the wait queue, as long as the queue
      is renamed to 'paused', no new jobs will be processed (the current ones
      will run until finalized).
  
      Adding jobs requires a LUA script to check first if the paused list exist
      and in that case it will add it there instead of the wait list.
    */
    pause(): Promise<void>;
    resume(): Promise<void>;
    getRepeatableJobs(start?: number, end?: number, asc?: boolean): Promise<{
        key: string;
        name: string;
        id: string;
        endDate: number;
        tz: string;
        cron: string;
        next: number;
    }[]>;
    removeRepeatable(name: string, repeatOpts: RepeatOptions, jobId?: string): Promise<any>;
    removeRepeatableByKey(key: string): Promise<any>;
    /**
     * Drains the queue, i.e., removes all jobs that are waiting
     * or delayed, but not active, completed or failed.
     *
     * TODO: Convert to an atomic LUA script.
     */
    drain(delayed?: boolean): Promise<[Error, any][]>;
    clean(grace: number, limit: number, type?: 'completed' | 'wait' | 'active' | 'paused' | 'delayed' | 'failed'): Promise<any>;
    trimEvents(maxLength: number): Promise<number>;
}
