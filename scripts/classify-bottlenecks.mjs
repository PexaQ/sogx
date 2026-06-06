import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

const resultsDir = resolve(args.resultsDir ?? 'benchmarks/results');
const analysisDir = resolve(args.outDir ?? 'benchmarks/analysis');
const files = (await readdir(resultsDir))
  .filter((file) => file.endsWith('_summary.json'))
  .sort();
const rows = [];

for (const file of files) {
  const result = JSON.parse(await readFile(join(resultsDir, file), 'utf8'));
  rows.push(classify(result, file));
}

await mkdir(analysisDir, { recursive: true });
await writeFile(join(analysisDir, 'bottleneck-classification.csv'), toCsv(rows));
await writeFile(join(analysisDir, 'bottleneck-classification.json'), `${JSON.stringify(rows, null, 2)}\n`);

console.log(`Classified ${rows.length} result(s).`);
console.log(join(analysisDir, 'bottleneck-classification.csv'));

function classify(result, file) {
  const summary = result.summary ?? {};
  const config = result.config ?? {};
  const device = result.device ?? {};
  const sampleCount = summary.sampleCount ?? result.sampleCount ?? null;
  const duration = summary.durationSeconds ?? null;
  const configuredDuration = config.durationSeconds ?? null;
  const avgFps = summary.avgFps ?? null;
  const p95 = summary.p95FrameMs ?? null;
  const p99 = summary.p99FrameMs ?? null;
  const firstVisible = summary.firstVisibleFrameMs ?? null;
  const activeSplats = summary.finalActiveSplats ?? null;
  const bytes10s = summary.bytes10s ?? null;
  const bytes30s = summary.bytes30s ?? null;
  const renderer = summary.finalRenderer ?? null;
  const graphicsDeviceType = device.graphicsDeviceType ?? null;
  const appReady = summary.appReadyMs ?? null;
  const assetLoaded = summary.assetLoadedMs ?? null;
  const warnings = [];
  const evidence = [];
  let bottleneckClass = 'unknown';
  let confidence = 'low';

  if (sampleCount !== null && duration !== null && sampleCount < Math.max(2, duration / 2)) {
    bottleneckClass = 'unknown';
    confidence = 'high';
    warnings.push('Run appears stalled or background-throttled; do not infer rendering bottleneck.');
    evidence.push(`sampleCount=${sampleCount} over durationSeconds=${duration}`);
  } else if (configuredDuration !== null && firstVisible !== null && firstVisible > configuredDuration * 1000) {
    bottleneckClass = 'unknown';
    confidence = 'high';
    warnings.push('First visible frame occurred after configured duration.');
    evidence.push(`firstVisibleFrameMs=${firstVisible}`);
  } else if (p95 !== null && p95 > 2 * 41.7 && activeSplats !== null && activeSplats > 1000000) {
    bottleneckClass = 'splat-count-bound';
    confidence = 'medium';
    evidence.push(`p95FrameMs=${p95}`);
    evidence.push(`activeSplats=${activeSplats}`);
    evidence.push(`renderer=${renderer}`);
    evidence.push(`graphicsDeviceType=${graphicsDeviceType}`);
    warnings.push('Evidence shows slow rendering with many active splats, but does not isolate sorting vs fill rate vs shader/backend.');
  } else if (firstVisible !== null && assetLoaded !== null && firstVisible - assetLoaded > 1500 && bytes10s !== null) {
    bottleneckClass = 'decode-bound';
    confidence = 'low';
    evidence.push(`assetLoadedMs=${assetLoaded}`);
    evidence.push(`firstVisibleFrameMs=${firstVisible}`);
  } else if (firstVisible !== null && bytes10s !== null && bytes10s > 50 * 1024 * 1024) {
    bottleneckClass = 'download-bound';
    confidence = 'low';
    evidence.push(`bytes10s=${bytes10s}`);
    evidence.push(`firstVisibleFrameMs=${firstVisible}`);
  }

  if (bytes10s !== null && bytes30s !== null && bytes10s === bytes30s) {
    evidence.push('bytes10s equals bytes30s; no continued streaming observed.');
  }
  if (assetLoaded !== null) {
    evidence.push(`assetLoadedMs=${assetLoaded}`);
  }
  if (appReady !== null) {
    evidence.push(`appReadyMs=${appReady}`);
  }

  return {
    file,
    runId: result.runId ?? summary.runId ?? '',
    scene: summary.scene ?? config.scene ?? '',
    method: summary.method ?? config.method ?? '',
    deviceRole: graphicsDeviceType ? 'desktop-harness' : 'unknown',
    renderer,
    graphicsDeviceType,
    avgFps,
    p95FrameMs: p95,
    p99FrameMs: p99,
    firstVisibleFrameMs: firstVisible,
    activeSplats,
    bytes10s,
    bytes30s,
    sampleCount,
    visualSanityNonEmpty: result.visualSanity?.nonEmptyCanvas ?? null,
    bottleneckClass,
    confidence,
    evidence: evidence.join(' | '),
    warnings: warnings.join(' | ')
  };
}

function toCsv(data) {
  const columns = [
    'file',
    'runId',
    'scene',
    'method',
    'deviceRole',
    'renderer',
    'graphicsDeviceType',
    'avgFps',
    'p95FrameMs',
    'p99FrameMs',
    'firstVisibleFrameMs',
    'activeSplats',
    'bytes10s',
    'bytes30s',
    'sampleCount',
    'visualSanityNonEmpty',
    'bottleneckClass',
    'confidence',
    'evidence',
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

function printHelp() {
  console.log(`Usage:
  node scripts/classify-bottlenecks.mjs [--resultsDir benchmarks/results] [--outDir benchmarks/analysis]

Writes:
  benchmarks/analysis/bottleneck-classification.csv
  benchmarks/analysis/bottleneck-classification.json
`);
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
