import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createTtsModel } from './model.js';
import { loadQwen3Backend } from './qwen3.js';
export async function loadTtsModel(path, options = {}) {
    const config = JSON.parse(await readFile(join(path, 'config.json'), 'utf8'));
    if (config.model_type !== 'qwen3_tts')
        throw new Error(`Unsupported TTS model family: ${config.model_type}`);
    return createTtsModel(await loadQwen3Backend(path, options));
}
export { readWav, WavWriter, createAudioPlayer } from './audio.js';
export { changeAudioSpeed } from './speed.js';
