import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { inflateRawSync } from 'node:zlib';

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

const scenesPath = resolve(args.scenes ?? 'datasets/scenes.json');
const outDir = resolve(args.outDir ?? 'benchmarks/analysis');
const scenes = JSON.parse(await readFile(scenesPath, 'utf8'));
const rows = [];

for (const scene of scenes) {
  if (scene.assetKind !== 'bundled-sog') {
    continue;
  }
  rows.push(await analyzeSog(resolve(scene.sourcePath), scene));
}

await mkdir(outDir, { recursive: true });
await writeFile(join(outDir, 'sog-size-breakdown.json'), `${JSON.stringify(rows, null, 2)}\n`);
await writeFile(join(outDir, 'sog-size-breakdown.csv'), toCsv(rows));

console.log(`Analyzed ${rows.length} bundled SOG scene(s).`);
console.log(join(outDir, 'sog-size-breakdown.json'));
console.log(join(outDir, 'sog-size-breakdown.csv'));

async function analyzeSog(file, scene) {
  const buffer = await readFile(file);
  const entries = readZipEntries(buffer);
  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  const meta = JSON.parse(readEntryText(buffer, byName.get('meta.json')) ?? '{}');
  const count = readCount(meta) ?? scene.splatCount ?? null;
  const totalSogSize = buffer.length;
  const sh0Size = sizeOf(byName, 'sh0.webp');
  const shNCentroidsSize = sizeOf(byName, 'shN_centroids.webp');
  const shNLabelsSize = sizeOf(byName, 'shN_labels.webp');
  const shBytes = sh0Size + shNCentroidsSize + shNLabelsSize;
  const attributeBytes = [
    'means_l.webp',
    'means_u.webp',
    'scales.webp',
    'quats.webp',
    'sh0.webp',
    'shN_centroids.webp',
    'shN_labels.webp'
  ].reduce((sum, name) => sum + sizeOf(byName, name), 0);
  const nonShAttributeBytes = Math.max(0, attributeBytes - shBytes);
  const sourcePlySize = scene.sourcePlyPath ? await fileSizeOrNull(resolve(scene.sourcePlyPath)) : null;

  return {
    sceneName: scene.sceneName,
    sourcePath: file,
    totalSogSize,
    metaJsonSize: sizeOf(byName, 'meta.json'),
    licenseTxtSize: sizeOf(byName, 'license.txt'),
    meansLWebpSize: sizeOf(byName, 'means_l.webp'),
    meansUWebpSize: sizeOf(byName, 'means_u.webp'),
    scalesWebpSize: sizeOf(byName, 'scales.webp'),
    quatsWebpSize: sizeOf(byName, 'quats.webp'),
    sh0WebpSize: sh0Size,
    shNCentroidsWebpSize: shNCentroidsSize,
    shNLabelsWebpSize: shNLabelsSize,
    gaussianCount: count,
    bytesPerGaussian: count ? round(totalSogSize / count, 6) : null,
    attributeBytes,
    shBytes,
    nonShAttributeBytes,
    shToNonShAttributeRatio: nonShAttributeBytes ? round(shBytes / nonShAttributeBytes, 6) : null,
    shShareOfSog: totalSogSize ? round(shBytes / totalSogSize, 6) : null,
    sourcePlySize,
    compressionRatioVsSourcePly: sourcePlySize ? round(sourcePlySize / totalSogSize, 6) : null,
    hasSH: Boolean(meta.sh0 || meta.shN),
    shBands: meta.shN?.bands ?? 0,
    generator: meta.asset?.generator ?? null,
    sogVersion: meta.version ?? null,
    entries: entries.map((entry) => ({
      name: entry.name,
      compressedSize: entry.compressedSize,
      uncompressedSize: entry.uncompressedSize,
      compressionMethod: entry.method
    }))
  };
}

function sizeOf(map, name) {
  return map.get(name)?.compressedSize ?? 0;
}

function readCount(meta) {
  for (const key of ['count', 'numSplats', 'splatCount', 'totalSplats']) {
    if (Number.isFinite(meta?.[key])) {
      return meta[key];
    }
  }
  return null;
}

async function fileSizeOrNull(file) {
  try {
    const { stat } = await import('node:fs/promises');
    return (await stat(file)).size;
  } catch {
    return null;
  }
}

function readEntryText(buffer, entry) {
  if (!entry) {
    return null;
  }
  return readZipEntryData(buffer, entry).toString('utf8');
}

function readZipEntries(buffer) {
  let eocd = -1;
  for (let index = buffer.length - 22; index >= Math.max(0, buffer.length - 66000); index -= 1) {
    if (buffer.readUInt32LE(index) === 0x06054b50) {
      eocd = index;
      break;
    }
  }
  if (eocd < 0) {
    throw new Error('ZIP end-of-central-directory record not found');
  }

  const totalEntries = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries = [];

  for (let i = 0; i < totalEntries; i += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error('Invalid ZIP central directory record');
    }
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
    entries.push({ name, method, compressedSize, uncompressedSize, localHeaderOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

function readZipEntryData(buffer, entry) {
  const offset = entry.localHeaderOffset;
  if (buffer.readUInt32LE(offset) !== 0x04034b50) {
    throw new Error(`Invalid ZIP local header for ${entry.name}`);
  }
  const nameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  const dataStart = offset + 30 + nameLength + extraLength;
  const compressed = buffer.subarray(dataStart, dataStart + entry.compressedSize);
  if (entry.method === 0) {
    return compressed;
  }
  if (entry.method === 8) {
    return inflateRawSync(compressed);
  }
  throw new Error(`Unsupported ZIP compression method ${entry.method} for ${entry.name}`);
}

function toCsv(data) {
  const columns = [
    'sceneName',
    'totalSogSize',
    'metaJsonSize',
    'licenseTxtSize',
    'meansLWebpSize',
    'meansUWebpSize',
    'scalesWebpSize',
    'quatsWebpSize',
    'sh0WebpSize',
    'shNCentroidsWebpSize',
    'shNLabelsWebpSize',
    'gaussianCount',
    'bytesPerGaussian',
    'attributeBytes',
    'shBytes',
    'nonShAttributeBytes',
    'shToNonShAttributeRatio',
    'shShareOfSog',
    'sourcePlySize',
    'compressionRatioVsSourcePly',
    'hasSH',
    'shBands',
    'generator',
    'sogVersion',
    'sourcePath'
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

function round(value, places) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function printHelp() {
  console.log(`Usage:
  node scripts/analyze-sog-payloads.mjs [--scenes datasets/scenes.json] [--outDir benchmarks/analysis]

Writes:
  benchmarks/analysis/sog-size-breakdown.json
  benchmarks/analysis/sog-size-breakdown.csv
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
