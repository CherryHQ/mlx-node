import type { TtsModel, TtsLoadOptions } from './types.js';
export type * from './types.js';
export declare function loadTtsModel(path: string, options?: TtsLoadOptions): Promise<TtsModel>;
export { readWav, WavWriter, createAudioPlayer } from './audio.js';
export type { AudioPlayer, PlaybackStats } from './audio.js';
export { changeAudioSpeed } from './speed.js';
export type { AudioSpeedStream, AudioProcessingStats } from './speed.js';
//# sourceMappingURL=index.d.ts.map