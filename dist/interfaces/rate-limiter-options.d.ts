export interface RateLimiterOptions {
    max: number;
    duration: number;
    groupKey?: string;
}
