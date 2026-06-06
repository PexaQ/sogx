import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

const resultsDir = resolve(args.resultsDir ?? 'benchmarks/results');
const analysisDir = resolve(args.outDir ?? 'benchmarks/analysis');
const sceneFilter = args.scene ?? null;

await mkdir(analysisDir, { recursive: true });

const files = existsSync(resultsDir)
  ? (await readdir(resultsDir)).filter((file) => file.endsWith('_summary.json')).sort()
  : [];

const rows = [];
for (const file of files) {
  const result = JSON.parse(await readFile(join(resultsDir, file), 'utf8'));
  const row = await summarizeResult(file, result);
  if (!sceneFilter || row.scene === sceneFilter) {
    rows.push(row);
  }
}
const researchRows = rows.filter((row) => row.researchBenchmark);

const comparison = {
  createdAt: new Date().toISOString(),
  resultsDir,
  sceneFilter,
  runCount: rows.length,
  researchRunCount: researchRows.length,
  thresholds: {
    fps12: bestQualityAt(researchRows, 12),
    fps18: bestQualityAt(researchRows, 18),
    fps24: bestQualityAt(researchRows, 24),
    fps30: bestQualityAt(researchRows, 30)
  },
  smallestBudgetVisuallyNonEmpty: smallestBudgetVisuallyNonEmpty(researchRows),
  bestByFps: bestBy(researchRows, (row) => row.avgFps, 'max'),
  bestByP95FrameMs: bestBy(researchRows, (row) => row.p95FrameMs, 'min'),
  bestByFirstVisibleFrameMs: bestBy(researchRows, (row) => row.firstVisibleFrameMs, 'min'),
  bestByBalancedScore: bestBy(researchRows, balancedScore, 'max'),
  notes: [
    'Visual sanity is a crude non-empty canvas check, not a perceptual quality metric.',
    'Rows with very low sample counts or black canvas sanity should be treated as harness evidence only.',
    'Assetless smoke rows are retained in the table but excluded from threshold and best-config calculations.'
  ],
  rows
};

await writeFile(join(analysisDir, 'active-splat-envelope.json'), `${JSON.stringify(comparison, null, 2)}\n`);
await writeFile(join(analysisDir, 'active-splat-envelope.csv'), toCsv(rows));
await writeFile(join(analysisDir, 'kaliurang-method-comparison.json'), `${JSON.stringify(comparison, null, 2)}\n`);
await writeFile(join(analysisDir, 'kaliurang-method-comparison.csv'), toCsv(rows));

console.log(`Analyzed ${rows.length} result(s).`);
console.table(rows.map((row) => ({
  file: row.resultFile,
  scene: row.scene,
  variant: row.variant,
  mode: row.mode,
  fps: row.avgFps,
  p95: row.p95FrameMs,
  budget: row.splatBudget,
  active: row.activeSplatCount,
  class: row.classification,
  visual: row.visualSanityNonEmpty
})));
console.log(join(analysisDir, 'active-splat-envelope.csv'));

