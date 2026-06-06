import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join, resolve, extname, dirname } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

const root = resolve(args.root ?? process.cwd());
const sceneName = args.scene ?? 'kaliurang';
const execute = readBool(args.execute, false);
const chunkCount = String(args.chunkCount ?? 512);
const chunkExtent = String(args.chunkExtent ?? 16);
const route = resolve(root, args.route ?? 'viewer/public/routes/orbit-demo.json');
const publicSceneRoot = resolve(root, args.publicSceneRoot ?? `viewer/public/assets/scenes/${sceneName}`);
const processedRoot = resolve(root, args.processedRoot ?? `datasets/processed/${sceneName}/lods`);
const analysisRoot = resolve(root, args.analysisRoot ?? 'benchmarks/analysis');
const sourceOverride = args.input ? resolve(root, args.input) : null;
const only = args.only
  ? new Set(String(args.only).split(',').map((item) => item.trim()).filter(Boolean))
  : null;

const detected = await detectSources(root, sceneName, sourceOverride);
const source = detected.sourcePly ?? detected.sourceSog ?? detected.sourceMeta ?? detected.sourceLodMeta ?? null;
const sourceKind = source ? detectKind(source) : 'missing';
const sourcePlyPreferred = detected.sourcePly ?? null;
const bundledSource = detected.sourceSog ?? null;

await mkdir(analysisRoot, { recursive: true });
if (execute) {
  await mkdir(join(publicSceneRoot, 'bundled'), { recursive: true });
}

const variants = [
  {
    variantName: 'naive_original_sh_lod',
    publicName: 'naive_original_sh',
    targetPercentages: [100, 50, 25, 10, 3, 1],
    shMode: 'original'
  },
  {
    variantName: 'aggressive_original_sh_lod',
    publicName: 'aggressive_original_sh',
    targetPercentages: [100, 25, 10, 5, 2, 1],
    shMode: 'original'
  },
  {
    variantName: 'naive_sh0_lod',
    publicName: 'naive_sh0',
    targetPercentages: [100, 50, 25, 10, 3, 1],
    shMode: 'sh0'
  },
  {
    variantName: 'aggressive_sh0_lod',
    publicName: 'aggressive_sh0',
    targetPercentages: [100, 25, 10, 5, 2, 1],
    shMode: 'sh0'
  },
  {
    variantName: 'route_visibility_lod',
    publicName: 'route_visibility',
    targetPercentages: [100, 25, 10, 5, 2, 1],
    shMode: 'original',
    routeAware: true
  }
].filter((variant) => !only || only.has(variant.variantName) || only.has(variant.publicName));

const report = {
  createdAt: new Date().toISOString(),
  sceneName,
  execute,
  source,
  sourceKind,
  sourcePlyPreferred,
  bundledSource,
  route,
  chunkCount: Number(chunkCount),
  chunkExtent: Number(chunkExtent),
  detected,
  variants: []
};

if (!source) {
  for (const variant of variants) {
    report.variants.push({
      ...baseVariantReport(variant),
      commandStatus: 'missing-source',
      commands: [],
      error: 'No kaliurang source .ply, .sog, meta.json, or lod-meta.json was found.'
    });
  }
} else {
  if (execute && bundledSource) {
    await copyFile(bundledSource, join(publicSceneRoot, 'bundled', `${sceneName}.sog`));
  }

  for (const variant of variants) {
    const variantReport = await prepareVariant(variant, source, sourceKind);
    report.variants.push(variantReport);
  }
}

const jsonPath = join(analysisRoot, `${sceneName}-lod-generation.json`);
const csvPath = join(analysisRoot, `${sceneName}-lod-generation.csv`);
await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
await writeFile(csvPath, toCsv(report.variants));

console.log(`Wrote ${jsonPath}`);
console.log(`Wrote ${csvPath}`);
if (!execute) {
  console.log('Dry-run only. Re-run with --execute true to create LOD files.');
}

