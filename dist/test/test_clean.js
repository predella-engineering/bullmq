"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const classes_1 = require("../classes");
const utils_1 = require("@src/utils");
const chai_1 = require("chai");
const IORedis = require("ioredis");
const lodash_1 = require("lodash");
const mocha_1 = require("mocha");
const uuid_1 = require("uuid");
mocha_1.describe('Cleaner', () => {
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
        await queue.close();
        await queueEvents.close();
        await utils_1.removeAllQueueData(new IORedis(), queueName);
    });
    mocha_1.it('should clean an empty queue', async () => {
        await queue.waitUntilReady();
        const waitCleaned = new Promise(resolve => {
            queue.on('cleaned', (jobs, type) => {
                chai_1.expect(type).to.be.eql('completed');
                chai_1.expect(jobs.length).to.be.eql(0);
                resolve();
            });
        });
        const jobs = await queue.clean(0, 0);
        chai_1.expect(jobs.length).to.be.eql(0);
        await waitCleaned;
    });
    mocha_1.it('should clean two jobs from the queue', async () => {
        await queue.add('test', { some: 'data' });
        await queue.add('test', { some: 'data' });
        const worker = new classes_1.Worker(queueName, async (job) => { });
        await worker.waitUntilReady();
        queue.on('completed', lodash_1.after(2, async () => {
            const jobs = await queue.clean(0, 0);
            chai_1.expect(jobs.length).to.be.eql(2);
        }));
        await worker.close();
    });
    mocha_1.it('should only remove a job outside of the grace period', async () => {
        const worker = new classes_1.Worker(queueName, async (job) => { });
        await worker.waitUntilReady();
        await queue.add('test', { some: 'data' });
        await queue.add('test', { some: 'data' });
        await utils_1.delay(200);
        await queue.add('test', { some: 'data' });
        await queue.clean(100, 100);
        await utils_1.delay(100);
        const jobs = await queue.getCompleted();
        chai_1.expect(jobs.length).to.be.eql(1);
    });
    mocha_1.it('should clean all failed jobs', async () => {
        const worker = new classes_1.Worker(queueName, async (job) => {
            throw new Error('It failed');
        });
        await worker.waitUntilReady();
        await queue.add('test', { some: 'data' });
        await queue.add('test', { some: 'data' });
        await utils_1.delay(100);
        const jobs = await queue.clean(0, 0, 'failed');
        chai_1.expect(jobs.length).to.be.eql(2);
        const count = await queue.count();
        chai_1.expect(count).to.be.eql(0);
    });
    mocha_1.it('should clean all waiting jobs', async () => {
        await queue.add('test', { some: 'data' });
        await queue.add('test', { some: 'data' });
        await utils_1.delay(100);
        const jobs = await queue.clean(0, 0, 'wait');
        chai_1.expect(jobs.length).to.be.eql(2);
        const count = await queue.count();
        chai_1.expect(count).to.be.eql(0);
    });
    mocha_1.it('should clean all delayed jobs', async () => {
        await queue.add('test', { some: 'data' }, { delay: 5000 });
        await queue.add('test', { some: 'data' }, { delay: 5000 });
        await utils_1.delay(100);
        const jobs = await queue.clean(0, 0, 'delayed');
        chai_1.expect(jobs.length).to.be.eql(2);
        const count = await queue.count();
        chai_1.expect(count).to.be.eql(0);
    });
    mocha_1.it('should clean the number of jobs requested', async () => {
        await queue.add('test', { some: 'data' });
        await queue.add('test', { some: 'data' });
        await queue.add('test', { some: 'data' });
        await utils_1.delay(100);
        const jobs = await queue.clean(0, 1, 'wait');
        chai_1.expect(jobs.length).to.be.eql(1);
        const count = await queue.count();
        chai_1.expect(count).to.be.eql(2);
    });
    mocha_1.it('should clean a job without a timestamp', async () => {
        const worker = new classes_1.Worker(queueName, async (job) => {
            throw new Error('It failed');
        });
        await worker.waitUntilReady();
        const client = new IORedis();
        await queue.add('test', { some: 'data' });
        await queue.add('test', { some: 'data' });
        await utils_1.delay(100);
        await client.hdel(`bull:${queueName}:1`, 'timestamp');
        const jobs = await queue.clean(0, 0, 'failed');
        chai_1.expect(jobs.length).to.be.eql(2);
        const failed = await queue.getFailed();
        chai_1.expect(failed.length).to.be.eql(0);
    });
});
//# sourceMappingURL=test_clean.js.map