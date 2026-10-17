/**
 * Qwen3-ASR inference and low-latency Core Audio capture on Apple Silicon.
 */
import { Qwen3AsrCapture, Qwen3AsrCaptureSource, Qwen3AsrModel, Qwen3AsrStream, qwen3AsrAudioDevices, qwen3AsrInputDevices, type Qwen3AsrAudioDevice, type Qwen3AsrCaptureOptions, type Qwen3AsrCaptureStats, type Qwen3AsrInputDevice, type Qwen3AsrResult, type Qwen3AsrStreamOptions, type Qwen3AsrTranscribeOptions } from '../core.cjs';
export { Qwen3AsrCapture, Qwen3AsrCaptureSource, Qwen3AsrModel, Qwen3AsrStream, qwen3AsrAudioDevices, qwen3AsrInputDevices, type Qwen3AsrAudioDevice, type Qwen3AsrCaptureOptions, type Qwen3AsrCaptureStats, type Qwen3AsrInputDevice, type Qwen3AsrResult, type Qwen3AsrStreamOptions, type Qwen3AsrTranscribeOptions, };
export interface Qwen3AsrRealtimeOptions {
    /** Rolling decode cadence, language, and prompting options. */
    stream?: Qwen3AsrStreamOptions;
    /** Core Audio source, device, application filter, and callback-ring options. */
    capture?: Qwen3AsrCaptureOptions;
    /** Called for every rolling transcription revision. */
    onResult: (result: Qwen3AsrResult) => void;
    /** Called for asynchronous capture or model-worker errors. */
    onError?: (error: Error) => void;
}
export interface Qwen3AsrRealtimeFinal {
    result: Qwen3AsrResult;
    capture: Qwen3AsrCaptureStats;
}
/**
 * Owns one model stream and one Core Audio source. Call `stop()` to drain the
 * lock-free capture ring and receive the final, non-provisional transcript.
 */
export declare class Qwen3AsrRealtimeSession {
    #private;
    readonly stream: Qwen3AsrStream;
    readonly capture: Qwen3AsrCapture;
    private readonly getLastError;
    private constructor();
    static start(model: Qwen3AsrModel, options: Qwen3AsrRealtimeOptions): Promise<Qwen3AsrRealtimeSession>;
    get deviceName(): string;
    get source(): Qwen3AsrCaptureSource;
    get sampleRate(): number;
    get lastError(): Error | undefined;
    pause(): void;
    resume(): void;
    stop(): Promise<Qwen3AsrRealtimeFinal>;
}
export declare function startRealtimeTranscription(model: Qwen3AsrModel, options: Qwen3AsrRealtimeOptions): Promise<Qwen3AsrRealtimeSession>;
type CaptureTimingOptions = Pick<Qwen3AsrCaptureOptions, 'feedMilliseconds' | 'ringSeconds'>;
export interface Qwen3AsrMicrophoneOptions extends CaptureTimingOptions {
    /** Stable input-device UID from `qwen3AsrAudioDevices()`. */
    deviceId?: string;
    /** Input-device name. Prefer `deviceId` when persisting a selection. */
    deviceName?: string;
}
export interface Qwen3AsrSystemAudioOptions extends CaptureTimingOptions {
    /** Stable output-device UID from `qwen3AsrAudioDevices()`. */
    deviceId?: string;
    /** Output-device name. Prefer `deviceId` when persisting a selection. */
    deviceName?: string;
    /** Capture only these applications. Omit to capture all system output. */
    applicationBundleIds?: string[];
}
export type Qwen3AsrMeetingSource = 'microphone' | 'systemAudio';
export interface Qwen3AsrMeetingResultEvent {
    source: Qwen3AsrMeetingSource;
    result: Qwen3AsrResult;
}
export interface Qwen3AsrMeetingErrorEvent {
    source: Qwen3AsrMeetingSource;
    error: Error;
}
export interface Qwen3AsrMeetingOptions {
    /** Shared rolling decode cadence, language, and prompting options. */
    stream?: Qwen3AsrStreamOptions;
    /** Microphone capture options. `false` disables this track. Default enabled. */
    microphone?: false | Qwen3AsrMicrophoneOptions;
    /** System/output audio options. `false` disables this track. Default enabled. */
    systemAudio?: false | Qwen3AsrSystemAudioOptions;
    /** Called for every rolling revision, tagged with its audio source. */
    onResult: (event: Qwen3AsrMeetingResultEvent) => void;
    /** Called for asynchronous capture or model-worker errors. */
    onError?: (event: Qwen3AsrMeetingErrorEvent) => void;
}
export interface Qwen3AsrMeetingFinal {
    microphone?: Qwen3AsrRealtimeFinal;
    systemAudio?: Qwen3AsrRealtimeFinal;
}
/**
 * A meeting owns one independently clocked transcription track per enabled
 * source. Results stay source-tagged so speaker-mic audio and remote/system
 * audio are never silently mixed or ordered by unrelated device clocks.
 */
export declare class Qwen3AsrMeetingSession {
    #private;
    readonly microphone?: Qwen3AsrRealtimeSession;
    readonly systemAudio?: Qwen3AsrRealtimeSession;
    private constructor();
    static start(model: Qwen3AsrModel, options: Qwen3AsrMeetingOptions): Promise<Qwen3AsrMeetingSession>;
    pause(): void;
    resume(): void;
    stop(): Promise<Qwen3AsrMeetingFinal>;
    private forEachTrack;
}
/** Start microphone and system-audio transcription as one meeting session. */
export declare function startMeetingTranscription(model: Qwen3AsrModel, options: Qwen3AsrMeetingOptions): Promise<Qwen3AsrMeetingSession>;
//# sourceMappingURL=index.d.ts.map