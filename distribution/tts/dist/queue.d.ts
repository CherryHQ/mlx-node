export declare function abortError(): Error;
export declare function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T>;
/** Bounded single-producer/single-consumer queue. Close wakes both endpoints. */
export declare class BoundedQueue<T> {
    #private;
    readonly capacity: number;
    readonly signal: AbortSignal;
    constructor(capacity: number, signal: AbortSignal);
    push(value: T): Promise<void>;
    shift(): Promise<T | undefined>;
    close(error?: unknown): void;
}
//# sourceMappingURL=queue.d.ts.map