# Cherry Studio TTS package

`tts/` is the installable JavaScript package for Cherry Studio, generated from the
pinned upstream revision `5db3d24bc87a9eb6fdb48c7ab3c9d8f126bf8d7d`.
It includes the TTS JavaScript API and the unchanged NAPI-RS loader. It does not
include native binaries, Metal libraries, or model weights, and has no install hooks.

After the normal repository dependency installation, regenerate it with:

```sh
node scripts/package-cherry-tts.mjs
```

The generated files are committed so consumers can pin this directory to a Git
commit without building Rust, fetching model weights, or requiring an npm release.
The packaging script only relocates the TTS package's native imports to `core.cjs`.
To run inference, the host sets `NAPI_RS_NATIVE_LIBRARY_PATH` to the verified native
addon before loading a model. Keep `mlx.metallib` and `paged_attn.metallib` next to
that addon. The host owns native downloads, model paths, process lifetime and audio
playback. The native addon must match the pinned upstream source revision.

Use the upstream `build:native` script in a clean checkout of the pinned revision
to build native files separately. Package that checkout and the audited 8-bit model:

```sh
node scripts/package-cherry-native.mjs <pinned-checkout> <converted-model> <output>
```

This generates a native-only archive, model files and a checksum manifest for the
fork's next artifact release. It requires `tar` to be available to Node. The old
`r1` archive remains the application's download source until the `r2` artifacts
are reviewed and published. Its unused JavaScript is excluded during extraction.
Publication of native files and an npm version is a separate, reviewed step;
neither packaging script publishes anything.
