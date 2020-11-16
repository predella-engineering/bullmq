"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const classes_1 = require("../classes");
const chai_1 = require("chai");
const IORedis = require("ioredis");
const mocha_1 = require("mocha");
const uuid_1 = require("uuid");
const utils_1 = require("../utils");
mocha_1.describe('bulk jobs', () => {
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
    mocha_1.it('should process jobs', async () => {
        const name = 'test';
        let processor;
        const processing = new Promise(resolve => [
            (processor = async (job) => {
                if (job.data.idx === 0) {
                    chai_1.expect(job.data.foo).to.be.equal('bar');
                }
                else {
                    chai_1.expect(job.data.idx).to.be.equal(1);
                    chai_1.expect(job.data.foo).to.be.equal('baz');
                    resolve();
                }
            }),
        ]);
        const worker = new classes_1.Worker(queueName, processor);
        await worker.waitUntilReady();
        const jobs = await queue.addBulk([
            { name, data: { idx: 0, foo: 'bar' } },
            { name, data: { idx: 1, foo: 'baz' } },
        ]);
        chai_1.expect(jobs).to.have.length(2);
        chai_1.expect(jobs[0].id).to.be.ok;
        chai_1.expect(jobs[0].data.foo).to.be.eql('bar');
        chai_1.expect(jobs[1].id).to.be.ok;
        chai_1.expect(jobs[1].data.foo).to.be.eql('baz');
        await processing;
        await worker.close();
    });
});
//# sourceMappingURL=test_bulk.js.map