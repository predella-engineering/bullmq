/*eslint-env node */
/* tslint:disable: no-floating-promises */
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const classes_1 = require("@src/classes");
const mocha_1 = require("mocha");
const chai_1 = require("chai");
const IORedis = require("ioredis");
const uuid_1 = require("uuid");
const worker_1 = require("@src/classes/worker");
const lodash_1 = require("lodash");
const utils_1 = require("@src/utils");
mocha_1.describe('Jobs getters', function () {
    this.timeout(4000);
    let queue;
    let queueName;
    mocha_1.beforeEach(async function () {
        queueName = 'test-' + uuid_1.v4();
        queue = new classes_1.Queue(queueName);
    });
    afterEach(async function () {
        await queue.close();
        await utils_1.removeAllQueueData(new IORedis(), queueName);
    });
    mocha_1.it('should get waiting jobs', async function () {
        await queue.add('test', { foo: 'bar' });
        await queue.add('test', { baz: 'qux' });
        const jobs = await queue.getWaiting();
        chai_1.expect(jobs).to.be.a('array');
        chai_1.expect(jobs.length).to.be.equal(2);
        chai_1.expect(jobs[0].data.foo).to.be.equal('bar');
        chai_1.expect(jobs[1].data.baz).to.be.equal('qux');
    });
    mocha_1.it('should get paused jobs', async function () {
        await queue.pause();
        await Promise.all([
            queue.add('test', { foo: 'bar' }),
            queue.add('test', { baz: 'qux' }),
        ]);
        const jobs = await queue.getWaiting();
        chai_1.expect(jobs).to.be.a('array');
        chai_1.expect(jobs.length).to.be.equal(2);
        chai_1.expect(jobs[0].data.foo).to.be.equal('bar');
        chai_1.expect(jobs[1].data.baz).to.be.equal('qux');
    });
    mocha_1.it('should get active jobs', async function () {
        let processor;
        const processing = new Promise(resolve => {
            processor = async (job) => {
                const jobs = await queue.getActive();
                chai_1.expect(jobs).to.be.a('array');
                chai_1.expect(jobs.length).to.be.equal(1);
                chai_1.expect(jobs[0].data.foo).to.be.equal('bar');
                resolve();
            };
        });
        const worker = new worker_1.Worker(queueName, processor);
        await queue.add('test', { foo: 'bar' });
        await processing;
        await worker.close();
    });
    mocha_1.it('should get a specific job', async () => {
        const data = { foo: 'sup!' };
        const job = await queue.add('test', data);
        const returnedJob = await queue.getJob(job.id);
        chai_1.expect(returnedJob.data).to.eql(data);
        chai_1.expect(returnedJob.id).to.be.eql(job.id);
    });
    mocha_1.it('should get undefined for nonexistent specific job', async () => {
        const returnedJob = await queue.getJob('test');
        chai_1.expect(returnedJob).to.be.equal(undefined);
    });
    mocha_1.it('should get completed jobs', async () => {
        const worker = new worker_1.Worker(queueName, async (job) => { });
        let counter = 2;
        const completed = new Promise(resolve => {
            worker.on('completed', async function () {
                counter--;
                if (counter === 0) {
                    const jobs = await queue.getCompleted();
                    chai_1.expect(jobs).to.be.a('array');
                    // We need a "empty completed" kind of function.
                    //expect(jobs.length).to.be.equal(2);
                    await worker.close();
                    resolve();
                }
            });
        });
        await queue.add('test', { foo: 'bar' });
        await queue.add('test', { baz: 'qux' });
        await completed;
    });
    mocha_1.it('should get failed jobs', async () => {
        const worker = new worker_1.Worker(queueName, async (job) => {
            throw new Error('Forced error');
        });
        let counter = 2;
        const failed = new Promise(resolve => {
            worker.on('failed', async function () {
                counter--;
                if (counter === 0) {
                    const jobs = await queue.getFailed();
                    chai_1.expect(jobs).to.be.a('array');
                    chai_1.expect(jobs).to.have.length(2);
                    await worker.close();
                    resolve();
                }
            });
        });
        await queue.add('test', { foo: 'bar' });
        await queue.add('test', { baz: 'qux' });
        await failed;
    });
    /*
    it('fails jobs that exceed their specified timeout', function(done) {
      queue.process(function(job, jobDone) {
        setTimeout(jobDone, 150);
      });
  
      queue.on('failed', function(job, error) {
        expect(error.message).to.be.eql('operation timed out');
        done();
      });
  
      queue.on('completed', function() {
        var error = new Error('The job should have timed out');
        done(error);
      });
  
      queue.add(
        { some: 'data' },
        {
          timeout: 100,
        },
      );
    });
    */
    mocha_1.it('should return all completed jobs when not setting start/end', function (done) {
        const worker = new worker_1.Worker(queueName, async (job) => { });
        worker.on('completed', lodash_1.after(3, async function () {
            try {
                const jobs = await queue.getJobs('completed');
                chai_1.expect(jobs)
                    .to.be.an('array')
                    .that.have.length(3);
                chai_1.expect(jobs[0]).to.have.property('finishedOn');
                chai_1.expect(jobs[1]).to.have.property('finishedOn');
                chai_1.expect(jobs[2]).to.have.property('finishedOn');
                chai_1.expect(jobs[0]).to.have.property('processedOn');
                chai_1.expect(jobs[1]).to.have.property('processedOn');
                chai_1.expect(jobs[2]).to.have.property('processedOn');
                await worker.close();
                done();
            }
            catch (err) {
                await worker.close();
                done(err);
            }
        }));
        queue.add('test', { foo: 1 });
        queue.add('test', { foo: 2 });
        queue.add('test', { foo: 3 });
    });
    mocha_1.it('should return all failed jobs when not setting start/end', function (done) {
        const worker = new worker_1.Worker(queueName, async (job) => {
            throw new Error('error');
        });
        worker.on('failed', lodash_1.after(3, async function () {
            try {
                queue;
                const jobs = await queue.getJobs('failed');
                chai_1.expect(jobs)
                    .to.be.an('array')
                    .that.has.length(3);
                chai_1.expect(jobs[0]).to.have.property('finishedOn');
                chai_1.expect(jobs[1]).to.have.property('finishedOn');
                chai_1.expect(jobs[2]).to.have.property('finishedOn');
                chai_1.expect(jobs[0]).to.have.property('processedOn');
                chai_1.expect(jobs[1]).to.have.property('processedOn');
                chai_1.expect(jobs[2]).to.have.property('processedOn');
                await worker.close();
                done();
            }
            catch (err) {
                done(err);
            }
        }));
        queue.add('test', { foo: 1 });
        queue.add('test', { foo: 2 });
        queue.add('test', { foo: 3 });
    });
    mocha_1.it('should return subset of jobs when setting positive range', function (done) {
        const worker = new worker_1.Worker(queueName, async (job) => { });
        worker.on('completed', lodash_1.after(3, async function () {
            try {
                const jobs = await queue.getJobs('completed', 1, 2, true);
                chai_1.expect(jobs)
                    .to.be.an('array')
                    .that.has.length(2);
                chai_1.expect(jobs[0].data.foo).to.be.eql(2);
                chai_1.expect(jobs[1].data.foo).to.be.eql(3);
                chai_1.expect(jobs[0]).to.have.property('finishedOn');
                chai_1.expect(jobs[1]).to.have.property('finishedOn');
                chai_1.expect(jobs[0]).to.have.property('processedOn');
                chai_1.expect(jobs[1]).to.have.property('processedOn');
                await worker.close();
                done();
            }
            catch (err) {
                done(err);
            }
        }));
        queue.add('test', { foo: 1 });
        queue.add('test', { foo: 2 });
        queue.add('test', { foo: 3 });
    });
    mocha_1.it('should return subset of jobs when setting a negative range', function (done) {
        const worker = new worker_1.Worker(queueName, async (job) => { });
        worker.on('completed', lodash_1.after(3, async function () {
            try {
                const jobs = await queue.getJobs('completed', -3, -1, true);
                chai_1.expect(jobs)
                    .to.be.an('array')
                    .that.has.length(3);
                chai_1.expect(jobs[0].data.foo).to.be.equal(1);
                chai_1.expect(jobs[1].data.foo).to.be.eql(2);
                chai_1.expect(jobs[2].data.foo).to.be.eql(3);
                await worker.close();
                done();
            }
            catch (err) {
                done(err);
            }
        }));
        queue.add('test', { foo: 1 });
        queue.add('test', { foo: 2 });
        queue.add('test', { foo: 3 });
    });
    mocha_1.it('should return subset of jobs when range overflows', function (done) {
        const worker = new worker_1.Worker(queueName, async (job) => { });
        worker.on('completed', lodash_1.after(3, async function () {
            try {
                const jobs = await queue.getJobs('completed', -300, 99999, true);
                chai_1.expect(jobs)
                    .to.be.an('array')
                    .that.has.length(3);
                chai_1.expect(jobs[0].data.foo).to.be.equal(1);
                chai_1.expect(jobs[1].data.foo).to.be.eql(2);
                chai_1.expect(jobs[2].data.foo).to.be.eql(3);
                await worker.close();
                done();
            }
            catch (err) {
                done(err);
            }
        }));
        queue.add('test', { foo: 1 });
        queue.add('test', { foo: 2 });
        queue.add('test', { foo: 3 });
    });
    mocha_1.it('should return jobs for multiple types', function (done) {
        let counter = 0;
        const worker = new worker_1.Worker(queueName, async (job) => {
            counter++;
            if (counter == 2) {
                await queue.add('test', { foo: 3 });
                return queue.pause();
            }
        });
        worker.on('completed', lodash_1.after(2, async function () {
            try {
                const jobs = await queue.getJobs(['completed', 'waiting']);
                chai_1.expect(jobs).to.be.an('array');
                chai_1.expect(jobs).to.have.length(3);
                await worker.close();
                done();
            }
            catch (err) {
                done(err);
            }
        }));
        queue.add('test', { foo: 1 });
        queue.add('test', { foo: 2 });
    });
});
//# sourceMappingURL=test_getters.js.map