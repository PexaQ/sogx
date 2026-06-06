# Benchmark Configs

Method configs will live here as JSON files. Each config should specify:

- Scene id
- Asset type: bundled SOG or streamed SOG
- Route id
- Target FPS
- Renderer request
- Splat budget
- LOD range
- DPR/render scale
- Contribution/pixel culling thresholds
- SH/pruning/offline variant id

Configs should be immutable once used for a paper result.