async function summarizeResult(file, result) {
  const config = result.config ?? {};
  const summary = result.summary ?? {};
  const device = result.device ?? {};
  const frameFile = findFrameFile(file, result.runId ?? summary.runId ?? '');
  const csvRows = frameFile ? await countCsvRows(join(resultsDir, frameFile)) : 0;
  const assetUrl = summary.assetUrl ?? config.assetUrl ?? '';
  const activeSplatCount = summary.finalActiveSplats ?? null;
  const fps = numberOrNull(summary.avgFps);
  const p95 = numberOrNull(summary.p95FrameMs);
  const screenshotPath = result.visualSanity?.screenshotFile
    ? join(resultsDir, result.visualSanity.screenshotFile)
    : null;

  return {
    resultFile: file,
    frameFile,
    csvRows,
    scene: summary.scene ?? config.scene ?? 'unknown',
    variant: config.variant ?? parseVariant(assetUrl),
    mode: config.mode ?? summary.method ?? config.method ?? 'unknown',
    method: summary.method ?? config.method ?? 'unknown',
    benchmarkClass: summary.benchmarkClass ?? config.benchmarkClass ?? null,
    researchBenchmark: isResearchBenchmark(config, summary),
    deviceClass: classifyDevice(device),
    userAgent: device.userAgent ?? '',
    renderer: summary.finalRenderer ?? null,
    graphicsDeviceType: device.graphicsDeviceType ?? null,
    averageFps: fps,
    avgFps: fps,
    p50FrameTimeMs: numberOrNull(summary.p50FrameMs),
    p50FrameMs: numberOrNull(summary.p50FrameMs),
    p95FrameTimeMs: p95,
    p95FrameMs: p95,
    p99FrameTimeMs: numberOrNull(summary.p99FrameMs),
    p99FrameMs: numberOrNull(summary.p99FrameMs),
    firstVisibleFrameTimeMs: numberOrNull(summary.firstVisibleFrameMs),
    firstVisibleFrameMs: numberOrNull(summary.firstVisibleFrameMs),
    splatBudget: summary.finalSplatBudget ?? config.splatBudget ?? null,
    splatBudgetAccepted: summary.finalSplatBudgetAccepted ?? null,
    activeSplatCount,
    loadedChunkCount: summary.finalLoadedChunks ?? null,
    totalBytesLoaded: summary.bytes30s ?? summary.bytes10s ?? summary.bytes5s ?? null,
    maxJsHeapUsed: summary.maxJsHeapUsed ?? null,
    finalDpr: summary.finalDpr ?? null,
    lodRangeMin: summary.finalLodRangeMin ?? config.lodRangeMin ?? null,
    lodRangeMax: summary.finalLodRangeMax ?? config.lodRangeMax ?? null,
    lodClampState: summary.finalLodClampState ?? null,
    visualSanityCaptured: result.visualSanity?.captured ?? summary.visualSanity?.captured ?? false,
    visualSanityNonEmpty: result.visualSanity?.nonEmptyCanvas ?? summary.visualSanity?.nonEmptyCanvas ?? null,
    screenshotPath,
    exportMethod: summary.exportMethod ?? result.exportStatus?.method ?? null,
    finishReason: summary.finishReason ?? null,
    droppedFramesOver33_3Ms: summary.droppedFramesOver33_3Ms ?? null,
    droppedFramesOver41_7Ms: summary.droppedFramesOver41_7Ms ?? null,
    classification: classifyFps(fps),
    warnings: warningsFor({ summary, result, csvRows, fps })
  };
}

function classifyFps(fps) {
  if (!Number.isFinite(fps)) {
    return 'unknown';
  }
  if (fps < 12) {
    return 'unusable';
  }
  if (fps < 18) {
    return 'barely usable';
  }
  if (fps < 24) {
    return 'low usable';
  }
  if (fps < 30) {
    return 'usable';
  }
  return 'good';
}

function classifyDevice(device) {
  const ua = device.userAgent ?? '';
  if (/Android/i.test(ua)) {
    return 'android';
  }
  if (device.graphicsDeviceType || /Windows|Macintosh|Linux/i.test(ua)) {
    return 'desktop-harness';
  }
  return 'unknown';
}

function parseVariant(assetUrl) {
  const streamed = /\/streamed\/([^/]+)\//.exec(assetUrl);
  if (streamed) {
    return streamed[1];
  }
  if (/sh0/i.test(assetUrl)) {
    return 'sh0-bundled';
  }
  if (/\.sog$/i.test(assetUrl)) {
    return 'bundled';
  }
  return 'unknown';
}

function warningsFor({ summary, result, csvRows, fps }) {
  const warnings = [];
  if (!isResearchBenchmark(result.config ?? {}, summary)) {
    warnings.push('assetless/smoke result; excluded from research threshold calculations');
  }
  if (summary.finishReason !== 'duration') {
    warnings.push(`finishReason=${summary.finishReason ?? 'missing'}`);
  }
  if (csvRows <= 0) {
    warnings.push('no frame CSV rows');
  }
  if (summary.durationSeconds && csvRows > 0 && csvRows < Math.max(2, summary.durationSeconds / 2)) {
    warnings.push('very low frame row count; possible stall/background throttling');
  }
  const visual = result.visualSanity ?? summary.visualSanity;
  if (!visual?.captured) {
    warnings.push('no visual sanity capture');
  } else if (visual.nonEmptyCanvas !== true) {
    warnings.push('visual sanity did not prove non-empty canvas');
  }
  if (!Number.isFinite(fps)) {
    warnings.push('missing avgFps');
  }
  return warnings.join(' | ');
}