async function prepareVariant(variant, selectedSource, selectedKind) {
  const outDir = join(publicSceneRoot, 'streamed', variant.publicName);
  const workDir = join(processedRoot, variant.publicName);
  const lodPaths = variant.targetPercentages.map((pct, index) => join(workDir, `lod${index}_${pctLabel(pct)}.ply`));
  const outputPath = join(outDir, 'lod-meta.json');
  const commands = [];

  if (variant.routeAware && !existsSync(route)) {
    return {
      ...baseVariantReport(variant, outputPath),
      sourceAsset: selectedSource,
      commandStatus: 'skipped',
      commands,
      error: `Route file not found: ${route}`
    };
  }

  if (variant.routeAware) {
    const routeSource = extname(selectedSource).toLowerCase() === '.ply'
      ? selectedSource
      : join(workDir, 'route-source.ply');

    if (routeSource !== selectedSource) {
      commands.push(st(['-w', selectedSource, routeSource]));
    }

    commands.push(st(['-w', selectedSource, lodPaths[0]]));
    variant.targetPercentages.slice(1).forEach((pct, offset) => {
      commands.push(nodeCommand([
        visibilityDecimatorPath(),
        '--input', routeSource,
        '--route', route,
        '--out', lodPaths[offset + 1],
        '--keep', `${pct}%`
      ]));
    });
  } else {
    variant.targetPercentages.forEach((pct, index) => {
      const commandArgs = ['-w', selectedSource];
      if (variant.shMode === 'sh0') {
        commandArgs.push('--filter-harmonics', '0');
      }
      if (pct !== 100) {
        commandArgs.push('--decimate', `${pct}%`);
      }
      commandArgs.push(lodPaths[index]);
      commands.push(st(commandArgs));
    });
  }

  commands.push(st([
    '-w',
    '--lod-chunk-count', chunkCount,
    '--lod-chunk-extent', chunkExtent,
    ...lodPaths.flatMap((lodPath, index) => [lodPath, '--lod', String(index)]),
    outputPath
  ]));

  const result = {
    ...baseVariantReport(variant, outputPath),
    sourceAsset: selectedSource,
    sourceKind: selectedKind,
    sourcePlyRequired: false,
    workDir,
    commands: commands.map((command) => ({
      command: formatCommand(command),
      status: execute ? 'pending' : 'planned'
    })),
    commandStatus: execute ? 'pending' : 'planned'
  };

  if (!execute) {
    result.note = variant.routeAware
      ? 'Planned route-aware LOD commands. This can be slow because it exports/reads a full PLY.'
      : 'Planned SplatTransform LOD commands. SplatTransform supports .sog input according to --help.';
    return result;
  }

  await mkdir(workDir, { recursive: true });
  await mkdir(outDir, { recursive: true });

  try {
    for (let index = 0; index < commands.length; index += 1) {
      const run = await runCommand(commands[index]);
      result.commands[index] = {
        ...result.commands[index],
        status: run.exitCode === 0 ? 'passed' : 'failed',
        exitCode: run.exitCode,
        stdout: truncate(run.stdout),
        stderr: truncate(run.stderr)
      };
      if (run.exitCode !== 0) {
        result.commandStatus = 'failed';
        result.error = run.stderr || run.stdout || `Command failed with exit code ${run.exitCode}`;
        break;
      }
    }

    if (result.commandStatus !== 'failed') {
      result.commandStatus = existsSync(outputPath) ? 'generated' : 'missing-output';
    }
  } catch (error) {
    result.commandStatus = 'failed';
    result.error = error.message;
  }

  result.actualSplatCounts = await Promise.all(lodPaths.map(readPlyVertexCountOrNull));
  result.totalOutputBytes = await directorySizeOrNull(outDir);
  result.bytesPerGaussian = result.actualSplatCounts[0] && result.totalOutputBytes
    ? round(result.totalOutputBytes / result.actualSplatCounts[0], 6)
    : null;
  return result;
}

function baseVariantReport(variant, outputPath = null) {
  return {
    variantName: variant.variantName,
    outputPath,
    lodLevels: variant.targetPercentages.length,
    targetPercentages: variant.targetPercentages,
    actualSplatCounts: [],
    totalOutputBytes: null,
    bytesPerGaussian: null,
    shMode: variant.shMode,
    routeAware: Boolean(variant.routeAware),
    commandStatus: 'uninitialized'
  };
}

async function detectSources(repoRoot, name, override) {
  const candidates = [
    override,
    join(repoRoot, 'datasets', 'raw', name, `${name}.ply`),
    join(repoRoot, 'datasets', 'samples', `${name}.ply`),
    join(repoRoot, 'datasets', 'samples', `${name}.sog`),
    join(repoRoot, 'viewer', 'public', 'assets', 'scenes', name, 'scene.sog'),
    join(repoRoot, 'viewer', 'public', 'assets', 'scenes', name, 'meta.json'),
    join(repoRoot, 'viewer', 'public', 'assets', 'scenes', name, 'lod-meta.json')
  ].filter(Boolean);

  const found = {};
  for (const candidate of candidates) {
    if (!candidate || !existsSync(candidate)) {
      continue;
    }
    const kind = detectKind(candidate);
    if (kind === 'ply' && !found.sourcePly) {
      found.sourcePly = candidate;
    } else if (kind === 'sog' && !found.sourceSog) {
      found.sourceSog = candidate;
    } else if (kind === 'meta-json' && !found.sourceMeta) {
      found.sourceMeta = candidate;
    } else if (kind === 'lod-meta-json' && !found.sourceLodMeta) {
      found.sourceLodMeta = candidate;
    }
  }

  found.existingLodMeta = await findFiles(join(repoRoot, 'viewer', 'public', 'assets', 'scenes', name), 'lod-meta.json');
  return found;
}

