import type { TtsCapabilities, TtsModel } from './types.js';
export interface BackendChunk {
    samples: Float32Array;
    finished: boolean;
    finishReason?: string | null;
    synthesisMs?: number | null;
    firstPcmMs?: number | null;
}
export interface BackendStream {
    next(): Promise<BackendChunk | null | undefined>;
    cancel(): void;
    waitFinished(): Promise<void>;
}
export interface BackendOptions {
    voice?: string;
    voiceDescription?: string;
    instruct?: string;
    preparedVoiceId?: string;
    language: string;
    temperature?: number;
    topK?: number;
    topP?: number;
    repetitionPenalty?: number;
    seed?: number;
    chunkDurationMs: number;
    audioBufferSeconds: number;
    maxDurationSeconds?: number;
}
/** Internal adapter boundary. Future model families can produce PCM directly. */
export interface TtsBackend {
    readonly capabilities: TtsCapabilities;
    start(text: string, options: BackendOptions): BackendStream;
    prepareVoice(this: void, audio: Float32Array, sampleRate: number, transcript: string): Promise<string>;
    releaseVoice(this: void, id: string): Promise<void>;
    dispose(this: void): Promise<void>;
}
export declare function createTtsModel(backend: TtsBackend): TtsModel;
//# sourceMappingURL=model.d.ts.map