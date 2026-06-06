import { spawnSync } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import { readFile } from 'node:fs/promises';

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

if (!commandOk('adb', ['version'])) {
  console.error('adb was not found on PATH. Install Android Platform Tools or run scripts/print-mobile-url.mjs and open the printed URL manually.');
  process.exit(1);
}

const port = Number(args.port ?? process.env.PORT ?? 4173);
const scene = args.scene ?? 'kaliurang';
const asset = args.asset ?? args.assetUrl ?? await assetForScene(scene);
const host = readBool(args.lan, false) ? (args.host ?? findLanAddress() ?? '127.0.0.1') : '127.0.0.1';
const url = makeRunUrl(host, port, {
  scene,
  asset,
  mode: args.mode ?? 'baselineA',
  duration: Number(args.duration ?? 30),
  autoExport: args.autoExport ?? 'server',
  resultEndpoint: args.resultEndpoint ?? '/api/save-run',
  route: args.route ?? 'orbit-demo'
});

if (host === '127.0.0.1' && readBool(args.reverse, true)) {
  run('adb', ['reverse', `tcp:${port}`, `tcp:${port}`]);
}

run('adb', ['shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', url]);
console.log(url);

async function assetForScene(sceneName) {
  try {
    const scenes = JSON.parse(await readFile('datasets/scenes.json', 'utf8'));
    return scenes.find((item) => item.sceneName === sceneName)?.publicAssetUrl ?? `/assets/scenes/${sceneName}/scene.sog`;
  } catch {
    return `/assets/scenes/${sceneName}/scene.sog`;
  }
}

function makeRunUrl(host, portNumber, params) {
  const query = new URLSearchParams({
    asset: params.asset,
    mode: params.mode,
    scene: params.scene,
    duration: String(params.duration),
    autoStart: 'true',
    autoExport: params.autoExport,
    resultEndpoint: params.resultEndpoint,
    route: params.route
  });
  return `http://${host}:${portNumber}/run?${query.toString()}`;
}

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function commandOk(command, commandArgs) {
  const result = spawnSync(command, commandArgs, { stdio: 'ignore', shell: process.platform === 'win32' });
  return result.status === 0;
}

function findLanAddress() {
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        return entry.address;
      }
    }
  }
  return null;
}

function printHelp() {
  console.log(`Usage:
  node scripts/open-android-chrome.mjs [--scene kaliurang] [--port 4173] [--lan true]

Opens the Phase 2 baseline URL on an attached Android device via adb. By default it runs:
  adb reverse tcp:4173 tcp:4173
  adb shell am start -a android.intent.action.VIEW -d "<url>"
`);
}

function readBool(value, fallback) {
  if (value === undefined) {
    return fallback;
  }
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
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
