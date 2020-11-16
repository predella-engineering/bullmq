"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeAllQueueData = exports.isRedisInstance = exports.delay = exports.array2obj = exports.isEmpty = exports.tryCatch = exports.errorObject = void 0;
exports.errorObject = { value: null };
function tryCatch(fn, ctx, args) {
    try {
        return fn.apply(ctx, args);
    }
    catch (e) {
        exports.errorObject.value = e;
        return exports.errorObject;
    }
}
exports.tryCatch = tryCatch;
function isEmpty(obj) {
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            return false;
        }
    }
    return true;
}
exports.isEmpty = isEmpty;
function array2obj(arr) {
    const obj = {};
    for (let i = 0; i < arr.length; i += 2) {
        obj[arr[i]] = arr[i + 1];
    }
    return obj;
}
exports.array2obj = array2obj;
function delay(ms) {
    return new Promise(resolve => {
        setTimeout(() => resolve(), ms);
    });
}
exports.delay = delay;
function isRedisInstance(obj) {
    if (!obj) {
        return false;
    }
    const redisApi = ['connect', 'disconnect', 'duplicate'];
    return redisApi.every(name => typeof obj[name] === 'function');
}
exports.isRedisInstance = isRedisInstance;
async function removeAllQueueData(client, queueName, prefix = 'bull') {
    const pattern = `${prefix}:${queueName}:*`;
    return new Promise((resolve, reject) => {
        const stream = client.scanStream({
            match: pattern,
        });
        stream.on('data', (keys) => {
            if (keys.length) {
                const pipeline = client.pipeline();
                keys.forEach(key => {
                    pipeline.del(key);
                });
                pipeline.exec().catch(error => {
                    reject(error);
                });
            }
        });
        stream.on('end', () => {
            resolve();
        });
        stream.on('error', error => {
            reject(error);
        });
    });
}
exports.removeAllQueueData = removeAllQueueData;
//# sourceMappingURL=utils.js.map