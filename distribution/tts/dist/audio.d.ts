import type { AudioChunk, AudioData } from './types.js';
/** Read uncompressed RIFF/WAVE audio, preserving source sample rate and channels. */
export declare function readWav(path: string): Promise<AudioData>;
/** Streaming PCM16 WAV writer. Memory use is bounded by the caller's chunk. */
export declare class WavWriter {
    #private;
    readonly sampleRate: number;
    readonly channels: number;
    private constructor();
    static open(path: string, sampleRate: number, channels?: number): Promise<WavWriter>;
    write(chunk: AudioChunk | Float32Array): Promise<void>;
    close(): Promise<void>;
}
export interface PlaybackStats {
    playedSeconds: number;
    underruns: number;
    firstPlaybackMs?: number | null;
}
export interface AudioPlayer {
    write(samples: Float32Array): Promise<void>;
    finish(): Promise<PlaybackStats>;
    cancel(): void;
}
/** CoreAudio performs source-rate conversion. The device callback only reads PCM. */
export declare function createAudioPlayer(sampleRate: number, channels?: number, options?: {
    bufferSeconds?: number;
    prebufferSeconds?: number;
}): Promise<AudioPlayer>;
//# sourceMappingURL=audio.d.ts.map