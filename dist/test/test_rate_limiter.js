"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const classes_1 = require("@src/classes");
const queue_events_1 = require("@src/classes/queue-events");
const queue_scheduler_1 = require("@src/classes/queue-scheduler");
const worker_1 = require("@src/classes/worker");
const chai_1 = require("chai");
const IORedis = require("ioredis");
const lodash_1 = require("lodash");
const mocha_1 = require("mocha");
const uuid_1 = require("uuid");
const utils_1 = require("@src/utils");
mocha_1.describe('Rate Limiter', function () {
    let queue;
    let queueName;
    let queueEvents;
    mocha_1.beforeEach(async function () {
        queueName = 'test-' + uuid_1.v4();
        queue = new classes_1.Queue(queueName);
        queueEvents = new queue_events_1.QueueEvents(queueName);
        await queueEvents.waitUntilReady();
    });
    afterEach(async function () {
        await queue.close();
        await queueEvents.close();
        await utils_1.removeAllQueueData(new IORedis(), queueName);
    });
    mocha_1.it('should put a job into the delayed queue when limit is hit', async () => {
        const worker = new worker_1.Worker(queueName, async (job) => { }, {
            limiter: {
                max: 1,
                duration: 1000,
            },
        });
        await worker.waitUntilReady();
        queueEvents.on('failed', ({ failedReason }) => {
            chai_1.assert.fail(failedReason);
        });
        await Promise.all([
            queue.add('test', {}),
            queue.add('test', {}),
            queue.add('test', {}),
            queue.add('test', {}),
        ]);
        await Promise.all([
            worker.getNextJob('test-token'),
            worker.getNextJob('test-token'),
            worker.getNextJob('test-token'),
            worker.getNextJob('test-token'),
        ]);
        const delayedCount = await queue.getDelayedCount();
        chai_1.expect(delayedCount).to.eq(3);
    });
    mocha_1.it('should obey the rate limit', async function () {
        this.timeout(20000);
        const numJobs = 4;
        const startTime = new Date().getTime();
        const queueScheduler = new queue_scheduler_1.QueueScheduler(queueName);
        await queueScheduler.waitUntilReady();
        const worker = new worker_1.Worker(queueName, async (job) => { }, {
            limiter: {
                max: 1,
                duration: 1000,
            },
        });
        const result = new Promise((resolve, reject) => {
            queueEvents.on('completed', 
            // after every job has been completed
            lodash_1.after(numJobs, async () => {
                await worker.close();
                try {
                    const timeDiff = new Date().getTime() - startTime;
                    chai_1.expect(timeDiff).to.be.gte((numJobs - 1) * 1000);
                    resolve();
                }
                catch (err) {
                    reject(err);
                }
            }));
            queueEvents.on('failed', async (err) => {
                await worker.close();
                reject(err);
            });
        });
        for (let i = 0; i < numJobs; i++) {
            await queue.add('rate test', {});
        }
        await result;
        await worker.close();
        await queueScheduler.close();
    });
    mocha_1.it('should rate limit by grouping', async function () {
        this.timeout(20000);
        const numGroups = 4;
        const numJobs = 20;
        const startTime = Date.now();
        const queueScheduler = new queue_scheduler_1.QueueScheduler(queueName);
        await queueScheduler.waitUntilReady();
        const rateLimitedQueue = new classes_1.Queue(queueName, {
            limiter: {
                groupKey: 'accountId',
            },
        });
        const worker = new worker_1.Worker(queueName, async (job) => { }, {
            limiter: {
                max: 1,
                duration: 1000,
                groupKey: 'accountId',
            },
        });
        const completed = {};
        const running = new Promise((resolve, reject) => {
            const afterJobs = lodash_1.after(numJobs, () => {
                try {
                    const timeDiff = Date.now() - startTime;
                    // In some test envs, these timestamps can drift.
                    chai_1.expect(timeDiff).to.be.gte(numGroups * 990);
                    chai_1.expect(timeDiff).to.be.below((numGroups + 1) * 1100);
                    for (const group in completed) {
                        let prevTime = completed[group][0];
                        for (let i = 1; i < completed[group].length; i++) {
                            const diff = completed[group][i] - prevTime;
                            chai_1.expect(diff).to.be.below(2000);
                            chai_1.expect(diff).to.be.gte(990);
                            prevTime = completed[group][i];
                        }
                    }
                    resolve();
                }
                catch (err) {
                    reject(err);
                }
            });
            queueEvents.on('completed', ({ jobId }) => {
                const group = lodash_1.last(jobId.split(':'));
                completed[group] = completed[group] || [];
                completed[group].push(Date.now());
                afterJobs();
            });
            queueEvents.on('failed', async (err) => {
                await worker.close();
                reject(err);
            });
        });
        for (let i = 0; i < numJobs; i++) {
            await rateLimitedQueue.add('rate test', { accountId: i % numGroups });
        }
        await running;
        await rateLimitedQueue.close();
        await worker.close();
        await queueScheduler.close();
    });
    mocha_1.it.skip('should obey priority', async function () {
        this.timeout(20000);
        const numJobs = 10;
        const priorityBuckets = {
            '1': 0,
            '2': 0,
            '3': 0,
            '4': 0,
        };
        await queue.pause();
        for (let i = 0; i < numJobs; i++) {
            const priority = (i % 4) + 1;
            const opts = { priority };
            priorityBuckets[priority] = priorityBuckets[priority] + 1;
            await queue.add('priority test', { id: i }, opts);
        }
        const priorityBucketsBefore = Object.assign({}, priorityBuckets);
        const queueScheduler = new queue_scheduler_1.QueueScheduler(queueName);
        await queueScheduler.waitUntilReady();
        const worker = new worker_1.Worker(queueName, async (job) => {
            const { priority } = job.opts;
            priorityBuckets[priority] = priorityBuckets[priority] - 1;
            for (let p = 1; p < priority; p++) {
                if (priorityBuckets[p] > 0) {
                    const before = JSON.stringify(priorityBucketsBefore);
                    const after = JSON.stringify(priorityBuckets);
                    throw new Error(`Priority was not enforced, job with priority ${priority} was processed before all jobs with priority ${p}
              were processed. Bucket counts before: ${before} / after: ${after}`);
                }
            }
            return Promise.resolve();
        }, {
            limiter: {
                max: 1,
                duration: 10,
            },
        });
        await worker.waitUntilReady();
        await queue.resume();
        const result = new Promise((resolve, reject) => {
            queueEvents.on('failed', async (err) => {
                await worker.close();
                reject(err);
            });
            queueEvents.on('completed', lodash_1.after(numJobs, () => {
                try {
                    chai_1.expect(lodash_1.every(priorityBuckets, value => value === 0)).to.eq(true);
                    resolve();
                }
                catch (err) {
                    reject(err);
                }
            }));
        });
        await result;
        await worker.close();
        await queueScheduler.close();
    });
});
//# sourceMappingURL=test_rate_limiter.js.map