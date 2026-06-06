export function parseBenchmarkConfig(location) {
  const params = new URLSearchParams(location.search);
  const scene = params.get('scene') ?? 'demo';
  const mode = params.get('mode');
  const rawAsset = params.get('asset');
  const directAssetUrl = isDirectAsset(rawAsset) ? rawAsset : null;
  const method = params.get('method') ?? normalizeMode(mode) ?? defaultMethod(params.get('assetKind') ?? rawAsset);
  const assetKind = directAssetUrl ? detectAssetKind(directAssetUrl) : (params.get('assetKind') ?? normalizeAssetKind(rawAsset, method));
  const profile = methodProfile(method);
  const variant = params.get('variant');
  const explicitAssetUrl = params.get('url') ?? params.get('assetUrl') ?? directAssetUrl;
  const assetUrl = explicitAssetUrl ?? defaultAssetUrl(scene, assetKind, variant, method);
  const targetFps = readNumber(params, 'targetFps', 24);
  const initialDpr = clamp(readNumber(params, 'dpr', profile.dpr ?? Math.min(window.devicePixelRatio || 1, 1.5)), 0.5, 3);
  const controllerEnabled = {
    adaptiveBudget: method === 'adaptive-budget',
    networkAwareStream: method === 'network-aware-stream'
  };

  return {
    scene,
    resultName: params.get('resultName'),
    assetKind,
    variant,
    mode,
    method,
    benchmarkClass: benchmarkClass(method),
    lodClampMode: lodClampMode(method),
    assetUrl,
    routeUrl: params.get('routeUrl') ?? `/routes/${params.get('route') ?? 'orbit-demo'}.json`,
    durationSeconds: readNumber(params, 'duration', 30),
    targetFps,
    targetFrameMs: 1000 / targetFps,
    backend: params.get('backend') ?? 'auto',
    renderer: params.get('renderer') ?? 'auto',
    autoStart: readBool(params, 'autoStart', true),
    autoExport: params.get('autoExport') ?? 'manual',
    downloadFallback: readBool(params, 'downloadFallback', true),
    resultEndpoint: params.get('resultEndpoint') ?? '/api/save-run',
    captureScreenshot: readBool(params, 'captureScreenshot', true),
    fov: readNumber(params, 'fov', 65),
    initialDpr,
    minDpr: readNumber(params, 'minDpr', 0.6),
    maxDpr: readNumber(params, 'maxDpr', initialDpr),
    canvasAntialias: readBool(params, 'canvasAntialias', false),
    antiAlias: readOptionalBool(params, 'antiAlias') ?? profile.antiAlias,
    unified: readBool(params, 'unified', true),
    splatBudget: readOptionalNumber(params, 'splatBudget', defaultBudget(method)),
    minBudget: readNumber(params, 'minBudget', 150000),
    maxBudget: readNumber(params, 'maxBudget', 1200000),
    acceptableSplats: readOptionalNumber(params, 'acceptableSplats'),
    lodRangeMin: readOptionalNumber(params, 'lodRangeMin'),
    lodRangeMax: readOptionalNumber(params, 'lodRangeMax'),
    lodUnderfillLimit: readOptionalNumber(params, 'lodUnderfillLimit'),
    minPixelSize: readOptionalNumber(params, 'minPixelSize', profile.minPixelSize),
    minContribution: readOptionalNumber(params, 'minContribution', profile.minContribution),
    alphaClipForward: readOptionalNumber(params, 'alphaClipForward', profile.alphaClipForward),
    startDpr: readOptionalNumber(params, 'startDpr'),
    startSplatBudget: readOptionalNumber(params, 'startSplatBudget'),
    startLodRangeMin: readOptionalNumber(params, 'startLodRangeMin'),
    startLodRangeMax: readOptionalNumber(params, 'startLodRangeMax'),
    startLodUnderfillLimit: readOptionalNumber(params, 'startLodUnderfillLimit'),
    startMinPixelSize: readOptionalNumber(params, 'startMinPixelSize'),
    startMinContribution: readOptionalNumber(params, 'startMinContribution'),
    unlockAfterSeconds: readNumber(params, 'unlockAfterSeconds', 0.25),
    unlockStepSeconds: readNumber(params, 'unlockStepSeconds', 1.0),
    controllerEnabled,
    warnings: configWarnings(method, controllerEnabled)
  };
}

function defaultAssetUrl(scene, assetKind, variant, method) {
  if (assetKind === 'none') {
    return null;
  }
  if (variant) {
    return `/scenes/${scene}/variants/scene.${variant}.sog`;
  }
  if (method === 'baselineA' || assetKind === 'bundled-sog') {
    return `/assets/scenes/${scene}/scene.sog`;
  }
  if (method === 'baselineB' || assetKind === 'streamed-sog') {
    return `/assets/scenes/${scene}/lod-meta.json`;
  }
  if (assetKind === 'bundled') {
    return `/scenes/${scene}/bundled/scene.sog`;
  }
  return `/scenes/${scene}/streamed/lod-meta.json`;
}

