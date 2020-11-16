/*eslint-env node */
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const classes_1 = require("@src/classes");
const queue_events_1 = require("@src/classes/queue-events");
const worker_1 = require("@src/classes/worker");
const utils_1 = require("@src/utils");
const chai_1 = require("chai");
const IORedis = require("ioredis");
const lodash_1 = require("lodash");
const mocha_1 = require("mocha");
const uuid_1 = require("uuid");
mocha_1.describe('Job', function () {
    let queue;
    let queueName;
    mocha_1.beforeEach(async function () {
        queueName = 'test-' + uuid_1.v4();
        queue = new classes_1.Queue(queueName);
    });
    mocha_1.afterEach(async () => {
        await queue.close();
        await utils_1.removeAllQueueData(new IORedis(), queueName);
    });
    mocha_1.describe('.create', function () {
        const timestamp = 1234567890;
        let job;
        let data;
        let opts;
        mocha_1.beforeEach(async function () {
            data = { foo: 'bar' };
            opts = { timestamp };
            const createdJob = await classes_1.Job.create(queue, 'test', data, opts);
            job = createdJob;
        });
        mocha_1.it('saves the job in redis', async function () {
            const storedJob = await classes_1.Job.fromId(queue, job.id);
            chai_1.expect(storedJob).to.have.property('id');
            chai_1.expect(storedJob).to.have.property('data');
            chai_1.expect(storedJob.data.foo).to.be.equal('bar');
            chai_1.expect(storedJob.opts).to.be.an('object');
            chai_1.expect(storedJob.opts.timestamp).to.be.equal(timestamp);
        });
        mocha_1.it('should use the custom jobId if one is provided', async function () {
            const customJobId = 'customjob';
            const createdJob = await classes_1.Job.create(queue, 'test', data, {
                jobId: customJobId,
            });
            chai_1.expect(createdJob.id).to.be.equal(customJobId);
        });
    });
    mocha_1.describe('JSON.stringify', () => {
        mocha_1.it('retains property types', async () => {
            const data = { foo: 'bar' };
            const job = await classes_1.Job.create(queue, 'test', data);
            job.returnvalue = 1;
            job.progress = 20;
            const json = JSON.stringify(job);
            const parsed = JSON.parse(json);
            chai_1.expect(parsed).to.have.deep.property('data', data);
            chai_1.expect(parsed).to.have.property('name', 'test');
            chai_1.expect(parsed).to.have.property('returnvalue', 1);
            chai_1.expect(parsed).to.have.property('progress', 20);
        });
        mocha_1.it('omits the queue property to avoid a circular json error on node 8', async () => {
            const data = { foo: 'bar' };
            const job = await classes_1.Job.create(queue, 'test', data);
            const json = JSON.stringify(job);
            const parsed = JSON.parse(json);
            chai_1.expect(parsed).not.to.have.property('queue');
        });
    });
    mocha_1.describe('.update', function () {
        mocha_1.it('should allow updating job data', async function () {
            const job = await classes_1.Job.create(queue, 'test', { foo: 'bar' });
            await job.update({ baz: 'qux' });
            const updatedJob = await classes_1.Job.fromId(queue, job.id);
            chai_1.expect(updatedJob.data).to.be.eql({ baz: 'qux' });
        });
    });
    mocha_1.describe('.remove', function () {
        mocha_1.it('removes the job from redis', async function () {
            const job = await classes_1.Job.create(queue, 'test', { foo: 'bar' });
            await job.remove();
            const storedJob = await classes_1.Job.fromId(queue, job.id);
            chai_1.expect(storedJob).to.be.equal(undefined);
        });
    });
    mocha_1.describe('.progress', function () {
        mocha_1.it('can set and get progress as number', async function () {
            const job = await classes_1.Job.create(queue, 'test', { foo: 'bar' });
            await job.updateProgress(42);
            const storedJob = await classes_1.Job.fromId(queue, job.id);
            chai_1.expect(storedJob.progress).to.be.equal(42);
        });
        mocha_1.it('can set and get progress as object', async function () {
            const job = await classes_1.Job.create(queue, 'test', { foo: 'bar' });
            await job.updateProgress({ total: 120, completed: 40 });
            const storedJob = await classes_1.Job.fromId(queue, job.id);
            chai_1.expect(storedJob.progress).to.eql({ total: 120, completed: 40 });
        });
    });
    mocha_1.describe('.log', () => {
        mocha_1.it('can log two rows with text', async () => {
            const firstLog = 'some log text 1';
            const secondLog = 'some log text 2';
            const job = await classes_1.Job.create(queue, 'test', { foo: 'bar' });
            await job.log(firstLog);
            await job.log(secondLog);
            const logs = await queue.getJobLogs(job.id);
            chai_1.expect(logs).to.be.eql({ logs: [firstLog, secondLog], count: 2 });
            await job.remove();
            const logsRemoved = await queue.getJobLogs(job.id);
            chai_1.expect(logsRemoved).to.be.eql({ logs: [], count: 0 });
        });
    });
    mocha_1.describe('.moveToCompleted', function () {
        mocha_1.it('marks the job as completed and returns new job', async function () {
            const job1 = await classes_1.Job.create(queue, 'test', { foo: 'bar' });
            const job2 = await classes_1.Job.create(queue, 'test', { baz: 'qux' });
            const isCompleted = await job2.isCompleted();
            chai_1.expect(isCompleted).to.be.equal(false);
            const job1Id = await job2.moveToCompleted('succeeded', '0', true);
            const isJob2Completed = await job2.isCompleted();
            chai_1.expect(isJob2Completed).to.be.equal(true);
            chai_1.expect(job2.returnvalue).to.be.equal('succeeded');
            chai_1.expect(job1Id[1]).to.be.equal(job1.id);
        });
        /**
         * Verify moveToFinished use default value for opts.maxLenEvents
         * if it does not exist in meta key (or entire meta key is missing).
         */
        mocha_1.it('should not fail if queue meta key is missing', async function () {
            const job = await queue.add('test', { color: 'red' });
            const client = await queue.client;
            await client.del(queue.toKey('meta'));
            await job.moveToCompleted('done', '0', false);
        });
    });
    mocha_1.describe('.moveToFailed', function () {
        mocha_1.it('marks the job as failed', async function () {
            const job = await classes_1.Job.create(queue, 'test', { foo: 'bar' });
            const isFailed = await job.isFailed();
            chai_1.expect(isFailed).to.be.equal(false);
            await job.moveToFailed(new Error('test error'), '0', true);
            const isFailed2 = await job.isFailed();
            chai_1.expect(isFailed2).to.be.equal(true);
            chai_1.expect(job.stacktrace).not.be.equal(null);
            chai_1.expect(job.stacktrace.length).to.be.equal(1);
        });
        mocha_1.it('moves the job to wait for retry if attempts are given', async function () {
            const queueEvents = new queue_events_1.QueueEvents(queueName);
            await queueEvents.waitUntilReady();
            const job = await classes_1.Job.create(queue, 'test', { foo: 'bar' }, { attempts: 3 });
            const isFailed = await job.isFailed();
            chai_1.expect(isFailed).to.be.equal(false);
            const waiting = new Promise(resolve => {
                queueEvents.on('waiting', resolve);
            });
            await job.moveToFailed(new Error('test error'), '0', true);
            await waiting;
            const isFailed2 = await job.isFailed();
            chai_1.expect(isFailed2).to.be.equal(false);
            chai_1.expect(job.stacktrace).not.be.equal(null);
            chai_1.expect(job.stacktrace.length).to.be.equal(1);
            const isWaiting = await job.isWaiting();
            chai_1.expect(isWaiting).to.be.equal(true);
            await queueEvents.close();
        });
        mocha_1.it('marks the job as failed when attempts made equal to attempts given', async function () {
            const job = await classes_1.Job.create(queue, 'test', { foo: 'bar' }, { attempts: 1 });
            const isFailed = await job.isFailed();
            chai_1.expect(isFailed).to.be.equal(false);
            await job.moveToFailed(new Error('test error'), '0', true);
            const isFailed2 = await job.isFailed();
            chai_1.expect(isFailed2).to.be.equal(true);
            chai_1.expect(job.stacktrace).not.be.equal(null);
            chai_1.expect(job.stacktrace.length).to.be.equal(1);
        });
        mocha_1.it('moves the job to delayed for retry if attempts are given and backoff is non zero', async function () {
            const job = await classes_1.Job.create(queue, 'test', { foo: 'bar' }, { attempts: 3, backoff: 300 });
            const isFailed = await job.isFailed();
            chai_1.expect(isFailed).to.be.equal(false);
            await job.moveToFailed(new Error('test error'), '0', true);
            const isFailed2 = await job.isFailed();
            chai_1.expect(isFailed2).to.be.equal(false);
            chai_1.expect(job.stacktrace).not.be.equal(null);
            chai_1.expect(job.stacktrace.length).to.be.equal(1);
            const isDelayed = await job.isDelayed();
            chai_1.expect(isDelayed).to.be.equal(true);
        });
        mocha_1.it('applies stacktrace limit on failure', async function () {
            const stackTraceLimit = 1;
            const job = await classes_1.Job.create(queue, 'test', { foo: 'bar' }, { stackTraceLimit: stackTraceLimit });
            const isFailed = await job.isFailed();
            chai_1.expect(isFailed).to.be.equal(false);
            await job.moveToFailed(new Error('test error'), '0', true);
            const isFailed2 = await job.isFailed();
            chai_1.expect(isFailed2).to.be.equal(true);
            chai_1.expect(job.stacktrace).not.be.equal(null);
            chai_1.expect(job.stacktrace.length).to.be.equal(stackTraceLimit);
        });
        mocha_1.it('saves error stacktrace', async function () {
            const job = await classes_1.Job.create(queue, 'test', { foo: 'bar' });
            const id = job.id;
            await job.moveToFailed(new Error('test error'), '0');
            const sameJob = await queue.getJob(id);
            chai_1.expect(sameJob).to.be.ok;
            chai_1.expect(sameJob.stacktrace).to.be.not.empty;
        });
    });
    mocha_1.describe('.promote', () => {
        mocha_1.it('can promote a delayed job to be executed immediately', async () => {
            const job = await classes_1.Job.create(queue, 'test', { foo: 'bar' }, { delay: 1500 });
            const isDelayed = await job.isDelayed();
            chai_1.expect(isDelayed).to.be.equal(true);
            await job.promote();
            const isDelayedAfterPromote = await job.isDelayed();
            chai_1.expect(isDelayedAfterPromote).to.be.equal(false);
            const isWaiting = await job.isWaiting();
            chai_1.expect(isWaiting).to.be.equal(true);
        });
        mocha_1.it('should process a promoted job according to its priority', async function () {
            const queueScheduler = new classes_1.QueueScheduler(queueName);
            await queueScheduler.waitUntilReady();
            this.timeout(10000);
            const worker = new worker_1.Worker(queueName, job => {
                return utils_1.delay(100);
            });
            await worker.waitUntilReady();
            const completed = [];
            const done = new Promise(resolve => {
                worker.on('completed', job => {
                    completed.push(job.id);
                    if (completed.length > 3) {
                        chai_1.expect(completed).to.be.eql(['1', '2', '3', '4']);
                        resolve();
                    }
                });
            });
            const processStarted = new Promise(resolve => worker.on('active', lodash_1.after(2, resolve)));
            const add = (jobId, ms = 0) => queue.add('test', {}, { jobId, delay: ms, priority: 1 });
            await add('1');
            await add('2', 1);
            await processStarted;
            const job = await add('3', 2000);
            await job.promote();
            await add('4', 1);
            await done;
            await queueScheduler.close();
        });
        mocha_1.it('should not promote a job that is not delayed', async () => {
            const job = await classes_1.Job.create(queue, 'test', { foo: 'bar' });
            const isDelayed = await job.isDelayed();
            chai_1.expect(isDelayed).to.be.equal(false);
            try {
                await job.promote();
                throw new Error('Job should not be promoted!');
            }
            catch (err) { }
        });
    });
    // TODO:
    // Divide into several tests
    //
    /*
    const scripts = require('../lib/scripts');
    it('get job status', function() {
      this.timeout(12000);
  
      const client = new redis();
      return Job.create(queue, { foo: 'baz' })
        .then(job => {
          return job
            .isStuck()
            .then(isStuck => {
              expect(isStuck).to.be(false);
              return job.getState();
            })
            .then(state => {
              expect(state).to.be('waiting');
              return scripts.moveToActive(queue).then(() => {
                return job.moveToCompleted();
              });
            })
            .then(() => {
              return job.isCompleted();
            })
            .then(isCompleted => {
              expect(isCompleted).to.be(true);
              return job.getState();
            })
            .then(state => {
              expect(state).to.be('completed');
              return client.zrem(queue.toKey('completed'), job.id);
            })
            .then(() => {
              return job.moveToDelayed(Date.now() + 10000, true);
            })
            .then(() => {
              return job.isDelayed();
            })
            .then(yes => {
              expect(yes).to.be(true);
              return job.getState();
            })
            .then(state => {
              expect(state).to.be('delayed');
              return client.zrem(queue.toKey('delayed'), job.id);
            })
            .then(() => {
              return job.moveToFailed(new Error('test'), true);
            })
            .then(() => {
              return job.isFailed();
            })
            .then(isFailed => {
              expect(isFailed).to.be(true);
              return job.getState();
            })
            .then(state => {
              expect(state).to.be('failed');
              return client.zrem(queue.toKey('failed'), job.id);
            })
            .then(res => {
              expect(res).to.be(1);
              return job.getState();
            })
            .then(state => {
              expect(state).to.be('stuck');
              return client.rpop(queue.toKey('wait'));
            })
            .then(() => {
              return client.lpush(queue.toKey('paused'), job.id);
            })
            .then(() => {
              return job.isPaused();
            })
            .then(isPaused => {
              expect(isPaused).to.be(true);
              return job.getState();
            })
            .then(state => {
              expect(state).to.be('paused');
              return client.rpop(queue.toKey('paused'));
            })
            .then(() => {
              return client.lpush(queue.toKey('wait'), job.id);
            })
            .then(() => {
              return job.isWaiting();
            })
            .then(isWaiting => {
              expect(isWaiting).to.be(true);
              return job.getState();
            })
            .then(state => {
              expect(state).to.be('waiting');
            });
        })
        .then(() => {
          return client.quit();
        });
    });
    */
    mocha_1.describe('.finished', function () {
        let queueEvents;
        mocha_1.beforeEach(async function () {
            queueEvents = new queue_events_1.QueueEvents(queueName);
            await queueEvents.waitUntilReady();
        });
        mocha_1.afterEach(async function () {
            await queueEvents.close();
        });
        mocha_1.it('should resolve when the job has been completed', async function () {
            const worker = new worker_1.Worker(queueName, async (job) => 'qux');
            const job = await queue.add('test', { foo: 'bar' });
            const result = await job.waitUntilFinished(queueEvents);
            chai_1.expect(result).to.be.equal('qux');
            await worker.close();
        });
        mocha_1.it('should resolve when the job has been completed and return object', async function () {
            const worker = new worker_1.Worker(queueName, async (job) => ({ resultFoo: 'bar' }));
            const job = await queue.add('test', { foo: 'bar' });
            const result = await job.waitUntilFinished(queueEvents);
            chai_1.expect(result).to.be.an('object');
            chai_1.expect(result.resultFoo).equal('bar');
            await worker.close();
        });
        mocha_1.it('should resolve when the job has been delayed and completed and return object', async function () {
            const worker = new worker_1.Worker(queueName, async (job) => {
                await utils_1.delay(300);
                return { resultFoo: 'bar' };
            });
            const job = await queue.add('test', { foo: 'bar' });
            await utils_1.delay(600);
            const result = await job.waitUntilFinished(queueEvents);
            chai_1.expect(result).to.be.an('object');
            chai_1.expect(result.resultFoo).equal('bar');
            await worker.close();
        });
        mocha_1.it('should resolve when the job has been completed and return string', async function () {
            const worker = new worker_1.Worker(queueName, async (job) => 'a string');
            const job = await queue.add('test', { foo: 'bar' });
            const result = await job.waitUntilFinished(queueEvents);
            chai_1.expect(result).to.be.an('string');
            chai_1.expect(result).equal('a string');
            await worker.close();
        });
        mocha_1.it('should reject when the job has been failed', async function () {
            const worker = new worker_1.Worker(queueName, async (job) => {
                await utils_1.delay(500);
                throw new Error('test error');
            });
            const job = await queue.add('test', { foo: 'bar' });
            try {
                await job.waitUntilFinished(queueEvents);
                throw new Error('should have been rejected');
            }
            catch (err) {
                chai_1.expect(err.message).equal('test error');
            }
            await worker.close();
        });
        mocha_1.it('should resolve directly if already processed', async function () {
            const worker = new worker_1.Worker(queueName, async (job) => ({ resultFoo: 'bar' }));
            const job = await queue.add('test', { foo: 'bar' });
            await utils_1.delay(500);
            const result = await job.waitUntilFinished(queueEvents);
            chai_1.expect(result).to.be.an('object');
            chai_1.expect(result.resultFoo).equal('bar');
            await worker.close();
        });
        mocha_1.it('should reject directly if already processed', async function () {
            const worker = new worker_1.Worker(queueName, async (job) => {
                throw new Error('test error');
            });
            const job = await queue.add('test', { foo: 'bar' });
            await utils_1.delay(500);
            try {
                await job.waitUntilFinished(queueEvents);
                throw new Error('should have been rejected');
            }
            catch (err) {
                chai_1.expect(err.message).equal('test error');
            }
            await worker.close();
        });
    });
});
//# sourceMappingURL=test_job.js.map