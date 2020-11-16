"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const classes_1 = require("@src/classes");
const queue_events_1 = require("@src/classes/queue-events");
const worker_1 = require("@src/classes/worker");
const chai_1 = require("chai");
const IORedis = require("ioredis");
const mocha_1 = require("mocha");
const uuid_1 = require("uuid");
const utils_1 = require("@src/utils");
mocha_1.describe('events', function () {
    this.timeout(4000);
    let queue;
    let queueEvents;
    let queueName;
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
    mocha_1.it('should emit waiting when a job has been added', async function () {
        const waiting = new Promise(resolve => {
            queue.on('waiting', resolve);
        });
        await queue.add('test', { foo: 'bar' });
        await waiting;
    });
    mocha_1.it('should emit global waiting event when a job has been added', async function () {
        const waiting = new Promise(resolve => {
            queue.on('waiting', resolve);
        });
        await queue.add('test', { foo: 'bar' });
        await waiting;
    });
    mocha_1.it('emits drained global drained event when all jobs have been processed', async function () {
        const worker = new worker_1.Worker(queueName, async (job) => { }, {
            drainDelay: 1,
        });
        const drained = new Promise(resolve => {
            queueEvents.once('drained', resolve);
        });
        await queue.add('test', { foo: 'bar' });
        await queue.add('test', { foo: 'baz' });
        await drained;
        const jobs = await queue.getJobCountByTypes('completed');
        chai_1.expect(jobs).to.be.equal(2);
        await worker.close();
    });
    mocha_1.it('emits drained event when all jobs have been processed', async function () {
        const worker = new worker_1.Worker(queueName, async (job) => { }, {
            drainDelay: 1,
        });
        const drained = new Promise(resolve => {
            worker.once('drained', resolve);
        });
        await queue.add('test', { foo: 'bar' });
        await queue.add('test', { foo: 'baz' });
        await drained;
        const jobs = await queue.getJobCountByTypes('completed');
        chai_1.expect(jobs).to.be.equal(2);
        await worker.close();
    });
    mocha_1.it('should emit an event when a job becomes active', async () => {
        const worker = new worker_1.Worker(queueName, async (job) => { });
        await queue.add('test', {});
        const completed = new Promise(resolve => {
            worker.once('active', function () {
                worker.once('completed', async function () {
                    await worker.close();
                    resolve();
                });
            });
        });
        await completed;
    });
    mocha_1.it('should listen to global events', async () => {
        const worker = new worker_1.Worker(queueName, async (job) => { });
        let state;
        await utils_1.delay(50); // additional delay since XREAD from '$' is unstable
        queueEvents.on('waiting', function () {
            chai_1.expect(state).to.be.undefined;
            state = 'waiting';
        });
        queueEvents.once('active', function () {
            chai_1.expect(state).to.be.equal('waiting');
            state = 'active';
        });
        const completed = new Promise(resolve => {
            queueEvents.once('completed', async function () {
                chai_1.expect(state).to.be.equal('active');
                resolve();
            });
        });
        await queue.add('test', {});
        await completed;
        await worker.close();
    });
    mocha_1.it('should trim events automatically', async () => {
        const queueName = 'test-' + uuid_1.v4();
        const worker = new worker_1.Worker(queueName, async () => { });
        const trimmedQueue = new classes_1.Queue(queueName, {
            streams: {
                events: {
                    maxLen: 0,
                },
            },
        });
        await trimmedQueue.add('test', {});
        await trimmedQueue.add('test', {});
        await trimmedQueue.add('test', {});
        await trimmedQueue.add('test', {});
        const waitForCompletion = new Promise(resolve => {
            worker.on('drained', resolve);
        });
        await waitForCompletion;
        await worker.close();
        const client = await trimmedQueue.client;
        const [[id, [_, event]]] = await client.xrange(trimmedQueue.keys.events, '-', '+');
        chai_1.expect(event).to.be.equal('drained');
        const eventsLength = await client.xlen(trimmedQueue.keys.events);
        chai_1.expect(eventsLength).to.be.equal(1);
        await trimmedQueue.close();
        await utils_1.removeAllQueueData(new IORedis(), queueName);
    });
    mocha_1.it('should trim events manually', async () => {
        const queueName = 'test-manual-' + uuid_1.v4();
        const trimmedQueue = new classes_1.Queue(queueName);
        await trimmedQueue.add('test', {});
        await trimmedQueue.add('test', {});
        await trimmedQueue.add('test', {});
        await trimmedQueue.add('test', {});
        const client = await trimmedQueue.client;
        let eventsLength = await client.xlen(trimmedQueue.keys.events);
        chai_1.expect(eventsLength).to.be.equal(4);
        await trimmedQueue.trimEvents(0);
        eventsLength = await client.xlen(trimmedQueue.keys.events);
        chai_1.expect(eventsLength).to.be.equal(0);
        await trimmedQueue.close();
        await utils_1.removeAllQueueData(new IORedis(), queueName);
    });
});
//# sourceMappingURL=test_events.js.map