function isResearchBenchmark(config, summary) {
  const assetUrl = summary.assetUrl ?? config.assetUrl ?? '';
  const scene = summary.scene ?? config.scene ?? '';
  if (!assetUrl || config.assetKind === 'none' || assetUrl === 'none') {
    return false;
  }
  if (/tiny|fixture|smoke/i.test(scene) || /tiny_ascii_splat/i.test(assetUrl)) {
    return false;
  }
  return true;
}

function bestQualityAt(rows, fpsThreshold) {
  const eligible = rows
    .filter((row) => Number.isFinite(row.avgFps) && row.avgFps >= fpsThreshold)
    .sort((a, b) => qualityRank(b) - qualityRank(a) || (b.activeSplatCount ?? 0) - (a.activeSplatCount ?? 0));
  return eligible[0] ?? null;
}

function smallestBudgetVisuallyNonEmpty(rows) {
  const eligible = rows
    .filter((row) => row.visualSanityNonEmpty === true && Number.isFinite(row.splatBudget))
    .sort((a, b) => a.splatBudget - b.splatBudget);
  return eligible[0] ?? null;
}

function bestBy(rows, selector, direction) {
  const eligible = rows.filter((row) => Number.isFinite(selector(row)));
  if (!eligible.length) {
    return null;
  }
  return eligible.sort((a, b) => direction === 'min'
    ? selector(a) - selector(b)
    : selector(b) - selector(a))[0];
}

function balancedScore(row) {
  if (!Number.isFinite(row.avgFps)) {
    return null;
  }
  const framePenalty = Number.isFinite(row.p95FrameMs) ? row.p95FrameMs / 41.7 : 10;
  const loadPenalty = Number.isFinite(row.firstVisibleFrameMs) ? row.firstVisibleFrameMs / 2000 : 3;
  const visualPenalty = row.visualSanityNonEmpty === false ? 2 : row.visualSanityNonEmpty === null ? 1 : 0;
  return row.avgFps - framePenalty - loadPenalty - visualPenalty;
}

function qualityRank(row) {
  const budget = Number.isFinite(row.splatBudget) ? row.splatBudget : 0;
  const active = Number.isFinite(row.activeSplatCount) ? row.activeSplatCount : 0;
  const variantRank = {
    bundled: 6,
    naive_original_sh: 5,
    aggressive_original_sh: 4,
    naive_sh0: 3,
    aggressive_sh0: 2,
    route_visibility: 1
  }[row.variant] ?? 0;
  return variantRank * 1e9 + budget + active;
}

function findFrameFile(summaryFile, runId) {
  const candidates = [
    `${runId}_frames.csv`,
    summaryFile.replace(/_summary\.json$/, '_frames.csv')
  ];
  return candidates.find((candidate) => existsSync(join(resultsDir, candidate))) ?? null;
}

async function countCsvRows(file) {
  const text = await readFile(file, 'utf8');
  return Math.max(0, text.trim().split(/\r?\n/).filter(Boolean).length - 1);
}

function numberOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function toCsv(data) {
  const columns = [
    'resultFile',
    'scene',
    'variant',
    'mode',
    'method',
    'researchBenchmark',
    'deviceClass',
    'userAgent',
    'renderer',
    'graphicsDeviceType',
    'avgFps',
    'p50FrameMs',
    'p95FrameMs',
    'p99FrameMs',
    'firstVisibleFrameMs',
    'splatBudget',
    'splatBudgetAccepted',
    'activeSplatCount',
    'loadedChunkCount',
    'totalBytesLoaded',
    'maxJsHeapUsed',
    'finalDpr',
    'lodRangeMin',
    'lodRangeMax',
    'visualSanityCaptured',
    'visualSanityNonEmpty',
    'screenshotPath',
    'exportMethod',
    'finishReason',
    'classification',
    'warnings'
  ];
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
  node scripts/analyze-active-splat-envelope.mjs [--resultsDir benchmarks/results] [--outDir benchmarks/analysis] [--scene kaliurang]

Writes:
  benchmarks/analysis/active-splat-envelope.csv
  benchmarks/analysis/active-splat-envelope.json
  benchmarks/analysis/kaliurang-method-comparison.csv
  benchmarks/analysis/kaliurang-method-comparison.json
`);
}