function detectKind(file) {
  const lower = file.toLowerCase();
  if (lower.endsWith('.ply')) {
    return 'ply';
  }
  if (lower.endsWith('.sog')) {
    return 'sog';
  }
  if (lower.endsWith('lod-meta.json')) {
    return 'lod-meta-json';
  }
  if (lower.endsWith('meta.json')) {
    return 'meta-json';
  }
  return 'unknown';
}

async function findFiles(dir, filename) {
  if (!existsSync(dir)) {
    return [];
  }
  const found = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...await findFiles(full, filename));
    } else if (entry.name === filename) {
      found.push(full);
    }
  }
  return found;
}

function st(commandArgs) {
  return {
    command: 'npx',
    args: ['--yes', '@playcanvas/splat-transform', ...commandArgs]
  };
}

function nodeCommand(commandArgs) {
  return {
    command: process.execPath,
    args: commandArgs
  };
}

function runCommand(command) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command.command, command.args, {
      cwd: root,
      shell: process.platform === 'win32'
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('exit', (exitCode) => resolveRun({ exitCode, stdout, stderr }));
    child.on('error', reject);
  });
}

async function readPlyVertexCountOrNull(file) {
  try {
    const buffer = await readFile(file);
    const headerEnd = buffer.indexOf(Buffer.from('end_header'));
    if (headerEnd < 0) {
      return null;
    }
    const header = buffer.subarray(0, headerEnd).toString('utf8');
    const match = /^element vertex\s+(\d+)/m.exec(header);
    return match ? Number(match[1]) : null;
  } catch {
    return null;
  }
}

async function directorySizeOrNull(dir) {
  if (!existsSync(dir)) {
    return null;
  }
  let total = 0;
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      total += await directorySizeOrNull(full) ?? 0;
    } else {
      total += (await stat(full)).size;
    }
  }
  return total;
}

function visibilityDecimatorPath() {
  return fileURLToPath(new URL('./visibility-decimate.mjs', import.meta.url));
}

function toCsv(rows) {
  const columns = [
    'variantName',
    'sourceAsset',
    'sourceKind',
    'outputPath',
    'lodLevels',
    'targetPercentages',
    'actualSplatCounts',
    'totalOutputBytes',
    'bytesPerGaussian',
    'shMode',
    'routeAware',
    'sourcePlyRequired',
    'commandStatus',
    'error',
    'commands'
  ];
  return [
    columns.join(','),
    ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(','))
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

function readBool(value, fallback) {
  if (value === undefined) {
    return fallback;
  }
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function pctLabel(value) {
  return `${String(value).replace('.', '_')}pct`;
}

function formatCommand(command) {
  return [command.command, ...command.args].map(quote).join(' ');
}

function quote(value) {
  const text = String(value);
  return /\s/.test(text) ? `"${text.replaceAll('"', '\\"')}"` : text;
}

function truncate(text, maxLength = 4000) {
  if (!text || text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}...<truncated>`;
}

function round(value, places) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function printHelp() {
  console.log(`Usage:
  node scripts/convert/generate-kaliurang-lods.mjs [--execute true] [--input datasets/samples/kaliurang.sog]
  node scripts/convert/generate-kaliurang-lods.mjs --execute true --only aggressive_sh0_lod

Dry-run by default. Writes:
  benchmarks/analysis/kaliurang-lod-generation.json
  benchmarks/analysis/kaliurang-lod-generation.csv

When --execute true is set, writes ignored local assets under:
  viewer/public/assets/scenes/kaliurang/bundled/kaliurang.sog
  viewer/public/assets/scenes/kaliurang/streamed/<variant>/lod-meta.json

Variants:
  naive_original_sh_lod: 100,50,25,10,3,1
  aggressive_original_sh_lod: 100,25,10,5,2,1
  naive_sh0_lod: 100,50,25,10,3,1 with --filter-harmonics 0
  aggressive_sh0_lod: 100,25,10,5,2,1 with --filter-harmonics 0
  route_visibility_lod: route-aware 25,10,5,2,1 when route/PLY conversion is available
`);
}
