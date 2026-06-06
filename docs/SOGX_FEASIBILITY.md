# SOG-X Feasibility Study

Phase: SOG-X Feasibility Study: Can We Beat SOG for Mobile Property Tours?

Last updated: 2026-06-06

## Executive Answer

Current evidence does not justify a new format yet.

For the only real scene with saved benchmark evidence (`kaliurang`), bundled SOG is compact: 17,903,258 bytes for 1,178,520 Gaussians, or 15.19 bytes/Gaussian. The valid desktop harness run downloaded/loaded the asset early, but steady rendering was extremely slow with all 1.18M splats active. This points first to splat count / rendering workload, not SOG payload size.

Confidence is limited because:

- No Android/mobile result exists.
- No Streamed SOG Baseline B exists.
- Visual sanity failed for the saved Baseline A screenshot.
- The saved SH0 runtime attempt is stalled/inconclusive and does not support a runtime claim.
- There is no PLY source for compression-ratio comparison.

## Required Evidence Status

| Requirement | Status |
| --- | --- |
| Existing Baseline A bundled SOG results | Exists for `kaliurang`, desktop harness only. |
| Existing Baseline B Streamed SOG results | Missing; no `lod-meta.json`. |
| At least one real property or indoor scene | `kaliurang` exists and is ingested. |
| Per-frame benchmark JSON/CSV | Exists for Baseline A; one additional run is stalled/inconclusive. |
| File-size breakdown of SOG contents | Exists in `benchmarks/analysis/sog-size-breakdown.*`. |

## Phase 3 Update

Streamed SOG and active-splat envelope tooling has been prepared, but it has not produced runtime evidence yet.

Prepared artifacts:

- `scripts/convert/generate-kaliurang-lods.mjs`
- `benchmarks/analysis/kaliurang-lod-generation.json`
- `scripts/run-kaliurang-matrix.mjs`
- `benchmarks/analysis/kaliurang-matrix.json`
- `scripts/analyze-active-splat-envelope.mjs`
- `benchmarks/analysis/active-splat-envelope.json`

Current conclusion: a new format remains unjustified until at least one Streamed SOG Baseline B and the static active-splat envelope sweep are measured. If a large speedup appears only after reducing active splats or clamping LOD, the bottleneck is still the rendering/LOD envelope rather than bundled SOG payload layout.

## SOG Payload Breakdown

Source files:

- `benchmarks/analysis/sog-size-breakdown.json`
- `benchmarks/analysis/sog-size-breakdown.csv`

For `kaliurang` and the derived SH0 variant:

| Field | Value |
| --- | ---: |
| Total SOG size | 17,903,258 bytes |
| Gaussian count | 1,178,520 |
| Bytes per Gaussian | 15.191306 |
| `meta.json` | 15,377 bytes |
| `means_l.webp` | 3,538,018 bytes |
| `means_u.webp` | 1,025,110 bytes |
| `scales.webp` | 2,673,316 bytes |
| `quats.webp` | 3,373,362 bytes |
| `sh0.webp` | 3,566,750 bytes |
| `shN_centroids.webp` | 1,564,252 bytes |
| `shN_labels.webp` | 2,145,706 bytes |
| SH bytes | 7,276,708 bytes |
| SH share of SOG | 40.6446% |
| SH / non-SH attribute ratio | 0.685847 |
| Source PLY compression ratio | Unknown; no PLY source exists locally. |

Derived SH0-only variant:

| Field | Value |
| --- | ---: |
| Total SOG size | 14,071,473 bytes |
| Gaussian count | 1,178,520 |
| Bytes per Gaussian | 11.939953 |
| Size reduction vs original SOG | 3,831,785 bytes / 21.40% |
| SH bytes | 3,657,700 bytes |
| SH share of SOG | 25.9937% |
| SH bands | 0 higher-order bands |

## Bottleneck Classification

Source files:

- `benchmarks/analysis/bottleneck-classification.csv`
- `benchmarks/analysis/bottleneck-classification.json`

| Run | Classification | Confidence | Evidence |
| --- | --- | --- | --- |
| `2026-06-06T13-32-37-714Z_kaliurang_baselineA` | `splat-count-bound` | Medium | p95 frame time 1009.7 ms, 1,178,520 active splats, WebGPU, bytes10s equals bytes30s, assetLoadedMs 559.7. |
| `2026-06-06T13-36-02-781Z_kaliurang_baselineA` | `unknown` | High that it is inconclusive | One frame row over 322.989 s; likely stalled/background-throttled. |

Interpretation:

- Current evidence does not show bundled SOG download size as the dominant bottleneck.
- Current evidence suggests rendering all splats is too expensive in the tested desktop/in-app browser path.
- The evidence cannot yet distinguish fill-rate-bound, sorting-bound, shader/backend-bound, or memory-bound because no controlled sweeps exist.

## Experiment A: Importance Sidecar

Status: not benchmarked.

Feasibility:

