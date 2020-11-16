/**
 * Includes all the scripts needed by the queue and jobs.
 */
import { Redis } from 'ioredis';
import { JobsOptions } from '../interfaces';
import { Queue, QueueBase, QueueScheduler, Worker } from './';
import { Job, JobJson } from './job';
export declare class Scripts {
    static isJobInList(client: Redis, listKey: string, jobId: string): Promise<boolean>;
    static addJob(client: Redis, queue: QueueBase, job: JobJson, opts: JobsOptions, jobId: string): any;
    static pause(queue: Queue, pause: boolean): Promise<any>;
    static remove(queue: QueueBase, jobId: string): Promise<any>;
    static extendLock(worker: Worker, jobId: string, token: string): Promise<any>;
    static updateProgress(queue: QueueBase, job: Job, progress: number | object): Promise<void>;
    static moveToFinishedArgs(queue: QueueBase, job: Job, val: any, propVal: string, shouldRemove: boolean | number, target: string, token: string, fetchNext?: boolean): string[];
    static moveToFinished(queue: QueueBase, job: Job, val: any, propVal: string, shouldRemove: boolean | number, target: string, token: string, fetchNext: boolean): Promise<[] | [JobJson, string]>;
    static finishedErrors(code: number, jobId: string, command: string): Error;
    static moveToCompleted(queue: QueueBase, job: Job, returnvalue: any, removeOnComplete: boolean | number, token: string, fetchNext: boolean): Promise<[JobJson, string] | []>;
    static moveToFailedArgs(queue: QueueBase, job: Job, failedReason: string, removeOnFailed: boolean | number, token: string, fetchNext?: boolean): string[];
    static isFinished(queue: QueueBase, jobId: string): Promise<any>;
    static moveToDelayedArgs(queue: QueueBase, jobId: string, timestamp: number): string[];
    static moveToDelayed(queue: QueueBase, jobId: string, timestamp: number): Promise<void>;
    static cleanJobsInSet(queue: QueueBase, set: string, timestamp: number, limit?: number): Promise<any>;
    static retryJobArgs(queue: QueueBase, job: Job): string[];
    /**
     * Attempts to reprocess a job
     *
     * @param {Job} job
     * @param {Object} options
     * @param {String} options.state The expected job state. If the job is not found
     * on the provided state, then it's not reprocessed. Supported states: 'failed', 'completed'
     *
     * @return {Promise<Number>} Returns a promise that evaluates to a return code:
     * 1 means the operation was a success
     * 0 means the job does not exist
     * -1 means the job is currently locked and can't be retried.
     * -2 means the job was not found in the expected set
     */
    static reprocessJob(queue: QueueBase, job: Job, state: 'failed' | 'completed'): Promise<any>;
    static moveToActive(worker: Worker, token: string, jobId?: string): Promise<[] | [JobJson, string]>;
    static updateDelaySet(queue: QueueBase, delayedTimestamp: number): Promise<any>;
    static promote(queue: QueueBase, jobId: string): Promise<any>;
    static moveStalledJobsToWait(queue: QueueScheduler): Promise<any>;
}
