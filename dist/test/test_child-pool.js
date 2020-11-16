"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const classes_1 = require("../classes");
describe('Child pool', () => {
    let pool;
    beforeEach(() => {
        pool = new classes_1.ChildPool();
    });
    afterEach(() => pool.clean());
    it('should return same child if free', async () => {
        const processor = __dirname + '/fixtures/fixture_processor_bar.js';
        const child = await pool.retain(processor);
        chai_1.expect(child).to.be.ok;
        pool.release(child);
        chai_1.expect(pool.retained).to.be.empty;
        const newChild = await pool.retain(processor);
        chai_1.expect(child).to.be.eql(newChild);
    });
    it('should return a new child if reused the last free one', async () => {
        const processor = __dirname + '/fixtures/fixture_processor_bar.js';
        let child = await pool.retain(processor);
        chai_1.expect(child).to.be.ok;
        pool.release(child);
        chai_1.expect(pool.retained).to.be.empty;
        let newChild = await pool.retain(processor);
        chai_1.expect(child).to.be.eql(newChild);
        child = newChild;
        newChild = await pool.retain(processor);
        chai_1.expect(child).not.to.be.eql(newChild);
    });
    it('should return a new child if none free', async () => {
        const processor = __dirname + '/fixtures/fixture_processor_bar.js';
        const child = await pool.retain(processor);
        chai_1.expect(child).to.be.ok;
        chai_1.expect(pool.retained).not.to.be.empty;
        const newChild = await pool.retain(processor);
        chai_1.expect(child).to.not.be.eql(newChild);
    });
    it('should return a new child if killed', async () => {
        const processor = __dirname + '/fixtures/fixture_processor_bar.js';
        const child = await pool.retain(processor);
        chai_1.expect(child).to.be.ok;
        await pool.kill(child);
        chai_1.expect(pool.retained).to.be.empty;
        const newChild = await pool.retain(processor);
        chai_1.expect(child).to.not.be.eql(newChild);
    });
    it('should return a new child if many retained and none free', async () => {
        const processor = __dirname + '/fixtures/fixture_processor_bar.js';
        const children = await Promise.all([
            pool.retain(processor),
            pool.retain(processor),
            pool.retain(processor),
            pool.retain(processor),
            pool.retain(processor),
            pool.retain(processor),
        ]);
        chai_1.expect(children).to.have.length(6);
        const child = await pool.retain(processor);
        chai_1.expect(children).not.to.include(child);
    }).timeout(10000);
    it('should return an old child if many retained and one free', async () => {
        const processor = __dirname + '/fixtures/fixture_processor_bar.js';
        const children = await Promise.all([
            pool.retain(processor),
            pool.retain(processor),
            pool.retain(processor),
            pool.retain(processor),
            pool.retain(processor),
            pool.retain(processor),
        ]);
        chai_1.expect(children).to.have.length(6);
        pool.release(children[0]);
        const child = await pool.retain(processor);
        chai_1.expect(children).to.include(child);
    }).timeout(10000);
});
//# sourceMappingURL=test_child-pool.js.map