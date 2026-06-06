import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

const root = resolve(args.root ?? process.cwd());
const host = args.host ?? 'localhost';
const port = Number(args.port ?? process.env.PORT ?? 4173);
const duration = Number(args.duration ?? 30);
const scene = args.scene ?? 'kaliurang';
const route = args.route ?? 'orbit-demo';
const autoExport = args.autoExport ?? 'server';
const resultEndpoint = args.resultEndpoint ?? '/api/save-run';
const analysisRoot = resolve(root, args.analysisRoot ?? 'benchmarks/analysis');
const streamedAsset = args.asset ?? chooseStreamedAsset(root, scene);

const rows = [];

rows.push(makeRun({
  group: 'A_baselineA_bundled',
  label: `${scene}_baselineA_bundled_sog_default`,
  asset: `/assets/scenes/${scene}/scene.sog`,
  mode: 'baselineA'
}));

if (streamedAsset) {
  rows.push(makeRun({
    group: 'B_baselineB_streamed',
    label: `${scene}_${variantName(streamedAsset)}_baselineB_streamed_sog_default`,
    asset: streamedAsset,
    mode: 'baselineB'
  }));

  for (const budget of [1000000, 750000, 500000, 250000, 150000, 100000, 75000, 50000, 25000]) {
    rows.push(makeRun({
      group: 'C_static_budget_sweep',
      label: `${scene}_${variantName(streamedAsset)}_budget${budget}`,
      asset: streamedAsset,
      mode: `staticBudget_${budget}`
    }));
  }

  for (const clamp of ['default', 'coarseOnly', 'noLOD0', 'noLOD0_noLOD1', 'midOnly']) {
    rows.push(makeRun({
      group: 'D_lod_clamp_sweep',
      label: `${scene}_${variantName(streamedAsset)}_lodClamp_${clamp}`,
      asset: streamedAsset,
      mode: `lodClamp_${clamp}`
    }));
  }
} else {
  rows.push({
    group: 'B_baselineB_streamed',
    label: `${scene}_baselineB_streamed_sog_default`,
    asset: '',
    mode: 'baselineB',
    url: '',
    status: 'missing-streamed-asset',
    note: 'No lod-meta.json found. Run scripts/convert/generate-kaliurang-lods.mjs --execute true first.'
  });
}

for (const asset of [
  `/assets/scenes/${scene}/streamed/naive_original_sh/lod-meta.json`,
  `/assets/scenes/${scene}/streamed/aggressive_original_sh/lod-meta.json`,
  `/assets/scenes/${scene}/streamed/naive_sh0/lod-meta.json`,
  `/assets/scenes/${scene}/streamed/aggressive_sh0/lod-meta.json`
]) {
  if (publicAssetExists(root, asset)) {
    rows.push(makeRun({
      group: 'E_sh0_variant_comparison',
      label: `${scene}_${variantName(asset)}_baselineB`,
      asset,
      mode: 'baselineB'
    }));
  }
}

await mkdir(analysisRoot, { recursive: true });
await writeFile(join(analysisRoot, `${scene}-matrix.json`), `${JSON.stringify(rows, null, 2)}\n`);
await writeFile(join(analysisRoot, `${scene}-matrix.csv`), toCsv(rows));

printRows(rows);
console.log(`\nWrote ${join(analysisRoot, `${scene}-matrix.json`)}`);
console.log(`Wrote ${join(analysisRoot, `${scene}-matrix.csv`)}`);

function makeRun({ group, label, asset, mode }) {
  return {
    group,
    label,
    scene,
    asset,
    mode,
    resultName: label,
    duration,
    status: publicAssetExists(root, asset) ? 'ready' : 'asset-missing',
    url: buildUrl({ asset, mode, resultName: label })
  };
}

function buildUrl({ asset, mode, resultName }) {
  const query = new URLSearchParams({
    scene,
    asset,
    mode,
    duration: String(duration),
    autoStart: 'true',
    autoExport,
    resultEndpoint,
    route,
    captureScreenshot: 'true',
    resultName
  });
  return `http://${host}:${port}/run?${query.toString()}`;
}

function chooseStreamedAsset(repoRoot, sceneName) {
  if (args.asset) {
    return args.asset;
  }
  const candidates = [
    `/assets/scenes/${sceneName}/streamed/aggressive_sh0/lod-meta.json`,
    `/assets/scenes/${sceneName}/streamed/aggressive_original_sh/lod-meta.json`,
    `/assets/scenes/${sceneName}/streamed/naive_original_sh/lod-meta.json`,
    `/assets/scenes/${sceneName}/streamed/naive_sh0/lod-meta.json`,
    `/assets/scenes/${sceneName}/lod-meta.json`
  ];
  return candidates.find((asset) => publicAssetExists(repoRoot, asset)) ?? null;
}

function publicAssetExists(repoRoot, publicUrl) {
  if (!publicUrl) {
    return false;
  }
  const local = join(repoRoot, 'viewer', 'public', publicUrl.replace(/^\/+/, ''));
  return existsSync(local);
}

function variantName(asset) {
  const match = /\/streamed\/([^/]+)\//.exec(asset);
  return match?.[1] ?? 'bundled';
}

function printRows(data) {
  for (const row of data) {
    console.log(`\n[${row.group}] ${row.label}`);
    console.log(`status: ${row.status}`);
    if (row.note) {
      console.log(`note: ${row.note}`);
    }
    if (row.url) {
      console.log(row.url);
    }
  }
}

function toCsv(data) {
  const columns = ['group', 'label', 'scene', 'asset', 'mode', 'resultName', 'duration', 'status', 'note', 'url'];
  return [
    columns.join(','),
    ...data.map((row) => columns.map((column) => csvCell(row[column])).join(','))
  ].join('\n');
}

function csvCell(value) {
  if (value === null || value === undefined) {
    return '';
  }
  const text = Array.isArray(value) || typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      continue;
    }
    const key = arg.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    if (i + 1 >= argv.length || argv[i + 1].startsWith('--')) {
      parsed[key] = true;
    } else {
      parsed[key] = argv[i + 1];
      i += 1;
    }
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage:
  node scripts/run-kaliurang-matrix.mjs [--asset /assets/scenes/kaliurang/streamed/aggressive_sh0/lod-meta.json]

Prints desktop benchmark URLs and writes:
  benchmarks/analysis/kaliurang-matrix.json
  benchmarks/analysis/kaliurang-matrix.csv

If no streamed lod-meta.json exists, Baseline B and sweep rows are marked missing instead of faked.
`);
}
