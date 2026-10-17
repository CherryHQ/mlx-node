/**
 * Qwen3-ASR inference and low-latency Core Audio capture on Apple Silicon.
 */
import { Qwen3AsrCapture, Qwen3AsrModel, Qwen3AsrStream, qwen3AsrAudioDevices, qwen3AsrInputDevices, } from '../core.cjs';
export { Qwen3AsrCapture, Qwen3AsrModel, Qwen3AsrStream, qwen3AsrAudioDevices, qwen3AsrInputDevices, };
/**
 * Owns one model stream and one Core Audio source. Call `stop()` to drain the
 * lock-free capture ring and receive the final, non-provisional transcript.
 */
export class Qwen3AsrRealtimeSession {
    stream;
    capture;
    #stopPromise;
    getLastError;
    constructor(stream, capture, getLastError) {
        this.stream = stream;
        this.capture = capture;
        this.getLastError = getLastError;
    }
    static async start(model, options) {
        const stream = await model.createStream(options.stream);
        let lastError;
        let capture;
        try {
            capture = stream.startCapture(options.capture, (error, result) => {
                if (error) {
                    lastError = error;
                    options.onError?.(error);
                    return;
                }
                options.onResult(result);
            });
        }
        catch (error) {
            await stream.finish().catch(() => undefined);
            throw error;
        }
        return new Qwen3AsrRealtimeSession(stream, capture, () => lastError);
    }
    get deviceName() {
        return this.capture.deviceName;
    }
    get source() {
        return this.capture.source;
    }
    get sampleRate() {
        return this.capture.sampleRate;
    }
    get lastError() {
        return this.getLastError();
    }
    pause() {
        this.capture.pause();
    }
    resume() {
        this.capture.resume();
    }
    stop() {
        this.#stopPromise ??= (async () => {
            let capture;
            try {
                capture = await this.capture.stop();
            }
            catch (error) {
                await this.stream.finish().catch(() => undefined);
                throw error;
            }
            const result = await this.stream.finish();
            const error = this.lastError;
            if (error)
                throw error;
            return { result, capture };
        })();
        return this.#stopPromise;
    }
}
export function startRealtimeTranscription(model, options) {
    return Qwen3AsrRealtimeSession.start(model, options);
}
/**
 * A meeting owns one independently clocked transcription track per enabled
 * source. Results stay source-tagged so speaker-mic audio and remote/system
 * audio are never silently mixed or ordered by unrelated device clocks.
 */
export class Qwen3AsrMeetingSession {
    microphone;
    systemAudio;
    #stopPromise;
    constructor(tracks) {
        this.microphone = tracks.microphone;
        this.systemAudio = tracks.systemAudio;
    }
    static async start(model, options) {
        if (options.microphone === false && options.systemAudio === false) {
            throw new Error('At least one meeting audio source must be enabled');
        }
        const tracks = {};
        const started = [];
        const startTrack = async (source, capture) => {
            const session = await Qwen3AsrRealtimeSession.start(model, {
                stream: options.stream,
                capture,
                onResult: (result) => options.onResult({ source, result }),
                onError: (error) => options.onError?.({ source, error }),
            });
            started.push(session);
            return session;
        };
        try {
            // Ask for system-audio permission before opening the microphone. This
            // avoids leaving a live mic running while the system permission sheet is
            // waiting for a response.
            if (options.systemAudio !== false) {
                tracks.systemAudio = await startTrack('systemAudio', {
                    ...options.systemAudio,
                    source: 'systemAudio',
                });
            }
            if (options.microphone !== false) {
                tracks.microphone = await startTrack('microphone', {
                    ...options.microphone,
                    source: 'microphone',
                });
            }
        }
        catch (error) {
            await Promise.allSettled(started.map((session) => session.stop()));
            throw error;
        }
        return new Qwen3AsrMeetingSession(tracks);
    }
    pause() {
        this.forEachTrack((track) => track.pause());
    }
    resume() {
        this.forEachTrack((track) => track.resume());
    }
    stop() {
        this.#stopPromise ??= (async () => {
            const microphone = this.microphone?.stop();
            const systemAudio = this.systemAudio?.stop();
            const settled = await Promise.allSettled([microphone, systemAudio].filter((promise) => promise !== undefined));
            const failure = settled.find((result) => result.status === 'rejected');
            if (failure)
                throw failure.reason;
            const final = {};
            let index = 0;
            if (microphone)
                final.microphone = settled[index++].value;
            if (systemAudio)
                final.systemAudio = settled[index].value;
            return final;
        })();
        return this.#stopPromise;
    }
    forEachTrack(action) {
        let firstError;
        for (const track of [this.microphone, this.systemAudio]) {
            if (!track)
                continue;
            try {
                action(track);
            }
            catch (error) {
                firstError ??= error;
            }
        }
        if (firstError)
            throw firstError;
    }
}
/** Start microphone and system-audio transcription as one meeting session. */
export function startMeetingTranscription(model, options) {
    return Qwen3AsrMeetingSession.start(model, options);
}
