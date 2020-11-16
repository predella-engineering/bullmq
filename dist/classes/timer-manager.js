"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimerManager = void 0;
const uuid_1 = require("uuid");
/**
 * Keeps track on timers created with setTimeout to help clearTimeout
 * for all timers when no more delayed actions needed
 */
class TimerManager {
    constructor() {
        this.timers = {};
    }
    setTimer(name, delay, fn) {
        const id = uuid_1.v4();
        const timer = setTimeout(timeoutId => {
            this.clearTimer(timeoutId);
            try {
                fn();
            }
            catch (err) {
                console.error(err);
            }
        }, delay, id);
        // XXX only the timer is used, but the
        // other fields are useful for
        // troubleshooting/debugging
        this.timers[id] = {
            name,
            timer,
        };
        return id;
    }
    clearTimer(id) {
        const timers = this.timers;
        const timer = timers[id];
        if (!timer) {
            return;
        }
        clearTimeout(timer.timer);
        delete timers[id];
    }
    clearAllTimers() {
        Object.keys(this.timers).forEach(key => {
            this.clearTimer(key);
        });
    }
}
exports.TimerManager = TimerManager;
//# sourceMappingURL=timer-manager.js.map