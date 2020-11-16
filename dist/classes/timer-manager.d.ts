/**
 * Keeps track on timers created with setTimeout to help clearTimeout
 * for all timers when no more delayed actions needed
 */
export declare class TimerManager {
    private timers;
    setTimer(name: string, delay: number, fn: Function): string;
    clearTimer(id: string): void;
    clearAllTimers(): void;
}
