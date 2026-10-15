/** Native-free resource metadata, also consumed by download/conversion tooling. */
export const ttsFamilies = {
    qwen3_tts: {
        variants: ['custom_voice', 'base', 'voice_design'],
        components: ['speech_tokenizer'],
        textStreaming: 'segmented',
    },
};
export function ttsComponents(config) {
    return config.model_type === 'qwen3_tts' ? ttsFamilies.qwen3_tts.components : [];
}
