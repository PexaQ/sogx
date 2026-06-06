import { networkInterfaces } from 'node:os';
import { readFile } from 'node:fs/promises';

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

const port = Number(args.port ?? process.env.PORT ?? 4173);
const scene = args.scene ?? 'kaliurang';
const mode = args.mode ?? 'baselineA';
const duration = Number(args.duration ?? 30);
const autoExport = args.autoExport ?? 'server';
const resultEndpoint = args.resultEndpoint ?? '/api/save-run';
const route = args.route ?? 'orbit-demo';
const asset = args.asset ?? args.assetUrl ?? await assetForScene(scene);
const resultName = args.resultName ?? `${scene}_${mode}_android`;
const adbUrl = makeRunUrl('127.0.0.1', port, { asset, mode, duration, autoExport, resultEndpoint, route, resultName });
const lanHost = args.host ?? findLanAddress() ?? '<host-ip>';
const lanUrl = makeRunUrl(lanHost, port, { asset, mode, duration, autoExport, resultEndpoint, route, resultName });

console.log('USB ADB reverse route:');
console.log(`adb reverse tcp:${port} tcp:${port}`);
console.log(`adb shell am start -a android.intent.action.VIEW -d "${adbUrl}"`);
console.log(adbUrl);

console.log('\nLAN route:');
console.log(lanUrl);

console.log('\nHealth checks:');
console.log(`http://127.0.0.1:${port}/api/health`);
console.log(`http://${lanHost}:${port}/api/health`);

async function assetForScene(sceneName) {
  const scenes = await readScenes();
  const scene = scenes.find((item) => item.sceneName === sceneName);
  return scene?.publicAssetUrl ?? `/assets/scenes/${sceneName}/scene.sog`;
}

async function readScenes() {
  try {
    return JSON.parse(await readFile('datasets/scenes.json', 'utf8'));
  } catch {
    return [];
  }
}

function makeRunUrl(host, portNumber, params) {
  const query = new URLSearchParams({
    asset: params.asset,
    mode: params.mode,
    scene,
    duration: String(params.duration),
    autoStart: 'true',
    autoExport: params.autoExport,
    resultEndpoint: params.resultEndpoint,
    route: params.route,
    captureScreenshot: 'true',
    resultName: params.resultName
  });
  return `http://${host}:${portNumber}/run?${query.toString()}`;
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
  node scripts/print-mobile-url.mjs [--scene kaliurang] [--asset /assets/scenes/kaliurang/streamed/aggressive_sh0/lod-meta.json] [--mode staticBudget_100000] [--duration 30] [--resultName kaliurang_android_budget100k]

Prints Android Chrome URLs for:
  A. USB ADB reverse through http://127.0.0.1:4173/run
  B. LAN IP through http://<host-ip>:4173/run
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
