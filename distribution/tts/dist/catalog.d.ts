/** Native-free resource metadata, also consumed by download/conversion tooling. */
export declare const ttsFamilies: {
    readonly qwen3_tts: {
        readonly variants: readonly ['custom_voice', 'base', 'voice_design'];
        readonly components: readonly ['speech_tokenizer'];
        readonly textStreaming: 'segmented';
    };
};
export declare function ttsComponents(config: {
    model_type?: unknown;
}): readonly string[];
//# sourceMappingURL=catalog.d.ts.map