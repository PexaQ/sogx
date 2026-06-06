import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { copyFile, mkdir, open, readFile, readdir, stat, symlink, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { inflateRawSync } from 'node:zlib';

const args = parseArgs(process.argv.slice(2));

if (args.help || !args.input || !args.name) {
  printHelp();
  process.exit(args.help ? 0 : 1);
}

const root = process.cwd();
const input = resolve(args.input);
const sceneName = sanitizeSceneName(args.name);
const sceneType = args.type ?? 'unknown';
const shouldCopy = readBool(args.copy, true);
const licenseArg = args.license ?? null;
const sourceNotes = args.sourceNotes ?? '';
const assetKind = detectAssetKind(input);
const publicSceneDir = join(root, 'viewer', 'public', 'assets', 'scenes', sceneName);
const scenesPath = join(root, 'datasets', 'scenes.json');

const inputStats = await stat(input);
const metadata = await inspectAsset(input, assetKind);
const target = targetForAsset(publicSceneDir, assetKind);

if (shouldCopy) {
  await mkdir(publicSceneDir, { recursive: true });
  if (assetKind === 'sog-directory' || assetKind === 'streamed-sog') {
    await copyDirectory(dirname(input), publicSceneDir);
  } else {
    await copyFile(input, target.filePath);
  }
} else if (args.link === 'true') {
  await mkdir(publicSceneDir, { recursive: true });
  await symlink(input, target.filePath);
}

const sceneRecord = {
  sceneName,
  type: sceneType,
  sourcePath: input,
  publicAssetUrl: target.publicAssetUrl,
  assetKind,
  fileSizeBytes: inputStats.size,
  sha256: await sha256File(input),
  splatCount: metadata.splatCount,
  hasSH: metadata.hasSH,
  hasLOD: metadata.hasLOD,
  license: licenseArg ?? metadata.license ?? 'unknown',
  sourceNotes,
  createdAt: new Date().toISOString(),
  ingestionStatus: shouldCopy ? 'ingested-copied' : args.link === 'true' ? 'ingested-linked' : 'metadata-only',
  conversionCommands: assetKind === 'ply' ? conversionCommands(input, sceneName) : [],
  metadataNotes: metadata.notes
};

await mkdir(dirname(scenesPath), { recursive: true });
const scenes = await readScenes(scenesPath);
const nextScenes = [
  ...scenes.filter((scene) => scene.sceneName !== sceneName),
  sceneRecord
].sort((a, b) => a.sceneName.localeCompare(b.sceneName));
await writeFile(scenesPath, `${JSON.stringify(nextScenes, null, 2)}\n`);

console.log(JSON.stringify(sceneRecord, null, 2));
if (sceneRecord.conversionCommands.length) {
  console.log('\nPLY conversion commands:');
  for (const command of sceneRecord.conversionCommands) {
    console.log(command);
  }
}

function printHelp() {
  console.log(`Usage:
  node scripts/ingest-scene.mjs --input "path/to/source.ply-or-sog" --name "scene-name" --type property-indoor --copy true

Options:
  --input          Source .ply, .sog, meta.json, or lod-meta.json.
  --name           Scene id written to datasets/scenes.json and viewer assets.
  --type           Scene class, for example property-indoor.
  --copy           true by default. Copies asset or asset directory into viewer/public/assets/scenes/<name>/.
  --link           false by default. Use only when copy=false and a local symlink is desired.
  --license        Optional license string. If omitted, .sog license.txt is used when present.
  --sourceNotes    Optional free-text provenance notes.
  --help           Show this help.
`);
}

function detectAssetKind(file) {
  const base = basename(file).toLowerCase();
  const ext = extname(file).toLowerCase();
  if (base === 'lod-meta.json') {
    return 'streamed-sog';
  }
  if (base === 'meta.json') {
    return 'sog-directory';
  }
  if (ext === '.sog') {
    return 'bundled-sog';
  }
  if (ext === '.ply') {
    return 'ply';
  }
  throw new Error(`Unsupported scene input type: ${file}`);
}

function targetForAsset(publicSceneDir, assetKind) {
  if (assetKind === 'bundled-sog') {
    return {
      filePath: join(publicSceneDir, 'scene.sog'),
      publicAssetUrl: `/assets/scenes/${basename(publicSceneDir)}/scene.sog`
    };
  }
  if (assetKind === 'ply') {
    return {
      filePath: join(publicSceneDir, 'scene.ply'),
      publicAssetUrl: `/assets/scenes/${basename(publicSceneDir)}/scene.ply`
    };
  }
  if (assetKind === 'streamed-sog') {
    return {
      filePath: join(publicSceneDir, 'lod-meta.json'),
      publicAssetUrl: `/assets/scenes/${basename(publicSceneDir)}/lod-meta.json`
    };
  }
  return {
    filePath: join(publicSceneDir, 'meta.json'),
    publicAssetUrl: `/assets/scenes/${basename(publicSceneDir)}/meta.json`
  };
}

async function inspectAsset(file, assetKind) {
  if (assetKind === 'bundled-sog') {
    return inspectSog(file);
  }
  if (assetKind === 'ply') {
    return inspectPly(file);
  }
  if (assetKind === 'sog-directory' || assetKind === 'streamed-sog') {
    return inspectJsonMeta(file, assetKind);
  }
  return {
    splatCount: null,
    hasSH: null,
    hasLOD: null,
    license: null,
    notes: []
  };
}

async function inspectSog(file) {
  const metaText = await readZipText(file, 'meta.json');
  const licenseText = await readZipText(file, 'license.txt');
  const meta = metaText ? JSON.parse(metaText) : {};
  return {
    splatCount: readCount(meta),
    hasSH: Boolean(meta.shN || meta.sh0),
    hasLOD: false,
    license: licenseText ? licenseText.trim() : null,
    notes: [
      meta.asset?.generator ? `generator=${meta.asset.generator}` : null,
      meta.version ? `sogVersion=${meta.version}` : null
    ].filter(Boolean)
  };
}

async function inspectPly(file) {
  const header = await readPlyHeader(file);
  const vertexLine = header.split(/\r?\n/).find((line) => line.startsWith('element vertex '));
  const splatCount = vertexLine ? Number(vertexLine.split(/\s+/)[2]) : null;
  return {
    splatCount: Number.isFinite(splatCount) ? splatCount : null,
    hasSH: /property\s+\w+\s+f_rest_/i.test(header),
    hasLOD: false,
    license: null,
    notes: ['PLY source requires SplatTransform conversion for bundled or streamed SOG baselines.']
  };
}

async function inspectJsonMeta(file, assetKind) {
  const meta = JSON.parse(await readFile(file, 'utf8'));
  return {
    splatCount: readCount(meta),
    hasSH: Boolean(meta.shN || meta.sh0),
    hasLOD: assetKind === 'streamed-sog' || Boolean(meta.lods || meta.levels || meta.chunks),
    license: null,
    notes: []
  };
}

function readCount(meta) {
  for (const key of ['count', 'numSplats', 'splatCount', 'totalSplats']) {
    if (Number.isFinite(meta?.[key])) {
      return meta[key];
    }
  }
  return null;
}

async function readZipText(file, targetName) {
  const buffer = await readFile(file);
  const entries = readZipEntries(buffer);
  const entry = entries.find((item) => item.name === targetName);
  if (!entry) {
    return null;
  }
  const data = readZipEntryData(buffer, entry);
  return data.toString('utf8');
}

function readZipEntries(buffer) {
  const eocdSignature = 0x06054b50;
  let eocd = -1;
  for (let index = buffer.length - 22; index >= Math.max(0, buffer.length - 66000); index -= 1) {
    if (buffer.readUInt32LE(index) === eocdSignature) {
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

async function readPlyHeader(file) {
  const handle = await open(file, 'r');
  try {
    const chunks = [];
    let position = 0;
    while (position < 1024 * 1024) {
      const buffer = Buffer.alloc(65536);
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, position);
      if (!bytesRead) {
        break;
      }
      chunks.push(buffer.subarray(0, bytesRead));
      const text = Buffer.concat(chunks).toString('utf8');
      const end = text.indexOf('end_header');
      if (end >= 0) {
        return text.slice(0, end + 'end_header'.length);
      }
      position += bytesRead;
    }
    throw new Error('PLY header not found within first 1 MiB');
  } finally {
    await handle.close();
  }
}

async function sha256File(file) {
  return new Promise((resolveHash, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(file);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolveHash(hash.digest('hex')));
    stream.on('error', reject);
  });
}

async function copyDirectory(source, target) {
  await mkdir(target, { recursive: true });
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const sourcePath = join(source, entry.name);
    const targetPath = join(target, entry.name);
    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath);
    } else if (entry.isFile()) {
      await copyFile(sourcePath, targetPath);
    }
  }
}

function conversionCommands(file, sceneNameForCommand) {
  return [
    `node scripts/convert/generate-baselines.mjs --input "${file}" --out "datasets/processed/${sceneNameForCommand}"`,
    `node scripts/convert/generate-baselines.mjs --input "${file}" --out "datasets/processed/${sceneNameForCommand}" --route "viewer/public/routes/orbit-demo.json" --visibilityKeep 25%`
  ];
}

async function readScenes(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

function sanitizeSceneName(value) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
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
