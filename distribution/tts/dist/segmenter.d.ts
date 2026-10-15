/** Text policy is independent of model tokens, codec frames and transport chunks. */
export declare class TextSegmenter {
    #private;
    readonly maxGraphemes: number;
    constructor(maxGraphemes?: number);
    push(text: string, flush?: boolean): Generator<string>;
}
//# sourceMappingURL=segmenter.d.ts.map