function normalizeMode(mode) {
  if (mode === 'baselineA' || mode === 'bundled_sog_default') {
    return 'baselineA';
  }
  if (mode === 'baselineB' || mode === 'streamed_sog_default_lod_meta') {
    return 'baselineB';
  }
  if (mode === 'baselineA_bundled_sog_default') {
    return 'baselineA';
  }
  if (mode === 'baselineB_streamed_sog_default') {
    return 'baselineB';
  }
  return mode;
}

function defaultMethod(assetKind) {
  if (assetKind === 'bundled' || assetKind === 'bundled-sog') {
    return 'baseline-a';
  }
  return 'baseline-b';
}

function normalizeAssetKind(asset, method) {
  if (asset === 'none') {
    return 'none';
  }
  if (method === 'baselineA') {
    return 'bundled-sog';
  }
  if (method === 'baselineB') {
    return 'streamed-sog';
  }
  return asset ?? 'streamed';
}

function isDirectAsset(asset) {
  return typeof asset === 'string' && (
    asset.startsWith('/') ||
    asset.startsWith('http://') ||
    asset.startsWith('https://') ||
    /\.(sog|ply|json)$/i.test(asset)
  );
}

function detectAssetKind(assetUrl) {
  if (/lod-meta\.json$/i.test(assetUrl)) {
    return 'streamed-sog';
  }
  if (/meta\.json$/i.test(assetUrl)) {
    return 'sog-directory';
  }
  if (/\.sog$/i.test(assetUrl)) {
    return 'bundled-sog';
  }
  if (/\.ply$/i.test(assetUrl)) {
    return 'ply';
  }
  return 'direct';
}

function defaultBudget(method) {
  const staticBudget = readStaticBudget(method);
  if (staticBudget !== null) {
    return staticBudget;
  }
  if (method === 'baseline-c') {
    return 500000;
  }
  if (method === 'adaptive-budget') {
    return 650000;
  }
  if (method === 'network-aware-stream') {
    return 650000;
  }
  if (method === 'contribution-culling') {
    return 500000;
  }
  return undefined;
}

function readStaticBudget(method) {
  const match = /^staticBudget_(\d+)$/.exec(method ?? '');
  if (!match) {
    return null;
  }
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function lodClampMode(method) {
  return /^lodClamp_/.test(method ?? '') ? method.replace(/^lodClamp_/, '') : null;
}

function benchmarkClass(method) {
  if (method === 'baselineA' || method === 'baselineB') {
    return 'baseline';
  }
  if (readStaticBudget(method) !== null) {
    return 'static-budget-sweep';
  }
  if (lodClampMode(method)) {
    return 'lod-clamp-sweep';
  }
  if (method === 'adaptive-budget' || method === 'network-aware-stream') {
    return 'candidate';
  }
  return 'exploratory';
}

function methodProfile(method) {
  if (method === 'baseline-f') {
    return {
      dpr: 0.75,
      antiAlias: false
    };
  }

  if (method === 'contribution-culling') {
    return {
      antiAlias: false,
      minPixelSize: 0.75,
      minContribution: 0.0001,
      alphaClipForward: 0.003
    };
  }

  return {};
}

function configWarnings(method, controllerEnabled) {
  const warnings = [];
  if ((method === 'baselineA' || method === 'baselineB') && (controllerEnabled.adaptiveBudget || controllerEnabled.networkAwareStream)) {
    warnings.push('Baseline mode has adaptive controller enabled; this run should be invalidated.');
  }
  if ((readStaticBudget(method) !== null || lodClampMode(method)) && (controllerEnabled.adaptiveBudget || controllerEnabled.networkAwareStream)) {
    warnings.push('Phase 3 sweep mode has adaptive controller enabled; this run should be invalidated.');
  }
  return warnings;
}

function readNumber(params, key, fallback) {
  if (!params.has(key)) {
    return fallback;
  }
  const value = Number(params.get(key));
  return Number.isFinite(value) ? value : fallback;
}

function readOptionalNumber(params, key, fallback) {
  if (!params.has(key)) {
    return fallback;
  }
  const value = Number(params.get(key));
  return Number.isFinite(value) ? value : fallback;
}

function readBool(params, key, fallback) {
  if (!params.has(key)) {
    return fallback;
  }
  return ['1', 'true', 'yes', 'on'].includes(String(params.get(key)).toLowerCase());
}

function readOptionalBool(params, key) {
  if (!params.has(key)) {
    return undefined;
  }
  return readBool(params, key, false);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
