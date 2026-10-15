export function abortError() {
    return new DOMException('Speech synthesis cancelled', 'AbortError');
}
export async function abortable(promise, signal) {
    if (signal.aborted)
        throw abortError();
    let rejectAbort = () => { };
    const cancelled = new Promise((_, reject) => {
        rejectAbort = () => reject(abortError());
    });
    signal.addEventListener('abort', rejectAbort, { once: true });
    try {
        return await Promise.race([promise, cancelled]);
    }
    finally {
        signal.removeEventListener('abort', rejectAbort);
    }
}
/** Bounded single-producer/single-consumer queue. Close wakes both endpoints. */
export class BoundedQueue {
    capacity;
    signal;
    #items = [];
    #closed = false;
    #error;
    #wake = [];
    constructor(capacity, signal) {
        this.capacity = capacity;
        this.signal = signal;
        if (!Number.isSafeInteger(capacity) || capacity < 1)
            throw new RangeError('Queue capacity must be positive');
    }
    #notify() {
        for (const wake of this.#wake.splice(0))
            wake();
    }
    #changed() {
        return new Promise((resolve) => this.#wake.push(resolve));
    }
    async push(value) {
        while (this.#items.length >= this.capacity && !this.#closed)
            await abortable(this.#changed(), this.signal);
        if (this.signal.aborted)
            throw abortError();
        if (this.#closed)
            throw this.#error ?? new Error('Queue closed');
        this.#items.push(value);
        this.#notify();
    }
    async shift() {
        while (!this.#items.length && !this.#closed)
            await abortable(this.#changed(), this.signal);
        if (this.signal.aborted)
            throw abortError();
        if (this.#error)
            throw this.#error;
        const item = this.#items.shift();
        this.#notify();
        return item;
    }
    close(error) {
        this.#closed = true;
        this.#error = error;
        this.#notify();
    }
}
