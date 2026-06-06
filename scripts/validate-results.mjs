import { existsSync } from 'node:fs';
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

const resultsRoot = resolve(args.dir ?? 'benchmarks/results');
await ensureDirectory(resultsRoot);

const jsonFiles = (await readdir(resultsRoot))
  .filter((file) => file.endsWith('.json') && file !== 'validation-summary.json')
  .sort();

if (!jsonFiles.length) {
  console.log(`No JSON results found in ${resultsRoot}`);
  process.exit(0);
}

const rows = [];
let invalidCount = 0;

for (const file of jsonFiles) {
  const fullPath = join(resultsRoot, file);
  try {
    const result = JSON.parse(await readFile(fullPath, 'utf8'));
    const validation = await validateResult(resultsRoot, file, result);
    rows.push(validation);
    if (validation.invalid.length) {
      invalidCount += 1;
    }
  } catch (error) {
    invalidCount += 1;
    rows.push({
      file,
      scene: 'unknown',
      method: 'unknown',
      finishReason: 'parse-error',
      avgFps: null,
      p95FrameMs: null,
      csvRows: 0,
      warnings: [],
      invalid: [error.message]
    });
  }
}

printTable(rows);

const summary = {
  checkedAt: new Date().toISOString(),
  resultsRoot,
  filesChecked: rows.length,
  invalidCount,
  warningCount: rows.reduce((sum, row) => sum + row.warnings.length, 0),
  rows
};

await writeFile(join(resultsRoot, 'validation-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);

console.log(`\nChecked ${rows.length} JSON result(s); invalid=${invalidCount}; warnings=${summary.warningCount}`);
console.log(`Wrote ${join(resultsRoot, 'validation-summary.json')}`);

if (invalidCount > 0) {
  process.exitCode = 1;
}

async function validateResult(root, file, result) {
  const summary = result.summary ?? {};
  const config = result.config ?? {};
  const runId = result.runId ?? summary.runId ?? file.replace(/_summary\.json$|\.json$/g, '');
  const isLegacySmoke = /^smoke-test-/.test(runId) || /^smoke-test-/.test(file);
  const framesFile = frameFileFor(root, runId, file);
  const csvRows = framesFile ? await countCsvRows(join(root, framesFile)) : 0;
  const invalid = [];
  const warnings = [];

  if (isLegacySmoke) {
    warnings.push('legacy collector smoke file; parsed but excluded from Phase 2 schema validity');
  } else {
    for (const key of ['runId', 'config', 'summary']) {
      if (key === 'runId' && !runId) {
        invalid.push('missing runId');
      }
      if (key !== 'runId' && !result[key]) {
        invalid.push(`missing ${key}`);
      }
    }

    if (!result.device) {
      invalid.push('missing device');
    }
  }

  if (summary.finishReason === 'duration' && csvRows <= 0) {
    invalid.push('successful duration run has no frame CSV rows');
  }

  if (summary.finishReason === 'duration' && Number.isFinite(summary.durationSeconds) && csvRows > 0 && csvRows < Math.max(2, summary.durationSeconds / 2)) {
    warnings.push('very low frame row count for duration; likely stalled or background-throttled');
  }

  if (Number.isFinite(summary.firstVisibleFrameMs) && Number.isFinite(config.durationSeconds) && summary.firstVisibleFrameMs > config.durationSeconds * 1000) {
    warnings.push('first visible frame occurred after configured duration; run is visually inconclusive');
  }

  if (config.assetKind === 'none' || config.assetUrl === undefined || config.assetUrl === null || config.assetUrl === '') {
    warnings.push('asset=none or missing asset URL; smoke result only');
  }

  if (/tiny|fixture|smoke/i.test(config.scene ?? '') || /tiny_ascii_splat/i.test(config.assetUrl ?? '')) {
    warnings.push('synthetic fixture; not research benchmark data');
  }

  if (!result.visualSanity || result.visualSanity.captured !== true) {
    warnings.push('no captured screenshot/canvas sanity data');
  } else if (result.visualSanity.nonEmptyCanvas !== true) {
    warnings.push('canvas sanity did not prove non-empty canvas');
  }

  return {
    file,
    scene: summary.scene ?? config.scene ?? 'unknown',
    method: summary.method ?? config.method ?? 'unknown',
    finishReason: summary.finishReason ?? 'unknown',
    avgFps: summary.avgFps ?? null,
    p95FrameMs: summary.p95FrameMs ?? null,
    csvRows,
    warnings,
    invalid
  };
}

function frameFileFor(root, runId, jsonFile) {
  const candidates = [
    `${runId}_frames.csv`,
    `${runId}.csv`,
    jsonFile.replace(/_summary\.json$/, '_frames.csv'),
    jsonFile.replace(/\.json$/, '.csv')
  ];
  return candidates.find((candidate) => existsSync(join(root, candidate))) ?? null;
}

async function countCsvRows(file) {
  const text = await readFile(file, 'utf8');
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  return Math.max(0, lines.length - 1);
}

function printTable(rows) {
  const table = rows.map((row) => ({
    file: row.file,
    scene: row.scene,
    method: row.method,
    finish: row.finishReason,
    fps: row.avgFps ?? '',
    p95: row.p95FrameMs ?? '',
    rows: row.csvRows,
    warnings: row.warnings.length,
    invalid: row.invalid.length
  }));
  console.table(table);

  for (const row of rows) {
    for (const warning of row.warnings) {
      console.warn(`WARN ${row.file}: ${warning}`);
    }
    for (const invalid of row.invalid) {
      console.error(`INVALID ${row.file}: ${invalid}`);
    }
  }
}

async function ensureDirectory(dir) {
  const info = await stat(dir).catch(() => null);
  if (!info?.isDirectory()) {
    throw new Error(`Results directory not found: ${dir}`);
  }
}

function printHelp() {
  console.log(`Usage:
  node scripts/validate-results.mjs [--dir benchmarks/results]

Validates LowEndGS JSON/CSV result pairs, warns on synthetic fixtures or assetless smoke runs, and prints a summary table.
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
