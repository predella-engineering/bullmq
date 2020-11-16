import { JobsOptions, RepeatOptions } from '../interfaces';
import { Job, QueueBase } from './';
export declare class Repeat extends QueueBase {
    addNextRepeatableJob(name: string, data: any, opts: JobsOptions, skipCheckExists?: boolean): Promise<Job<any, any>>;
    private createNextJob;
    removeRepeatable(name: string, repeat: RepeatOptions, jobId?: string): Promise<any>;
    removeRepeatableByKey(repeatJobKey: string): Promise<any>;
    _keyToData(key: string): {
        key: string;
        name: string;
        id: string;
        endDate: number;
        tz: string;
        cron: string;
    };
    getRepeatableJobs(start?: number, end?: number, asc?: boolean): Promise<{
        key: string;
        name: string;
        id: string;
        endDate: number;
        tz: string;
        cron: string;
        next: number;
    }[]>;
    getRepeatableCount(): Promise<number>;
}
