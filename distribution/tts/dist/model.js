import { abortable, abortError, BoundedQueue } from './queue.js';
import { TextSegmenter } from './segmenter.js';
function positive(value, name) {
    if (!Number.isFinite(value) || value <= 0)
        throw new RangeError(`${name} must be positive and finite`);
    return value;
}
// The abort listener must be built outside synthesizeStream: V8 shares a
// context slot for `stream` across that scope's closures, so a same-scope
// listener would pin the stream on a live caller signal and defeat the
// WeakRef busy slot. From here the context chain captures only `ref`.
const abortStream = (ref) => () => ref.deref()?.cancel();
export function createTtsModel(backend) {
    const capabilities = Object.freeze({
        ...backend.capabilities,
        conditioning: Object.freeze(backend.capabilities.conditioning.map((c) => Object.freeze({ ...c }))),
        voices: Object.freeze([...backend.capabilities.voices]),
        languages: Object.freeze([...backend.capabilities.languages]),
    });
    const voices = new WeakSet();
    // Weak so an abandoned, never-iterated stream frees the busy slot via GC.
    let active;
    let preparing;
    let releasing;
    let disposed = false;
    let disposal;
    function available() {
        if (disposed)
            throw new Error('TTS model disposed');
        if (active?.deref() || preparing || releasing)
            throw new Error('TTS model busy');
    }
    const model = {
        capabilities,
        prepareVoice({ audio, transcript }) {
            available();
            if (!capabilities.voiceCloning)
                throw new Error('This model does not support voice cloning');
            const channels = audio.channels ?? 1;
            if (!Number.isSafeInteger(channels) || channels < 1 || audio.samples.length % channels)
                throw new Error('Invalid reference audio channels');
            positive(audio.sampleRate, 'sampleRate');
            if (!Number.isInteger(audio.sampleRate) || !audio.samples.length || !transcript.trim())
                throw new Error('Reference audio and transcript must be nonempty');
            const mono = new Float32Array(audio.samples.length / channels);
            for (let i = 0; i < audio.samples.length; i++) {
                const sample = audio.samples[i];
                if (!Number.isFinite(sample))
                    throw new Error('Reference audio contains non-finite samples');
                mono[Math.floor(i / channels)] += sample / channels;
            }
            preparing = backend
                .prepareVoice(mono, audio.sampleRate, transcript)
                .then((id) => {
                let release;
                const voice = Object.freeze({
                    id,
                    dispose() {
                        if (disposed)
                            return Promise.resolve();
                        if (release)
                            return release;
                        // The handle is dropped once the release is dispatched so queued
                        // synthesis fails eagerly instead of reaching the native queue.
                        voices.delete(voice);
                        // Releases serialize behind a running operation on the native
                        // side; concurrent releases join in the same order.
                        release = (releasing ?? Promise.resolve())
                            .catch(() => { })
                            .then(() => backend.releaseVoice(id))
                            .catch((error) => {
                            release = undefined;
                            voices.add(voice);
                            throw error;
                        })
                            .finally(() => {
                            releasing = undefined;
                        });
                        releasing = release;
                        return release;
                    },
                });
                voices.add(voice);
                return voice;
            })
                .finally(() => {
                preparing = undefined;
            });
            return preparing;
        },
        synthesizeStream(input, options) {
            available();
            let voiceMode;
            let voiceDescription;
            let preparedVoiceId;
            if (typeof options.voice === 'string') {
                voiceMode = 'preset';
                if (!capabilities.voices.includes(options.voice.toLowerCase()))
                    throw new Error(`Unknown preset voice: ${options.voice}`);
            }
            else if (options.voice && 'type' in options.voice && options.voice.type === 'description') {
                voiceMode = 'description';
                voiceDescription = options.voice.description;
                if (typeof voiceDescription !== 'string' || !voiceDescription.trim())
                    throw new TypeError('Voice description must be a nonempty string');
            }
            else {
                voiceMode = 'reference';
                if (!options.voice || !voices.has(options.voice))
                    throw new Error('Prepared voice does not belong to this model');
                preparedVoiceId = options.voice.id;
            }
            const capability = capabilities.conditioning.find((c) => c.voice === voiceMode);
            if (!capability)
                throw new Error(`Unsupported TTS voice mode: ${voiceMode}`);
            function instruction(value) {
                if (value === null || value === undefined)
                    return undefined;
                if (typeof value !== 'string')
                    throw new TypeError('Instruction must be a string or null');
                if (!value.trim())
                    return undefined;
                if (capability.instruct === 'unsupported')
                    throw new Error(`Instruction control is unsupported for ${voiceMode} voices on this model`);
                return value;
            }
            const initialInstruction = instruction(options.instruct);
            const language = options.language?.toLowerCase() ?? 'auto';
            if (language !== 'auto' && !capabilities.languages.includes(language))
                throw new Error(`Unsupported language: ${language}`);
            if (options.seed !== undefined &&
                (!Number.isSafeInteger(options.seed) || options.seed < 0 || options.seed > 0xffffffff))
                throw new RangeError('seed must be an unsigned 32-bit integer');
            const segmenter = new TextSegmenter(options.maxSegmentGraphemes);
            for (const [name, value] of Object.entries({
                temperature: options.temperature,
                topP: options.topP,
                repetitionPenalty: options.repetitionPenalty,
            })) {
                if (value !== undefined &&
                    (!Number.isFinite(value) ||
                        value < 0 ||
                        (name === 'topP' && value > 1) ||
                        (name === 'repetitionPenalty' && value === 0)))
                    throw new RangeError(`Invalid ${name}`);
            }
            if (options.topK !== undefined &&
                (!Number.isSafeInteger(options.topK) || options.topK < 0 || options.topK > 0x7fffffff))
                throw new RangeError('Invalid topK');
            const backendOptions = {
                voice: typeof options.voice === 'string' ? options.voice.toLowerCase() : undefined,
                preparedVoiceId,
                voiceDescription,
                language,
                temperature: options.temperature,
                topK: options.topK,
                topP: options.topP,
                repetitionPenalty: options.repetitionPenalty,
                seed: options.seed,
                chunkDurationMs: positive(options.chunkDurationMs ?? 160, 'chunkDurationMs'),
                audioBufferSeconds: positive(options.audioBufferSeconds ?? 1, 'audioBufferSeconds'),
                maxDurationSeconds: options.maxDurationSeconds === undefined
                    ? undefined
                    : positive(options.maxDurationSeconds, 'maxDurationSeconds'),
            };
            const signal = options.signal;
            const controller = new AbortController();
            const queue = new BoundedQueue(options.queuedSegments ?? 2, controller.signal);
            const started = performance.now();
            let raw;
            let rawCancelled = false;
            function cancelRaw() {
                if (raw && !rawCancelled) {
                    rawCancelled = true;
                    raw.cancel();
                }
            }
            let producer;
            const noFailure = Symbol('no failure');
            let inputFailure = noFailure;
            let source;
            let began = false;
            let settled = false;
            let resolve;
            let reject;
            const completed = new Promise((yes, no) => {
                resolve = yes;
                reject = no;
            });
            // A consumer may only use the iterator; keep rejection observable on
            // completed without producing an unrelated unhandled-rejection event.
            void completed.catch(() => { });
            const stats = {
                audioSeconds: 0,
                synthesisMs: 0,
                wallMs: 0,
                inputWaitMs: 0,
                consumerWaitMs: 0,
                realTimeFactor: null,
                firstPcmMs: null,
                segments: 0,
                finishReason: 'eos',
            };
            function finish(error) {
                if (settled)
                    return;
                settled = true;
                signal?.removeEventListener('abort', onAbort);
                if (active?.deref() === stream)
                    active = undefined;
                stats.wallMs = performance.now() - started;
                stats.realTimeFactor = stats.audioSeconds ? stats.synthesisMs / 1000 / stats.audioSeconds : null;
                if (error !== noFailure)
                    reject(error);
                else
                    resolve({ ...stats });
            }
            async function produce() {
                let currentInstruction = initialInstruction;
                async function submit(value, flush = false) {
                    for (const text of segmenter.push(value, flush))
                        if (text.trim())
                            await queue.push(Object.freeze({ text, instruct: currentInstruction }));
                }
                try {
                    if (typeof input === 'string') {
                        await submit(input, true);
                    }
                    else {
                        source = input[Symbol.asyncIterator]();
                        while (!controller.signal.aborted) {
                            const item = await abortable(source.next(), controller.signal);
                            if (item.done)
                                break;
                            const value = item.value;
                            if (typeof value === 'string')
                                await submit(value);
                            else if (value?.type === 'text' && typeof value.text === 'string')
                                await submit(value.text);
                            else if (value?.type === 'flush')
                                await submit('', true);
                            else if (value?.type === 'instruct' && (typeof value.value === 'string' || value.value === null)) {
                                const next = instruction(value.value);
                                if (next !== currentInstruction) {
                                    await submit('', true);
                                    currentInstruction = next;
                                }
                            }
                            else
                                throw new TypeError('Invalid TTS input event');
                        }
                        await submit('', true);
                    }
                    queue.close();
                }
                catch (error) {
                    if (!controller.signal.aborted) {
                        inputFailure = error;
                        controller.abort();
                        cancelRaw();
                    }
                    queue.close(error);
                }
            }
            async function* generate() {
                began = true;
                let failure = noFailure;
                let naturalEnd = false;
                let offset = 0;
                producer = produce();
                try {
                    while (true) {
                        const inputWaiting = performance.now();
                        const segment = await queue.shift();
                        stats.inputWaitMs += performance.now() - inputWaiting;
                        if (segment === undefined) {
                            // A cancel racing the natural queue close still terminates as abort.
                            naturalEnd = !controller.signal.aborted;
                            break;
                        }
                        const submitted = performance.now();
                        // A release dispatched after stream creation can drain before this
                        // segment starts; fail it eagerly rather than on the native worker.
                        if (voiceMode === 'reference' && !voices.has(options.voice))
                            throw new Error('Prepared voice does not belong to this model');
                        raw = backend.start(segment.text, { ...backendOptions, instruct: segment.instruct });
                        rawCancelled = false;
                        let terminal = false;
                        while (true) {
                            const chunk = await abortable(raw.next(), controller.signal);
                            if (!chunk)
                                break;
                            // Drain PCM before honoring `finished`: the BackendChunk contract
                            // does not require a terminal chunk to carry empty samples.
                            if (chunk.samples.length) {
                                stats.firstPcmMs ??= performance.now() - submitted;
                                const frames = chunk.samples.length / capabilities.channels;
                                if (!Number.isSafeInteger(frames))
                                    throw new Error('Backend returned an incomplete PCM frame');
                                stats.audioSeconds += frames / capabilities.sampleRate;
                                const consumerWaiting = performance.now();
                                yield {
                                    samples: chunk.samples,
                                    sampleRate: capabilities.sampleRate,
                                    channels: capabilities.channels,
                                    startSample: offset,
                                    segmentIndex: stats.segments,
                                };
                                stats.consumerWaitMs += performance.now() - consumerWaiting;
                                offset += frames;
                            }
                            if (chunk.finished) {
                                terminal = true;
                                stats.synthesisMs += chunk.synthesisMs ?? 0;
                                if (chunk.finishReason === 'length')
                                    stats.finishReason = 'length';
                                break;
                            }
                        }
                        if (!terminal && !controller.signal.aborted)
                            throw new Error('TTS worker ended without completion');
                        await raw.waitFinished();
                        raw = undefined;
                        stats.segments++;
                    }
                }
                catch (error) {
                    failure = inputFailure !== noFailure ? inputFailure : error;
                    throw failure;
                }
                finally {
                    if (!naturalEnd)
                        controller.abort();
                    cancelRaw();
                    try {
                        await raw?.waitFinished();
                    }
                    catch (error) {
                        if (failure === noFailure)
                            failure = error;
                    }
                    queue.close();
                    // An upstream iterator can be blocked on external I/O. Cancellation
                    // must not wait for that source to acknowledge return().
                    if (!naturalEnd && source?.return)
                        void Promise.resolve()
                            .then(() => source.return())
                            .catch(() => { });
                    await producer;
                    if (failure === noFailure)
                        failure = inputFailure;
                    finish(failure !== noFailure ? failure : !naturalEnd ? abortError() : noFailure);
                }
            }
            const iterator = generate();
            let claimed = false;
            const stream = {
                completed,
                [Symbol.asyncIterator]() {
                    if (claimed)
                        throw new Error('TTS streams support one consumer');
                    claimed = true;
                    return {
                        next: () => settled && !began ? Promise.resolve({ done: true, value: undefined }) : iterator.next(),
                        return: async () => {
                            stream.cancel();
                            return iterator.return(undefined);
                        },
                        throw: async (error) => {
                            stream.cancel();
                            return iterator.throw(error);
                        },
                    };
                },
                cancel() {
                    if (settled)
                        return;
                    controller.abort();
                    cancelRaw();
                    queue.close();
                    if (!began)
                        finish(abortError());
                    else
                        void iterator.return(undefined).catch(() => { });
                },
            };
            const streamRef = new WeakRef(stream);
            active = streamRef;
            const onAbort = abortStream(streamRef);
            signal?.addEventListener('abort', onAbort, { once: true });
            if (signal?.aborted)
                stream.cancel();
            return stream;
        },
        async synthesize(input, options) {
            const stream = model.synthesizeStream(input, options);
            const chunks = [];
            let length = 0;
            for await (const chunk of stream) {
                chunks.push(chunk.samples);
                length += chunk.samples.length;
            }
            const samples = new Float32Array(length);
            let offset = 0;
            for (const chunk of chunks) {
                samples.set(chunk, offset);
                offset += chunk.length;
            }
            return {
                samples,
                sampleRate: capabilities.sampleRate,
                channels: capabilities.channels,
                stats: await stream.completed,
            };
        },
        dispose() {
            disposal ??= (async () => {
                disposed = true;
                const stream = active?.deref();
                stream?.cancel();
                await Promise.all([
                    backend.dispose(),
                    stream?.completed.catch(() => { }),
                    preparing?.catch(() => { }),
                    releasing?.catch(() => { }),
                ]);
            })();
            return disposal;
        },
    };
    return model;
}
