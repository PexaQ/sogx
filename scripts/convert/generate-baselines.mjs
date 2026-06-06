import { mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const args = parseArgs(process.argv.slice(2));

if (!args.input || !args.out) {
  console.error('Usage: node scripts/convert/generate-baselines.mjs --input scene.ply --out datasets/processed/scene-id [--route route.json] [--dry-run]');
  process.exit(1);
}

const input = resolve(args.input);
const out = resolve(args.out);
const levels = Number(args.levels ?? 4);
const chunkCount = String(args.chunkCount ?? 512);
const chunkExtent = String(args.chunkExtent ?? 16);
const opacityThreshold = String(args.opacity ?? 0.01);
const route = args.route ? resolve(args.route) : null;
const visibilityKeep = String(args.visibilityKeep ?? '25%');
const dryRun = Boolean(args.dryRun);

const clean = join(out, 'clean', 'clean.ply');
const bundled = join(out, 'bundled', 'scene.sog');
const sh0 = join(out, 'variants', 'scene.sh0.sog');
const pruned = join(out, 'variants', `scene.opacity-${opacityThreshold}.sog`);
const visibilityPly = join(out, 'variants', `scene.visibility-${safeName(visibilityKeep)}.ply`);
const visibilitySog = join(out, 'variants', `scene.visibility-${safeName(visibilityKeep)}.sog`);
const lodDir = join(out, 'lod');
const streamed = join(out, 'streamed', 'lod-meta.json');

await mkdir(join(out, 'clean'), { recursive: true });
await mkdir(join(out, 'bundled'), { recursive: true });
await mkdir(join(out, 'variants'), { recursive: true });
await mkdir(lodDir, { recursive: true });
await mkdir(join(out, 'streamed'), { recursive: true });

const commands = [];

commands.push(st([input, '--filter-nan', clean]));
commands.push(st([clean, bundled]));
commands.push(st([clean, '--filter-harmonics', '0', sh0]));
commands.push(st([clean, '--filter-value', `opacity,gt,${opacityThreshold}`, pruned]));

if (route) {
  commands.push(nodeCommand([
    fileURLToPath(new URL('./visibility-decimate.mjs', import.meta.url)),
    '--input', clean,
    '--route', route,
    '--out', visibilityPly,
    '--keep', visibilityKeep
  ]));
  commands.push(st([visibilityPly, visibilitySog]));
}

const lods = [clean];
for (let i = 1; i < levels; i += 1) {
  const lodPath = join(lodDir, `lod${i}.ply`);
  commands.push(st([lods[i - 1], '--decimate', '50%', lodPath]));
  lods.push(lodPath);
}

const streamedArgs = ['-C', chunkCount, '-X', chunkExtent];
lods.forEach((lodPath, index) => {
  streamedArgs.push(lodPath, '--lod', String(index));
});
streamedArgs.push(streamed);
commands.push(st(streamedArgs));

for (const command of commands) {
  console.log(formatCommand(command));
  if (!dryRun) {
    await run(command);
  }
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

function run(command) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command.command, command.args, { stdio: 'inherit', shell: process.platform === 'win32' });
    child.on('exit', (code) => {
      if (code === 0) {
        resolveRun();
      } else {
        reject(new Error(`${formatCommand(command)} failed with code ${code}`));
      }
    });
    child.on('error', reject);
  });
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

function formatCommand(command) {
  return [command.command, ...command.args].map(quote).join(' ');
}

function quote(value) {
  const text = String(value);
  return /\s/.test(text) ? `"${text.replaceAll('"', '\\"')}"` : text;
}

function safeName(value) {
  return String(value)
    .replaceAll('%', 'pct')
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '');
}
