# Phase 2 Checklist

Phase: Evidence Gate: Real Scene Ingestion, Browser QA, and Baseline Results

Rule for this phase: do not add or evaluate new optimization algorithms. Existing candidate code remains available but Baseline A/B evidence comes first.

## Checklist

- [x] Inspect repository and search for real splat assets.
- [x] Add safe viewer/server routes: `/run`, `/api/save-run`, `/api/health`.
- [x] Add export status, server failure diagnostics, and browser download fallback.
- [x] Add minimal canvas visual sanity capture.
- [x] Add `scripts/ingest-scene.mjs` and scene metadata registry.
- [x] Ingest `datasets/samples/kaliurang.sog` as a real bundled SOG scene.
- [x] Run Baseline A for `kaliurang` if local browser execution succeeds.
- [x] Prepare Baseline B commands/status; run only if `lod-meta.json` exists.
- [x] Add result validator and mobile test helper scripts.
- [x] Update research docs, README, and claims/evidence ledger.
- [x] Run required verification commands.

## Initial Finding

`datasets/samples/kaliurang.sog` exists and is a real bundled SOG candidate for Baseline A. It is not a streamed SOG asset; no `lod-meta.json` has been found yet.
