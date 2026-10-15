import type { AudioChunk } from './types.js';
export interface AudioProcessingStats {
    processingMs: number;
    inputFrames: number;
    outputFrames: number;
}
export interface AudioSpeedStream extends AsyncIterable<AudioChunk> {
    /** Updated as the output is consumed. Upstream inference and sink waits are excluded. */
    readonly stats: Readonly<AudioProcessingStats>;
}
/** Pitch-preserving PCM transform. Each segment flushes its own short history;
 * frame offsets describe the transformed output. Early return closes upstream.
 * Speed 1 is an exact passthrough. Inference statistics remain on the source. */
export declare function changeAudioSpeed(source: AsyncIterable<AudioChunk>, speed: number): AudioSpeedStream;
//# sourceMappingURL=speed.d.ts.map