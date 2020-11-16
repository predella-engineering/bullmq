import { QueueBase } from './queue-base';
import { Job } from './job';
export declare class QueueGetters extends QueueBase {
    getJob(jobId: string): Promise<Job | undefined>;
    private commandByType;
    /**
      Returns the number of jobs waiting to be processed.
    */
    count(): Promise<number>;
    getJobCountByTypes(...types: string[]): Promise<number>;
    /**
     * Returns the job counts for each type specified or every list/set in the queue by default.
     *
     */
    getJobCounts(...types: string[]): Promise<{
        [index: string]: number;
    }>;
    getCompletedCount(): Promise<number>;
    getFailedCount(): Promise<number>;
    getDelayedCount(): Promise<number>;
    getActiveCount(): Promise<number>;
    getWaitingCount(): Promise<number>;
    getWaiting(start?: number, end?: number): Promise<Job<any, any>[]>;
    getActive(start?: number, end?: number): Promise<Job<any, any>[]>;
    getDelayed(start?: number, end?: number): Promise<Job<any, any>[]>;
    getCompleted(start?: number, end?: number): Promise<Job<any, any>[]>;
    getFailed(start?: number, end?: number): Promise<Job<any, any>[]>;
    getRanges(types: string[], start?: number, end?: number, asc?: boolean): Promise<any[]>;
    getJobs(types: string[] | string, start?: number, end?: number, asc?: boolean): Promise<Job<any, any>[]>;
    getJobLogs(jobId: string, start?: number, end?: number): Promise<{
        logs: any;
        count: any;
    }>;
    getWorkers(): Promise<{
        [index: string]: string;
    }[]>;
    private parseClientList;
}
