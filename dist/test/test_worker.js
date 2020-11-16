"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const classes_1 = require("@src/classes");
const mocha_1 = require("mocha");
const chai_1 = require("chai");
const IORedis = require("ioredis");
const uuid_1 = require("uuid");
const utils_1 = require("@src/utils");
const lodash_1 = require("lodash");
const enums_1 = require("@src/enums");
const sinon = require("sinon");
mocha_1.describe('workers', function () {
    const sandbox = sinon.createSandbox();
    let queue;
    let queueEvents;
    let queueName;
    mocha_1.beforeEach(async function () {
        queueName = 'test-' + uuid_1.v4();
        queue = new classes_1.Queue(queueName);
        queueEvents = new classes_1.QueueEvents(queueName);
        await queueEvents.waitUntilReady();
    });
    afterEach(async function () {
        sandbox.restore();
        await queue.close();
        await queueEvents.close();
        await utils_1.removeAllQueueData(new IORedis(), queueName);
    });
    mocha_1.it('should get all workers for this queue', async function () {
        const worker = new classes_1.Worker(queueName, async (job) => { });
        await worker.waitUntilReady();
        const workers = await queue.getWorkers();
        chai_1.expect(workers).to.have.length(1);
        return worker.close();
    });
    mocha_1.describe('auto job removal', () => {
        mocha_1.it('should remove job after completed if removeOnComplete', async () => {
            const worker = new classes_1.Worker(queueName, async (job) => {
                chai_1.expect(job.data.foo).to.be.equal('bar');
            });
            await worker.waitUntilReady();
            const job = await queue.add('test', { foo: 'bar' }, { removeOnComplete: true });
            chai_1.expect(job.id).to.be.ok;
            chai_1.expect(job.data.foo).to.be.eql('bar');
            return new Promise((resolve, reject) => {
                worker.on('completed', async (job) => {
                    try {
                        const gotJob = await queue.getJob(job.id);
                        chai_1.expect(gotJob).to.be.equal(undefined);
                        const counts = await queue.getJobCounts('completed');
                        chai_1.expect(counts.completed).to.be.equal(0);
                        await worker.close();
                        resolve();
                    }
                    catch (err) {
                        reject(err);
                    }
                });
            });
        });
        mocha_1.it('should remove a job after completed if the default job options specify removeOnComplete', async () => {
            const newQueue = new classes_1.Queue(queueName, {
                defaultJobOptions: {
                    removeOnComplete: true,
                },
            });
            const worker = new classes_1.Worker(queueName, async (job) => {
                chai_1.expect(job.data.foo).to.be.equal('bar');
            });
            await worker.waitUntilReady();
            const job = await newQueue.add('test', { foo: 'bar' });
            chai_1.expect(job.id).to.be.ok;
            chai_1.expect(job.data.foo).to.be.eql('bar');
            return new Promise((resolve, reject) => {
                worker.on('completed', async (job) => {
                    try {
                        const gotJob = await newQueue.getJob(job.id);
                        chai_1.expect(gotJob).to.be.equal(undefined);
                        const counts = await newQueue.getJobCounts('completed');
                        chai_1.expect(counts.completed).to.be.equal(0);
                        await worker.close();
                        await newQueue.close();
                        resolve();
                    }
                    catch (err) {
                        reject(err);
                    }
                });
            });
        });
        mocha_1.it('should keep specified number of jobs after completed with removeOnComplete', async () => {
            const keepJobs = 3;
            const worker = new classes_1.Worker(queueName, async (job) => {
                await job.log('test log');
            });
            await worker.waitUntilReady();
            const datas = [0, 1, 2, 3, 4, 5, 6, 7, 8];
            const jobIds = await Promise.all(datas.map(async (data) => (await queue.add('test', data, { removeOnComplete: keepJobs })).id));
            return new Promise(resolve => {
                worker.on('completed', async (job) => {
                    if (job.data == 8) {
                        const counts = await queue.getJobCounts('completed');
                        chai_1.expect(counts.completed).to.be.equal(keepJobs);
                        await Promise.all(jobIds.map(async (jobId, index) => {
                            const job = await queue.getJob(jobId);
                            const logs = await queue.getJobLogs(jobId);
                            if (index >= datas.length - keepJobs) {
                                chai_1.expect(job).to.not.be.equal(undefined);
                                chai_1.expect(logs.logs).to.not.be.empty;
                            }
                            else {
                                chai_1.expect(job).to.be.equal(undefined);
                                chai_1.expect(logs.logs).to.be.empty;
                            }
                        }));
                        await worker.close();
                        resolve();
                    }
                });
            });
        });
        mocha_1.it('should keep specified number of jobs after completed with global removeOnComplete', async () => {
            const keepJobs = 3;
            const newQueue = new classes_1.Queue(queueName, {
                defaultJobOptions: {
                    removeOnComplete: keepJobs,
                },
            });
            const worker = new classes_1.Worker(queueName, async (job) => {
                await job.log('test log');
            });
            await worker.waitUntilReady();
            const datas = [0, 1, 2, 3, 4, 5, 6, 7, 8];
            const jobIds = await Promise.all(datas.map(async (data) => (await newQueue.add('test', data)).id));
            return new Promise((resolve, reject) => {
                worker.on('completed', async (job) => {
                    if (job.data == 8) {
                        try {
                            const counts = await newQueue.getJobCounts('completed');
                            chai_1.expect(counts.completed).to.be.equal(keepJobs);
                            await Promise.all(jobIds.map(async (jobId, index) => {
                                const job = await newQueue.getJob(jobId);
                                if (index >= datas.length - keepJobs) {
                                    chai_1.expect(job).to.not.be.equal(undefined);
                                }
                                else {
                                    chai_1.expect(job).to.be.equal(undefined);
                                }
                            }));
                        }
                        catch (err) {
                            reject(err);
                        }
                        finally {
                            await worker.close();
                            await newQueue.close();
                        }
                        resolve();
                    }
                });
            });
        });
        mocha_1.it('should remove job after failed if removeOnFail', async () => {
            const worker = new classes_1.Worker(queueName, async (job) => {
                await job.log('test log');
                throw Error('error');
            });
            await worker.waitUntilReady();
            const job = await queue.add('test', { foo: 'bar' }, { removeOnFail: true });
            chai_1.expect(job.id).to.be.ok;
            chai_1.expect(job.data.foo).to.be.eql('bar');
            return new Promise((resolve, reject) => {
                worker.on('failed', async (jobId) => {
                    await queue
                        .getJob(jobId)
                        .then(job => {
                        chai_1.expect(job).to.be.equal(undefined);
                        return null;
                    })
                        .then(() => {
                        return queue.getJobCounts('failed').then(counts => {
                            chai_1.expect(counts.failed).to.be.equal(0);
                            resolve();
                        });
                    });
                });
            });
        });
        mocha_1.it('should remove a job after fail if the default job options specify removeOnFail', async () => {
            const worker = new classes_1.Worker(queueName, async (job) => {
                chai_1.expect(job.data.foo).to.be.equal('bar');
                throw Error('error');
            });
            await worker.waitUntilReady();
            const newQueue = new classes_1.Queue(queueName, {
                defaultJobOptions: {
                    removeOnFail: true,
                },
            });
            const job = await newQueue.add('test', { foo: 'bar' });
            chai_1.expect(job.id).to.be.ok;
            chai_1.expect(job.data.foo).to.be.eql('bar');
            return new Promise((resolve, reject) => {
                worker.on('failed', async (jobId) => {
                    const job = await newQueue.getJob(jobId);
                    chai_1.expect(job).to.be.equal(undefined);
                    const counts = await newQueue.getJobCounts('completed');
                    chai_1.expect(counts.completed).to.be.equal(0);
                    await worker.close();
                    await newQueue.close();
                    resolve();
                });
            });
        });
        mocha_1.it('should keep specified number of jobs after completed with removeOnFail', async () => {
            const keepJobs = 3;
            const worker = new classes_1.Worker(queueName, async (job) => {
                throw Error('error');
            });
            await worker.waitUntilReady();
            const datas = [0, 1, 2, 3, 4, 5, 6, 7, 8];
            const jobIds = await Promise.all(datas.map(async (data) => (await queue.add('test', data, { removeOnFail: keepJobs })).id));
            return new Promise(resolve => {
                worker.on('failed', async (job) => {
                    if (job.data == 8) {
                        const counts = await queue.getJobCounts('failed');
                        chai_1.expect(counts.failed).to.be.equal(keepJobs);
                        await Promise.all(jobIds.map(async (jobId, index) => {
                            const job = await queue.getJob(jobId);
                            if (index >= datas.length - keepJobs) {
                                chai_1.expect(job).to.not.be.equal(undefined);
                            }
                            else {
                                chai_1.expect(job).to.be.equal(undefined);
                            }
                        }));
                        await worker.close();
                        resolve();
                    }
                });
            });
        });
        mocha_1.it('should keep specified number of jobs after completed with global removeOnFail', async () => {
            const keepJobs = 3;
            const worker = new classes_1.Worker(queueName, async (job) => {
                chai_1.expect(job.data.foo).to.be.equal('bar');
                throw Error('error');
            });
            await worker.waitUntilReady();
            const newQueue = new classes_1.Queue(queueName, {
                defaultJobOptions: {
                    removeOnFail: keepJobs,
                },
            });
            const datas = [0, 1, 2, 3, 4, 5, 6, 7, 8];
            const jobIds = await Promise.all(datas.map(async (data) => (await newQueue.add('test', data)).id));
            return new Promise((resolve, reject) => {
                worker.on('failed', async (job) => {
                    if (job.data == 8) {
                        try {
                            const counts = await newQueue.getJobCounts('failed');
                            chai_1.expect(counts.failed).to.be.equal(keepJobs);
                            await Promise.all(jobIds.map(async (jobId, index) => {
                                const job = await newQueue.getJob(jobId);
                                if (index >= datas.length - keepJobs) {
                                    chai_1.expect(job).to.not.be.equal(undefined);
                                }
                                else {
                                    chai_1.expect(job).to.be.equal(undefined);
                                }
                            }));
                        }
                        catch (err) {
                            reject(err);
                        }
                        await worker.close();
                        await newQueue.close();
                        resolve();
                    }
                });
            });
        });
    });
    mocha_1.it('process a lifo queue', async function () {
        this.timeout(3000);
        let currentValue = 0;
        let first = true;
        let processor;
        const processing = new Promise((resolve, reject) => {
            processor = async (job) => {
                try {
                    chai_1.expect(job.data.count).to.be.equal(currentValue--);
                }
                catch (err) {
                    reject(err);
                }
                if (first) {
                    first = false;
                }
                else if (currentValue === 0) {
                    resolve();
                }
            };
        });
        const worker = new classes_1.Worker(queueName, processor);
        await worker.waitUntilReady();
        await queue.pause();
        // Add a series of jobs in a predictable order
        const jobs = [
            { count: ++currentValue },
            { count: ++currentValue },
            { count: ++currentValue },
            { count: ++currentValue },
        ];
        await Promise.all(jobs.map(jobData => {
            return queue.add('test', jobData, { lifo: true });
        }));
        await queue.resume();
        await processing;
        await worker.close();
    });
    mocha_1.it('should processes jobs by priority', async () => {
        const normalPriority = [];
        const mediumPriority = [];
        const highPriority = [];
        let processor;
        // for the current strategy this number should not exceed 8 (2^2*2)
        // this is done to maitain a deterministic output.
        const numJobsPerPriority = 6;
        for (let i = 0; i < numJobsPerPriority; i++) {
            normalPriority.push(queue.add('test', { p: 2 }, { priority: 2 }));
            mediumPriority.push(queue.add('test', { p: 3 }, { priority: 3 }));
            highPriority.push(queue.add('test', { p: 1 }, { priority: 1 }));
        }
        let currentPriority = 1;
        let counter = 0;
        let total = 0;
        const processing = new Promise((resolve, reject) => {
            processor = async (job) => {
                try {
                    chai_1.expect(job.id).to.be.ok;
                    chai_1.expect(job.data.p).to.be.eql(currentPriority);
                }
                catch (err) {
                    reject(err);
                }
                total++;
                if (++counter === numJobsPerPriority) {
                    currentPriority++;
                    counter = 0;
                    if (currentPriority === 4 && total === numJobsPerPriority * 3) {
                        resolve();
                    }
                }
            };
        });
        const worker = new classes_1.Worker(queueName, processor);
        await worker.waitUntilReady();
        // wait for all jobs to enter the queue and then start processing
        await Promise.all([normalPriority, mediumPriority, highPriority]);
        await processing;
        await worker.close();
    });
    mocha_1.it('process several jobs serially', async () => {
        this.timeout(12000);
        let counter = 1;
        const maxJobs = 35;
        let processor;
        const processing = new Promise((resolve, reject) => {
            processor = async (job) => {
                try {
                    chai_1.expect(job.data.num).to.be.equal(counter);
                    chai_1.expect(job.data.foo).to.be.equal('bar');
                    if (counter === maxJobs) {
                        resolve();
                    }
                    counter++;
                }
                catch (err) {
                    reject(err);
                }
            };
        });
        const worker = new classes_1.Worker(queueName, processor);
        await worker.waitUntilReady();
        for (let i = 1; i <= maxJobs; i++) {
            await queue.add('test', { foo: 'bar', num: i });
        }
        await processing;
        await worker.close();
    });
    mocha_1.it('process a job that updates progress', async () => {
        let processor;
        const job = await queue.add('test', { foo: 'bar' });
        chai_1.expect(job.id).to.be.ok;
        chai_1.expect(job.data.foo).to.be.eql('bar');
        const processing = new Promise((resolve, reject) => {
            queueEvents.on('progress', args => {
                const { jobId, data } = args;
                chai_1.expect(jobId).to.be.ok;
                chai_1.expect(data).to.be.eql(42);
                resolve();
            });
            processor = async (job) => {
                try {
                    chai_1.expect(job.data.foo).to.be.equal('bar');
                    await job.updateProgress(42);
                }
                catch (err) {
                    reject(err);
                }
            };
        });
        const worker = new classes_1.Worker(queueName, processor);
        await worker.waitUntilReady();
        await processing;
        await worker.close();
    });
    mocha_1.it('processes jobs that were added before the worker started', async () => {
        const jobs = [
            queue.add('test', { bar: 'baz' }),
            queue.add('test', { bar1: 'baz1' }),
            queue.add('test', { bar2: 'baz2' }),
            queue.add('test', { bar3: 'baz3' }),
        ];
        await Promise.all(jobs);
        const worker = new classes_1.Worker(queueName, async (job) => { });
        await worker.waitUntilReady();
        await new Promise(resolve => {
            const resolveAfterAllJobs = lodash_1.after(jobs.length, resolve);
            worker.on('completed', resolveAfterAllJobs);
        });
        await worker.close();
    });
    mocha_1.it('process a job that returns data in the process handler', async () => {
        const worker = new classes_1.Worker(queueName, async (job) => {
            chai_1.expect(job.data.foo).to.be.equal('bar');
            return 37;
        });
        await worker.waitUntilReady();
        const job = await queue.add('test', { foo: 'bar' });
        chai_1.expect(job.id).to.be.ok;
        chai_1.expect(job.data.foo).to.be.eql('bar');
        await new Promise(async (resolve, reject) => {
            worker.on('completed', async (job, data) => {
                try {
                    chai_1.expect(job).to.be.ok;
                    chai_1.expect(data).to.be.eql(37);
                    const gotJob = await queue.getJob(job.id);
                    chai_1.expect(gotJob.returnvalue).to.be.eql(37);
                    resolve();
                }
                catch (err) {
                    reject(err);
                }
            });
        });
        await worker.close();
    });
    mocha_1.it('process a job that returns a string in the process handler', async () => {
        const testString = 'a very dignified string';
        const worker = new classes_1.Worker(queueName, async (job) => {
            return testString;
        });
        await worker.waitUntilReady();
        const waiting = new Promise(async (resolve, reject) => {
            queueEvents.on('completed', async (data /*, data*/) => {
                try {
                    chai_1.expect(data).to.be.ok;
                    chai_1.expect(data.returnvalue).to.be.equal(testString);
                    await utils_1.delay(100);
                    const gotJob = await queue.getJob(data.jobId);
                    chai_1.expect(gotJob).to.be.ok;
                    chai_1.expect(gotJob.returnvalue).to.be.equal(testString);
                    resolve();
                }
                catch (err) {
                    reject(err);
                }
            });
        });
        await queue.add('test', { testing: true });
        await waiting;
        await worker.close();
    });
    mocha_1.it('process a job that returning data returnvalue gets stored in the database', async () => {
        const worker = new classes_1.Worker(queueName, async (job) => {
            chai_1.expect(job.data.foo).to.be.equal('bar');
            return 37;
        });
        await worker.waitUntilReady();
        const job = await queue.add('test', { foo: 'bar' });
        chai_1.expect(job.id).to.be.ok;
        chai_1.expect(job.data.foo).to.be.eql('bar');
        await new Promise(async (resolve, reject) => {
            worker.on('completed', async (job, data) => {
                try {
                    chai_1.expect(job).to.be.ok;
                    chai_1.expect(data).to.be.eql(37);
                    const gotJob = await queue.getJob(job.id);
                    chai_1.expect(gotJob.returnvalue).to.be.eql(37);
                    const retval = await (await queue.client).hget(queue.toKey(gotJob.id), 'returnvalue');
                    chai_1.expect(JSON.parse(retval)).to.be.eql(37);
                    resolve();
                }
                catch (err) {
                    reject(err);
                }
            });
        });
        await worker.close();
    });
    mocha_1.it('process a job that does some asynchronous operation', async () => {
        const worker = new classes_1.Worker(queueName, async (job) => {
            chai_1.expect(job.data.foo).to.be.equal('bar');
            await utils_1.delay(250);
            return 'my data';
        });
        await worker.waitUntilReady();
        const job = await queue.add('test', { foo: 'bar' });
        chai_1.expect(job.id).to.be.ok;
        chai_1.expect(job.data.foo).to.be.eql('bar');
        await new Promise(async (resolve) => {
            worker.on('completed', (job, data) => {
                chai_1.expect(job).to.be.ok;
                chai_1.expect(data).to.be.eql('my data');
                resolve();
            });
        });
        await worker.close();
    });
    mocha_1.it('process a synchronous job', async () => {
        const worker = new classes_1.Worker(queueName, async (job) => {
            chai_1.expect(job.data.foo).to.be.equal('bar');
        });
        await worker.waitUntilReady();
        const job = await queue.add('test', { foo: 'bar' });
        chai_1.expect(job.id).to.be.ok;
        chai_1.expect(job.data.foo).to.be.eql('bar');
        await new Promise(resolve => {
            worker.on('completed', job => {
                chai_1.expect(job).to.be.ok;
                resolve();
            });
        });
        await worker.close();
    });
    mocha_1.it('does not process a job that is being processed when a new queue starts', async () => {
        this.timeout(12000);
        let err;
        const worker = new classes_1.Worker(queueName, async (job) => {
            chai_1.expect(job.data.foo).to.be.equal('bar');
            if (addedJob.id !== job.id) {
                err = new Error('Processed job id does not match that of added job');
            }
            await utils_1.delay(500);
        });
        await worker.waitUntilReady();
        const addedJob = await queue.add('test', { foo: 'bar' });
        const anotherWorker = new classes_1.Worker(queueName, async (job) => {
            err = new Error('The second queue should not have received a job to process');
        });
        worker.on('completed', async () => {
            await anotherWorker.close();
        });
        await worker.close();
        await anotherWorker.close();
        if (err) {
            throw err;
        }
    });
    mocha_1.it('process a job that throws an exception', async () => {
        const jobError = new Error('Job Failed');
        const worker = new classes_1.Worker(queueName, async (job) => {
            chai_1.expect(job.data.foo).to.be.equal('bar');
            throw jobError;
        });
        await worker.waitUntilReady();
        const job = await queue.add('test', { foo: 'bar' });
        chai_1.expect(job.id).to.be.ok;
        chai_1.expect(job.data.foo).to.be.eql('bar');
        await new Promise(resolve => {
            worker.once('failed', async (job, err) => {
                chai_1.expect(job).to.be.ok;
                chai_1.expect(job.data.foo).to.be.eql('bar');
                chai_1.expect(err).to.be.eql(jobError);
                resolve();
            });
        });
        await worker.close();
    });
    mocha_1.it('process a job that returns data with a circular dependency', async () => {
        const worker = new classes_1.Worker(queueName, async (job) => {
            const circular = { x: {} };
            circular.x = circular;
            return circular;
        });
        await worker.waitUntilReady();
        const waiting = new Promise((resolve, reject) => {
            worker.on('failed', () => {
                resolve();
            });
            worker.on('completed', () => {
                reject(Error('Should not complete'));
            });
        });
        await queue.add('test', { foo: 'bar' });
        await waiting;
        await worker.close();
    });
    mocha_1.it('process a job that returns a rejected promise', async () => {
        const jobError = new Error('Job Failed');
        const worker = new classes_1.Worker(queueName, async (job) => {
            chai_1.expect(job.data.foo).to.be.equal('bar');
            return Promise.reject(jobError);
        });
        await worker.waitUntilReady();
        const job = await queue.add('test', { foo: 'bar' });
        chai_1.expect(job.id).to.be.ok;
        chai_1.expect(job.data.foo).to.be.eql('bar');
        await new Promise((resolve, reject) => {
            worker.once('failed', (job, err) => {
                try {
                    chai_1.expect(job.id).to.be.ok;
                    chai_1.expect(job.data.foo).to.be.eql('bar');
                    chai_1.expect(err).to.be.eql(jobError);
                    resolve();
                }
                catch (err) {
                    reject(err);
                }
            });
        });
        await worker.close();
    });
    mocha_1.it('retry a job that fails', async () => {
        let failedOnce = false;
        const notEvenErr = new Error('Not even!');
        const worker = new classes_1.Worker(queueName, async (job) => {
            if (!failedOnce) {
                throw notEvenErr;
            }
        });
        await worker.waitUntilReady();
        const failing = new Promise((resolve, reject) => {
            worker.once('failed', async (job, err) => {
                try {
                    chai_1.expect(job).to.be.ok;
                    chai_1.expect(job.data.foo).to.be.eql('bar');
                    chai_1.expect(err).to.be.eql(notEvenErr);
                    failedOnce = true;
                }
                catch (err) {
                    reject(err);
                }
                resolve();
            });
        });
        const completing = new Promise((resolve, reject) => {
            worker.once('completed', () => {
                try {
                    chai_1.expect(failedOnce).to.be.eql(true);
                    resolve();
                }
                catch (err) {
                    reject(err);
                }
            });
        });
        const job = await queue.add('test', { foo: 'bar' });
        chai_1.expect(job.id).to.be.ok;
        chai_1.expect(job.data.foo).to.be.eql('bar');
        await failing;
        await job.retry();
        await completing;
        await worker.close();
    });
    mocha_1.it('retry a job that fails using job retry method', async () => {
        let called = 0;
        let failedOnce = false;
        const notEvenErr = new Error('Not even!');
        const worker = new classes_1.Worker(queueName, async (job) => {
            called++;
            if (called % 2 !== 0) {
                throw notEvenErr;
            }
        });
        await worker.waitUntilReady();
        const job = await queue.add('test', { foo: 'bar' });
        chai_1.expect(job.id).to.be.ok;
        chai_1.expect(job.data.foo).to.be.eql('bar');
        worker.once('failed', async (job, err) => {
            chai_1.expect(job).to.be.ok;
            chai_1.expect(job.data.foo).to.be.eql('bar');
            chai_1.expect(err).to.be.eql(notEvenErr);
            failedOnce = true;
            await worker.pause(true);
            await job.retry();
            chai_1.expect(job.failedReason).to.be.null;
            chai_1.expect(job.processedOn).to.be.null;
            chai_1.expect(job.finishedOn).to.be.null;
            const updatedJob = await queue.getJob(job.id);
            chai_1.expect(updatedJob.failedReason).to.be.undefined;
            chai_1.expect(updatedJob.processedOn).to.be.undefined;
            chai_1.expect(updatedJob.finishedOn).to.be.undefined;
            await worker.resume();
        });
        await new Promise(resolve => {
            worker.once('completed', () => {
                chai_1.expect(failedOnce).to.be.eql(true);
                resolve();
            });
        });
        await worker.close();
    });
    mocha_1.it('count added, unprocessed jobs', async () => {
        const maxJobs = 100;
        const added = [];
        for (let i = 1; i <= maxJobs; i++) {
            added.push(queue.add('test', { foo: 'bar', num: i }));
        }
        await Promise.all(added);
        const count = await queue.count();
        chai_1.expect(count).to.be.eql(maxJobs);
        await queue.drain();
        const countAfterEmpty = await queue.count();
        chai_1.expect(countAfterEmpty).to.be.eql(0);
    });
    mocha_1.it('emit error if lock is lost', async function () {
        this.timeout(10000);
        const worker = new classes_1.Worker(queueName, async (job) => {
            return utils_1.delay(2000);
        }, {
            lockDuration: 1000,
            lockRenewTime: 3000,
        });
        await worker.waitUntilReady();
        const queueScheduler = new classes_1.QueueScheduler(queueName, {
            stalledInterval: 100,
        });
        await queueScheduler.waitUntilReady();
        const job = await queue.add('test', { bar: 'baz' });
        const workerError = new Promise(resolve => {
            worker.on('error', resolve);
        });
        const error = await workerError;
        chai_1.expect(error).to.be.instanceOf(Error);
        chai_1.expect(error.message).to.be.eql(`Missing lock for job ${job.id} failed`);
        await worker.close();
        await queueScheduler.close();
    });
    mocha_1.it('continue processing after a worker has stalled', async function () {
        let first = true;
        this.timeout(10000);
        const worker = new classes_1.Worker(queueName, async (job) => {
            if (first) {
                first = false;
                return utils_1.delay(2000);
            }
        }, {
            lockDuration: 1000,
            lockRenewTime: 3000,
        });
        await worker.waitUntilReady();
        const queueScheduler = new classes_1.QueueScheduler(queueName, {
            stalledInterval: 100,
        });
        await queueScheduler.waitUntilReady();
        const job = await queue.add('test', { bar: 'baz' });
        const completed = new Promise(resolve => {
            worker.on('completed', resolve);
        });
        await completed;
        await worker.close();
        await queueScheduler.close();
    });
    mocha_1.it('stalled interval cannot be zero', function (done) {
        this.timeout(10000);
        let queueScheduler;
        try {
            queueScheduler = new classes_1.QueueScheduler(queueName, {
                stalledInterval: 0,
            });
            // Fail test if we reach here.
            done(new Error('Should throw an exception'));
        }
        catch (err) {
            done();
        }
    });
    mocha_1.describe('Concurrency process', () => {
        mocha_1.it('should run job in sequence if I specify a concurrency of 1', async () => {
            let processing = false;
            const worker = new classes_1.Worker(queueName, async (job) => {
                chai_1.expect(processing).to.be.equal(false);
                processing = true;
                await utils_1.delay(50);
                processing = false;
            }, {
                concurrency: 1,
            });
            await worker.waitUntilReady();
            await queue.add('test', {});
            await queue.add('test', {});
            await new Promise(resolve => {
                worker.on('completed', lodash_1.after(2, resolve));
            });
            await worker.close();
        });
        //This job use delay to check that at any time we have 4 process in parallel.
        //Due to time to get new jobs and call process, false negative can appear.
        mocha_1.it('should process job respecting the concurrency set', async function () {
            this.timeout(10000);
            let nbProcessing = 0;
            let pendingMessageToProcess = 8;
            let wait = 10;
            const worker = new classes_1.Worker(queueName, async (job) => {
                try {
                    nbProcessing++;
                    chai_1.expect(nbProcessing).to.be.lessThan(5);
                    wait += 100;
                    await utils_1.delay(wait);
                    //We should not have 4 more in parallel.
                    //At the end, due to empty list, no new job will process, so nbProcessing will decrease.
                    chai_1.expect(nbProcessing).to.be.eql(Math.min(pendingMessageToProcess, 4));
                    pendingMessageToProcess--;
                    nbProcessing--;
                }
                catch (err) {
                    console.error(err);
                }
            }, {
                concurrency: 4,
            });
            await worker.waitUntilReady();
            const waiting = new Promise((resolve, reject) => {
                worker.on('completed', lodash_1.after(8, resolve));
                worker.on('failed', reject);
            });
            await Promise.all(lodash_1.times(8, () => queue.add('test', {})));
            await waiting;
            await worker.close();
        });
        mocha_1.it('should wait for all concurrent processing in case of pause', async function () {
            this.timeout(10000);
            let i = 0;
            let nbJobFinish = 0;
            const worker = new classes_1.Worker(queueName, async (job) => {
                try {
                    if (++i === 4) {
                        // Pause when all 4 works are processing
                        await worker.pause();
                        // Wait for all the active jobs to finalize.
                        chai_1.expect(nbJobFinish).to.be.equal(3);
                        await worker.resume();
                    }
                }
                catch (err) {
                    console.error(err);
                }
                // 100 - i*20 is to force to finish job n°4 before lower jobs that will wait longer
                await utils_1.delay(100 - i * 10);
                nbJobFinish++;
                // We simulate an error of one processing job.
                if (i % 7 === 0) {
                    throw new Error();
                }
            }, {
                concurrency: 4,
            });
            await worker.waitUntilReady();
            const waiting = new Promise((resolve, reject) => {
                const cb = lodash_1.after(8, resolve);
                worker.on('completed', cb);
                worker.on('failed', cb);
                worker.on('error', reject);
            });
            await Promise.all(lodash_1.times(8, () => queue.add('test', {})));
            await waiting;
            await worker.close();
        });
    });
    mocha_1.describe('Retries and backoffs', () => {
        mocha_1.it('should not retry a job if it has been marked as unrecoverable', async () => {
            let tries = 0;
            const worker = new classes_1.Worker(queueName, async (job) => {
                tries++;
                chai_1.expect(tries).to.equal(1);
                job.discard();
                throw new Error('unrecoverable error');
            });
            await worker.waitUntilReady();
            await queue.add('test', { foo: 'bar' }, {
                attempts: 5,
            });
            await new Promise(resolve => {
                worker.on('failed', resolve);
            });
            await worker.close();
        });
        mocha_1.it('should automatically retry a failed job if attempts is bigger than 1', async () => {
            let tries = 0;
            const worker = new classes_1.Worker(queueName, async (job) => {
                chai_1.expect(job.attemptsMade).to.be.eql(tries);
                tries++;
                if (job.attemptsMade < 2) {
                    throw new Error('Not yet!');
                }
            });
            await worker.waitUntilReady();
            await queue.add('test', { foo: 'bar' }, {
                attempts: 3,
            });
            await new Promise(resolve => {
                worker.on('completed', resolve);
            });
            await worker.close();
        });
        mocha_1.it('should not retry a failed job more than the number of given attempts times', async () => {
            let tries = 0;
            const worker = new classes_1.Worker(queueName, async (job) => {
                tries++;
                if (job.attemptsMade < 3) {
                    throw new Error('Not yet!');
                }
                chai_1.expect(job.attemptsMade).to.be.eql(tries - 1);
            });
            await worker.waitUntilReady();
            await queue.add('test', { foo: 'bar' }, {
                attempts: 3,
            });
            await new Promise((resolve, reject) => {
                worker.on('completed', () => {
                    reject(new Error('Failed job was retried more than it should be!'));
                });
                worker.on('failed', () => {
                    if (tries === 3) {
                        resolve();
                    }
                });
            });
            await worker.close();
        });
        mocha_1.it('should retry a job after a delay if a fixed backoff is given', async function () {
            this.timeout(12000);
            const queueScheduler = new classes_1.QueueScheduler(queueName);
            await queueScheduler.waitUntilReady();
            let start;
            const worker = new classes_1.Worker(queueName, async (job) => {
                if (job.attemptsMade < 2) {
                    throw new Error('Not yet!');
                }
            });
            await worker.waitUntilReady();
            start = Date.now();
            await queue.add('test', { foo: 'bar' }, {
                attempts: 3,
                backoff: 1000,
            });
            await new Promise(resolve => {
                worker.on('completed', () => {
                    const elapse = Date.now() - start;
                    chai_1.expect(elapse).to.be.greaterThan(2000);
                    resolve();
                });
            });
            await worker.close();
            await queueScheduler.close();
        });
        mocha_1.it('should retry a job after a delay if an exponential backoff is given', async function () {
            this.timeout(12000);
            let start;
            const queueScheduler = new classes_1.QueueScheduler(queueName);
            await queueScheduler.waitUntilReady();
            const worker = new classes_1.Worker(queueName, async (job) => {
                if (job.attemptsMade < 2) {
                    throw new Error('Not yet!');
                }
            });
            await worker.waitUntilReady();
            start = Date.now();
            await queue.add('test', { foo: 'bar' }, {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 1000,
                },
            });
            await new Promise(resolve => {
                worker.on('completed', () => {
                    const elapse = Date.now() - start;
                    const expected = 1000 * (Math.pow(2, 2) - 1);
                    chai_1.expect(elapse).to.be.greaterThan(expected);
                    resolve();
                });
            });
            await worker.close();
            await queueScheduler.close();
        });
        mocha_1.it('should retry a job after a delay if a custom backoff is given', async function () {
            this.timeout(12000);
            const queueScheduler = new classes_1.QueueScheduler(queueName);
            await queueScheduler.waitUntilReady();
            let start;
            const worker = new classes_1.Worker(queueName, async (job) => {
                if (job.attemptsMade < 2) {
                    throw new Error('Not yet!');
                }
            }, {
                settings: {
                    backoffStrategies: {
                        custom(attemptsMade) {
                            return attemptsMade * 1000;
                        },
                    },
                },
            });
            await worker.waitUntilReady();
            start = Date.now();
            await queue.add('test', { foo: 'bar' }, {
                attempts: 3,
                backoff: {
                    type: 'custom',
                },
            });
            await new Promise(resolve => {
                worker.on('completed', () => {
                    const elapse = Date.now() - start;
                    chai_1.expect(elapse).to.be.greaterThan(3000);
                    resolve();
                });
            });
            await worker.close();
            await queueScheduler.close();
        });
        mocha_1.it('should not retry a job if the custom backoff returns -1', async () => {
            let tries = 0;
            const worker = new classes_1.Worker(queueName, async (job) => {
                tries++;
                if (job.attemptsMade < 3) {
                    throw new Error('Not yet!');
                }
            }, {
                settings: {
                    backoffStrategies: {
                        custom() {
                            return -1;
                        },
                    },
                },
            });
            await queue.add('test', { foo: 'bar' }, {
                attempts: 3,
                backoff: {
                    type: 'custom',
                },
            });
            await new Promise((resolve, reject) => {
                worker.on('completed', () => {
                    reject(new Error('Failed job was retried more than it should be!'));
                });
                worker.on('failed', () => {
                    if (tries === 1) {
                        resolve();
                    }
                });
            });
            await worker.close();
        });
        mocha_1.it('should retry a job after a delay if a custom backoff is given based on the error thrown', async function () {
            class CustomError extends Error {
            }
            this.timeout(12000);
            const queueScheduler = new classes_1.QueueScheduler(queueName);
            await queueScheduler.waitUntilReady();
            const worker = new classes_1.Worker(queueName, async (job) => {
                if (job.attemptsMade < 2) {
                    throw new CustomError('Hey, custom error!');
                }
            }, {
                settings: {
                    backoffStrategies: {
                        custom(attemptsMade, err) {
                            if (err instanceof CustomError) {
                                return 1500;
                            }
                            return 500;
                        },
                    },
                },
            });
            const start = Date.now();
            await queue.add('test', { foo: 'bar' }, {
                attempts: 3,
                backoff: {
                    type: 'custom',
                },
            });
            await new Promise(resolve => {
                worker.on('completed', () => {
                    const elapse = Date.now() - start;
                    chai_1.expect(elapse).to.be.greaterThan(3000);
                    resolve();
                });
            });
            await worker.close();
            await queueScheduler.close();
        });
        mocha_1.it('should be able to handle a custom backoff if it returns a promise', async function () {
            this.timeout(12000);
            const queueScheduler = new classes_1.QueueScheduler(queueName);
            await queueScheduler.waitUntilReady();
            const worker = new classes_1.Worker(queueName, async (job) => {
                if (job.attemptsMade < 2) {
                    throw new Error('some error');
                }
            }, {
                settings: {
                    backoffStrategies: {
                        async custom() {
                            return utils_1.delay(500);
                        },
                    },
                },
            });
            const start = Date.now();
            await queue.add('test', { foo: 'bar' }, {
                attempts: 3,
                backoff: {
                    type: 'custom',
                },
            });
            await new Promise(resolve => {
                worker.on('completed', () => {
                    const elapse = Date.now() - start;
                    chai_1.expect(elapse).to.be.greaterThan(1000);
                    resolve();
                });
            });
            await worker.close();
        });
        mocha_1.it('should not retry a job that has been removed', async () => {
            const queueScheduler = new classes_1.QueueScheduler(queueName);
            await queueScheduler.waitUntilReady();
            const worker = new classes_1.Worker(queueName, async (job) => {
                if (attempts === 0) {
                    attempts++;
                    throw failedError;
                }
            });
            await worker.waitUntilReady();
            let attempts = 0;
            const failedError = new Error('failed');
            await queue.add('test', { foo: 'bar' });
            await new Promise((resolve, reject) => {
                const failedHandler = lodash_1.once(async (job, err) => {
                    chai_1.expect(job.data.foo).to.equal('bar');
                    chai_1.expect(err).to.equal(failedError);
                    chai_1.expect(job.failedReason).to.equal(failedError.message);
                    try {
                        await job.retry();
                        await utils_1.delay(100);
                        const count = await queue.getCompletedCount();
                        chai_1.expect(count).to.equal(1);
                        await queue.clean(0, 0);
                        try {
                            await job.retry();
                        }
                        catch (err) {
                            // expect(err.message).to.equal(RetryErrors.JobNotExist);
                            chai_1.expect(err.message).to.equal('Retried job not exist');
                        }
                        const completedCount = await queue.getCompletedCount();
                        chai_1.expect(completedCount).to.equal(0);
                        const failedCount = await queue.getFailedCount();
                        chai_1.expect(failedCount).to.equal(0);
                    }
                    catch (err) {
                        reject(err);
                    }
                    resolve();
                });
                worker.on('failed', failedHandler);
            });
            await worker.close();
            await queueScheduler.close();
        }).timeout(5000);
        mocha_1.it.skip('should not retry a job that has been retried already', async () => {
            let attempts = 0;
            const queueScheduler = new classes_1.QueueScheduler(queueName);
            await queueScheduler.waitUntilReady();
            const worker = new classes_1.Worker(queueName, async (job) => {
                if (attempts === 0) {
                    attempts++;
                    throw failedError;
                }
            });
            await worker.waitUntilReady();
            await queue.add('test', { foo: 'bar' });
            const failedError = new Error('failed');
            await new Promise((resolve, reject) => {
                const failedHandler = lodash_1.once(async (job, err) => {
                    chai_1.expect(job.data.foo).to.equal('bar');
                    chai_1.expect(err).to.equal(failedError);
                    await job.retry();
                    await utils_1.delay(100);
                    const completedCount = await queue.getCompletedCount();
                    chai_1.expect(completedCount).to.equal(1);
                    try {
                        await job.retry();
                    }
                    catch (err) {
                        chai_1.expect(err).to.be.equal(enums_1.RetryErrors.JobNotExist);
                    }
                    const completedCount2 = await queue.getCompletedCount();
                    chai_1.expect(completedCount2).to.equal(1);
                    const failedCount = await queue.getFailedCount();
                    chai_1.expect(failedCount).to.equal(0);
                    resolve();
                });
                worker.on('failed', failedHandler);
            });
            await worker.close();
            await queueScheduler.close();
        });
        mocha_1.it('should not retry a job that is active', async () => {
            const worker = new classes_1.Worker(queueName, async (job) => {
                await utils_1.delay(500);
            });
            await worker.waitUntilReady();
            const activating = new Promise(resolve => {
                worker.on('active', resolve);
            });
            const job = await queue.add('test', { foo: 'bar' });
            chai_1.expect(job.data.foo).to.equal('bar');
            await activating;
            try {
                await job.retry();
            }
            catch (err) {
                chai_1.expect(err.message).to.equal('Retried job not failed');
            }
            await worker.close();
        });
        /*
        it('an unlocked job should not be moved to failed', done => {
          queue = utils.buildQueue('test unlocked failed');
    
          queue.process((job, callback) => {
            // Release the lock to simulate the event loop stalling (so failure to renew the lock).
            job.releaseLock().then(() => {
              // Once it's failed, it should NOT be moved to failed since this worker lost the lock.
              callback(new Error('retry this job'));
            });
          });
    
          queue.on('failed', job => {
            job.isFailed().then(isFailed => {
              expect(isFailed).to.be.equal(false);
            });
          });
    
          queue.on('error', (err) => {
            queue.close().then(done, done);
          });
    
          // Note that backoff:0 should immediately retry the job upon failure (ie put it in 'waiting')
          queue.add({ foo: 'bar' }, { backoff: 0, attempts: 2 });
        });
        */
    });
});
//# sourceMappingURL=test_worker.js.map