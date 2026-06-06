# LowEndGS

Adaptive Streamed Gaussian Splatting for sub-$200 mobile web devices.

This repository is a research prototype for making PlayCanvas / SuperSplat / SplatTransform / SOG Gaussian Splat scenes playable on low-end Android phones in the browser. The target is smooth interactive playback under weak GPU, low RAM, unstable network, WebGL2 fallback, and WebGPU where available.

## Current Status

- Research docs initialized in `docs/`.
- Repo structure initialized for viewer, tools, scripts, benchmarks, datasets, and paper artifacts.
- Real bundled SOG scene `kaliurang` has been ingested locally.
- One desktop harness Baseline A result exists for `kaliurang`.
- No Android/mobile result exists yet.
- No performance improvement claim should be made until baseline and candidate logs exist for the same real mobile device.

## Research Targets

- Minimum acceptable playback: stable 24 FPS at reduced quality.
- Stretch playback: stable 30 FPS.
- First visible frame: under 2 seconds after page load on decent 4G / Wi-Fi.
- Interaction: camera movement should not stall when chunks load.
- Memory: avoid browser tab crashes and track active splats, chunks, bytes, JS heap where available, and renderer path.

## Phase 2 Quickstart

1. Install dependencies.
2. Build and serve the viewer.
3. Ingest a real scene.
4. Run Baseline A.
5. Export results.
6. Validate results.
7. Test on Android Chrome.

```powershell
npm install
npm run viewer:build
npm run viewer:serve
node scripts/ingest-scene.mjs --input "datasets/samples/kaliurang.sog" --name "kaliurang" --type property-indoor --copy true
npm run results:validate
npm run mobile:url -- --scene kaliurang
```

Open Baseline A on desktop Chrome:

```text
http://127.0.0.1:4173/run?scene=kaliurang&asset=%2Fassets%2Fscenes%2Fkaliurang%2Fscene.sog&mode=baselineA&duration=30&autoStart=true&autoExport=server&resultEndpoint=%2Fapi%2Fsave-run&route=orbit-demo&captureScreenshot=true
```

Server health check:

```text
http://127.0.0.1:4173/api/health
```

Assetless smoke mode, not research data:

```text
http://localhost:4173/run?asset=none&duration=3&autoExport=server
```

Generate baseline assets from a local PLY:

```powershell
node scripts/convert/generate-baselines.mjs --input datasets/raw/scene/scene.ply --out datasets/processed/scene
```

Generate baselines plus the route-aware visibility-decimated candidate:

```powershell
node scripts/convert/generate-baselines.mjs --input datasets/raw/scene/scene.ply --out datasets/processed/scene --route viewer/public/routes/orbit-demo.json --visibilityKeep 25%
```

Configured benchmark methods are listed in `benchmarks/configs/baselines.json`; current prototype candidates are `adaptive-budget`, `network-aware-stream`, `visibility-decimation`, and `contribution-culling`.

Baseline B for `kaliurang` is prepared only until Streamed SOG data exists:

```powershell
node scripts/convert/generate-kaliurang-lods.mjs
node scripts/convert/generate-kaliurang-lods.mjs --execute true --only aggressive_sh0_lod
```

The first command writes a dry-run plan to `benchmarks/analysis/kaliurang-lod-generation.json`. The second command attempts to generate the first Streamed SOG variant under ignored local asset folders. If direct SOG decimation fails, obtain the original PLY source and run the generator with `--input path/to/kaliurang.ply`.

## Phase 3 Streamed SOG and Active-Splat Envelope

Generate or inspect the LOD plan:

```powershell
npm run convert:kaliurang-lods
```

After generating a real streamed variant, serve the viewer:

```powershell
npm run viewer:build
npm run viewer:serve
```

Print the desktop matrix URLs:

```powershell
npm run matrix:kaliurang
```

Run Baseline B in Chrome after `/assets/scenes/kaliurang/streamed/aggressive_sh0/lod-meta.json` exists:

```text
http://127.0.0.1:4173/run?scene=kaliurang&asset=%2Fassets%2Fscenes%2Fkaliurang%2Fstreamed%2Faggressive_sh0%2Flod-meta.json&mode=baselineB&duration=30&autoStart=true&autoExport=server&resultEndpoint=%2Fapi%2Fsave-run&route=orbit-demo&captureScreenshot=true&resultName=kaliurang_aggressive_sh0_baselineB_streamed_sog_default
```

Run static budget probes:

```text
http://127.0.0.1:4173/run?scene=kaliurang&asset=%2Fassets%2Fscenes%2Fkaliurang%2Fstreamed%2Faggressive_sh0%2Flod-meta.json&mode=staticBudget_100000&duration=30&autoStart=true&autoExport=server&resultEndpoint=%2Fapi%2Fsave-run&route=orbit-demo&captureScreenshot=true&resultName=kaliurang_aggressive_sh0_budget100000
```

Analyze the saved results:

```powershell
npm run results:validate
npm run analysis:active-envelope
```

Print Android URLs:

```powershell
npm run mobile:url -- --asset /assets/scenes/kaliurang/streamed/aggressive_sh0/lod-meta.json --mode staticBudget_100000 --duration 30 --resultName kaliurang_android_budget100k
```

## Integrity Notes

PlayCanvas SOG, Streamed SOG, LOD streaming, and global splat budgeting are existing ecosystem features. LowEndGS should claim novelty only for the low-end-device adaptation pipeline, benchmark methodology, controller policy, offline optimization strategy, and fallback experiments that are actually implemented and measured.
