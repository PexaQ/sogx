# Datasets

Large raw and processed datasets are intentionally not committed by default.

Scene metadata is tracked in `datasets/scenes.json`. Large local binaries, including `.sog` files under `datasets/samples/`, are ignored by git unless explicitly allowed.

Expected local layout:

```text
datasets/
  raw/
    scene-name/
  processed/
    scene-name/
      bundled/
      streamed/
      variants/
```

Every dataset used in a benchmark must have a recorded source URL, license, download date, source format, conversion command, approximate splat count, and redistribution status.

## Candidate Scene Classes

| Class | Scene | Source URL | License | Redistribution | Status |
| --- | --- | --- | --- | --- | --- |
| Small indoor/property | TBD | TBD | TBD | TBD | Needed |
| Medium indoor/property | TBD | TBD | TBD | TBD | Needed |
| Large multi-million | TBD | TBD | TBD | TBD | Needed |

Do not place private or unlicensed scene assets in committed folders.

## Phase 2 Local Scene

`datasets/samples/kaliurang.sog` was provided locally and ingested with:

```powershell
node scripts/ingest-scene.mjs --input "datasets/samples/kaliurang.sog" --name "kaliurang" --type property-indoor --copy true --sourceNotes "Local user-provided bundled SOG scene for Phase 2 Baseline A harness validation."
```

Metadata recorded:

- Scene name: `kaliurang`
- Public asset URL: `/assets/scenes/kaliurang/scene.sog`
- Asset kind: `bundled-sog`
- Size: 17,903,258 bytes
- Splat count: 1,178,520
- SHA256: `a6310167ad40ead5573db74f5231be7f1fed9a8999b85ed64d19d647ad830a75`
- License text from SOG: CC BY 4.0, author credit required

The tiny ASCII PLY fixture remains a script smoke-test asset only. It is not research benchmark data.

## Candidate Scene Shortlist

| Class | Candidate | Source URL | License / use notes | Status |
| --- | --- | --- | --- | --- |
| Small indoor/property | SuperSplat Matterport-derived interior | https://superspl.at/scene/bc23fc76 | Scene page reports CC BY 4.0 download. Attribution required; upstream capture/property rights still need caution. | Candidate |
| Medium indoor/property | SuperSplat single family home in Bellevue WA | https://superspl.at/scene/6f412fa2 | Scene page reports CC BY 4.0 download. Avoid implying property/owner endorsement. | Candidate |
| Large stress scene | SuperSplat International Space Station synthetic scene | https://superspl.at/scene/cc026f6a | Scene page reports CC BY 4.0; creator states 10M Gaussians. Preserve NASA/source attribution chain and endorsement restrictions. | Candidate |
| Backup indoor | SuperSplat Reading Room | https://superspl.at/scene/9d370db9 | Scene page reports CC BY 4.0. | Backup |
| Research-only indoor corpus | InteriorGS | https://huggingface.co/datasets/spatialverse/InteriorGS | Custom terms: non-commercial research/education; no redistribution. | Research-only |
| Canonical large models | GraphDeco/Inria pretrained 3DGS | https://github.com/graphdeco-inria/gaussian-splatting | Non-commercial research/evaluation license; large download. | Research-only |

Before any benchmark claim, record exact downloaded files, license text/date, attribution, splat counts, and conversion commands.
