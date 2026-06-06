# Phase 3 Checklist

Phase: Streamed SOG Baseline B and Active-Splat Envelope

- [x] Inspect existing evidence files, benchmark config, viewer code, conversion scripts, and README.
- [x] Preserve Baseline A as historical bundled SOG evidence.
- [x] Add/verify Baseline B registry entry for default Streamed SOG.
- [x] Add Streamed SOG LOD generation driver for `kaliurang`.
- [x] Add static splat-budget benchmark modes with adaptive controllers disabled.
- [x] Add LOD range clamp benchmark modes with adaptive controllers disabled.
- [x] Add Kaliurang benchmark matrix URL printer.
- [x] Add active-splat envelope analyzer.
- [x] Update mobile URL helper for Phase 3 result names.
- [x] Update docs with Phase 3 status, blockers, and exact commands.
- [ ] Run validation commands and record pass/fail.
- [ ] Upload clean project files to `PexaQ/sogx`, excluding ignored local assets and result binaries.

Open evidence items:

- [ ] Execute at least one LOD generation variant.
- [ ] Run Baseline B on a real `lod-meta.json`.
- [ ] Run static budget sweep.
- [ ] Run LOD clamp sweep.
- [ ] Run Android Chrome benchmark.

Evidence rule: no FPS, runtime, or quality improvement claim is valid unless a saved real-scene benchmark result supports it.