- Sidecar is SOG-compatible because it can live next to SOG or Streamed SOG metadata without changing SOG decoding.
- With only bundled SOG and no decoded per-splat data, current sidecar generation can only be coarse scene/route metadata.
- A meaningful per-splat or per-chunk importance sidecar needs either source PLY or a supported SOG decode/export path.

Evidence needed before claims:

- Generate sidecar from source PLY or streamed chunks.
- Use it to influence LOD/chunk selection without modifying SOG decoder.
- Compare against bundled SOG and default Streamed SOG on the same scene.

## Experiment B: Route-Aware LOD Levels

Status: script scaffold exists, but no real-scene benchmark.

Feasibility:

- The existing `visibility-decimate.mjs` route-aware decimator works on PLY.
- `kaliurang` currently lacks source PLY, so this cannot be run honestly yet.
- Route-aware LOD is more justified than a new format because it targets the observed splat-count bottleneck while preserving Streamed SOG compatibility.

Evidence needed:

- Obtain PLY source or reliable SOG-to-PLY conversion.
- Build naive 50/25/10% LOD chain and route-aware LOD chain.
- Package both as Streamed SOG and compare Baseline B.

## Experiment C: SH Tiering

Status: payload artifact generated; runtime result not successfully saved.

Feasibility:

- Higher-order SH payload for `kaliurang` is 3,709,958 bytes (`shN_centroids.webp` + `shN_labels.webp`), about 20.72% of total SOG.
- All SH payload including SH0 is 7,276,708 bytes, about 40.64% of total SOG.
- SplatTransform successfully generated a SH0-only SOG variant from bundled SOG with `--filter-harmonics 0`.
- The SH0-only SOG is 14,071,473 bytes, a 21.40% size reduction from the original 17,903,258-byte SOG.
- A SH0 startup or higher-order SH deferral could reduce early bytes, but PlayCanvas SOG currently expects the SOG payload as defined. A staged higher-order-SH lazy load may require SOG-X or separate compatible variants.
- A desktop in-app browser SH0 runtime attempt saved an inconclusive result with one frame row and no screenshot, so no runtime speedup is claimed.

Evidence needed:

- Generate SH0-only SOG from PLY or SplatTransform-supported source.
- Compare first visible frame, bytes, FPS, and visual artifacts.
- Only propose SH-tier SOG-X if startup benefits outweigh complexity.

## Experiment D: Room/Zone Chunking

Status: not benchmarked.

Feasibility:

- This is likely useful for property tours, but requires spatial segmentation or room labels.
- SOG-compatible route: generate multiple SOG/Streamed SOG assets per zone and load/unload them in PlayCanvas.
- New format is not required for a first experiment.

Evidence needed:

- Source PLY or chunkable streamed representation.
- Zone definitions or spatial clustering.
- Compare memory, active splats, and p95 frame time against bundled and Streamed SOG.

## Experiment E: Preview/Impostor Startup

Status: not benchmarked.

Feasibility:

- A preview image/panorama can reduce perceived time to usable view without touching SOG.
- This is the most plausible path to a 10x improvement in time-to-first-usable-view, but only because the metric changes from full splat rendering to preview availability.
- It does not reduce steady-state splat rendering cost by itself.

Evidence needed:

- Generate a fixed route preview frame or panorama.
- Measure time to first usable view separately from first splat-visible frame.
- Compare against bundled SOG and Streamed SOG.

## Is SOG the Bottleneck?

Current answer: not primarily, based on available evidence.

The strongest saved run loaded about 17.9 MB and reached first visible frame in 1.76 s, but then rendered at about 1 FPS with 1.18M active splats. That makes a pure file-format compression effort unlikely to solve the mobile playback target. The first target should be active splat reduction, route-aware LOD, streaming policy, DPR/fill-rate control, and possibly preview startup.

## Is a New Format Justified?

Not yet.

A SOG-X proposal should wait until these are benchmarked:

1. Default Streamed SOG Baseline B.
2. Naive vs route-aware Streamed SOG LOD.
3. SH0/SH-tier variants.
4. Zone/chunked multi-SOG or Streamed SOG assets.
5. Preview/impostor startup.

## Plausibility

| Improvement target | Current plausibility | Why |
| --- | --- | --- |
| 2x total file-size improvement over SOG | Low without quality loss | SOG is already 15.19 bytes/Gaussian. SH0-only SOG saved 21.40%, not 2x. |
| 2x FPS improvement | Plausible through splat-count/LOD reduction | Current bottleneck points to active splats/rendering workload. |
| 10x total file-size improvement | Unlikely for same-quality full scene | Would require aggressive pruning, lower quality, or very different scene representation. |
| 10x time-to-first-usable-view | Plausible with preview/impostor startup | A small preview can appear much earlier than full splat render, but it is not equivalent full-quality SOG playback. |

## Recommended Next Build

Build Streamed SOG Baseline B for `kaliurang` or another property scene from source PLY, then compare:

1. Bundled SOG Baseline A.
2. Default Streamed SOG Baseline B.
3. Naive decimated Streamed SOG.
4. Route-aware decimated Streamed SOG.
5. SH0 variant.

Do this before any new format work.
