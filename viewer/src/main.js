import './styles.css';

import {
  GSPLAT_RENDERER_AUTO,
  GSPLAT_RENDERER_COMPUTE,
  GSPLAT_RENDERER_RASTER_CPU_SORT,
  GSPLAT_RENDERER_RASTER_GPU_SORT,
  version as playcanvasVersion
} from 'playcanvas';

import { createBenchmarkApp } from './playcanvas/app.js';
import { loadSplatEntity } from './playcanvas/splat-loader.js';
import { parseBenchmarkConfig } from './benchmark/config.js';
import { detectCapabilities } from './benchmark/capabilities.js';
import { MetricsRecorder } from './benchmark/metrics.js';
import { RoutePlayer } from './benchmark/route.js';
import { downloadCsv, downloadJson } from './benchmark/export.js';
import { captureCanvasVisualSanity } from './benchmark/visual-sanity.js';
import { AdaptiveBudgetController } from './controllers/adaptive-budget.js';
import { NetworkAwareStreamController } from './controllers/network-stream.js';

const canvas = document.querySelector('#app');
const hud = document.querySelector('#hud');
const downloadJsonButton = document.querySelector('#download-json');
const downloadCsvButton = document.querySelector('#download-csv');

const config = parseBenchmarkConfig(window.location);
const recorder = new MetricsRecorder(config);

let app;
let routePlayer;
let adaptiveController;
let networkController;
let splatEntity;
let exportHandled = false;
let visualCaptureStarted = false;

const setHud = (extra = '') => {
  const summary = recorder.getLiveSummary();
  const gsplat = app?.scene?.gsplat;
  const renderer = gsplat?.currentRenderer ?? 'unknown';
  const deviceType = app?.graphicsDevice?.deviceType ?? 'unknown';
  const resource = splatEntity?.gsplat?.resource;
  const splats = readSplatCount(resource);
  const lines = [
    `LowEndGS ${config.method}`,
    `scene: ${config.scene}`,
    `asset: ${config.assetUrl}`,
    `device: ${deviceType}`,
    `renderer: ${renderer}`,
    `dpr: ${summary.dpr.toFixed(2)}`,
    `fps: ${summary.fps.toFixed(1)}`,
    `p50/p95: ${summary.p50FrameMs.toFixed(1)} / ${summary.p95FrameMs.toFixed(1)} ms`,
    `budget: ${gsplat?.splatBudget ?? 'n/a'}`,
    `lod: ${formatLodState(app?.lowEndGsLodClampState, gsplat)}`,
    `splats: ${splats ?? 'unknown'}`,
    `bytes: ${formatBytes(summary.bytesDownloaded)}`,
    `first frame: ${summary.firstVisibleFrameMs ? `${summary.firstVisibleFrameMs.toFixed(0)} ms` : 'pending'}`,
    `controllers: adaptive=${adaptiveController?.enabled ?? false}, network=${networkController?.enabled ?? false}`,
    `export: ${recorder.exportStatus.status}`,
    extra
  ].filter(Boolean);

  hud.textContent = lines.join('\n');
};

const main = async () => {
  setHud('initializing');

  const capabilities = await detectCapabilities();
  app = await createBenchmarkApp(canvas, config);
  recorder.markAppReady(app, capabilities, playcanvasVersion);

  routePlayer = new RoutePlayer(config);
  await routePlayer.load();
  routePlayer.attach(app.cameraEntity);

  applyMethodConfig(app, config);

  adaptiveController = new AdaptiveBudgetController(app, config);
  adaptiveController.enabled = config.controllerEnabled.adaptiveBudget;

  networkController = new NetworkAwareStreamController(app, config);
  networkController.enabled = config.controllerEnabled.networkAwareStream;
  recorder.markControllers({
    adaptiveBudget: adaptiveController.enabled,
    networkAwareStream: networkController.enabled
  });

  if (config.assetKind !== 'none') {
    const loadStartedAt = performance.now();
    splatEntity = await loadSplatEntity(app, config.assetUrl);
    recorder.markAssetLoaded(performance.now() - loadStartedAt);

    if (config.unified) {
      splatEntity.gsplat.unified = true;
    }

    applyLodClamp(app, config, splatEntity);
    recorder.observeSplat(splatEntity);
    networkController.attach(splatEntity);
  } else {
    recorder.markAssetLoaded(0);
  }

  app.systems.gsplat?.on('frame:ready', (camera, layer, ready, loadingCount) => {
    recorder.markFrameReady(ready, loadingCount);
    networkController.markFrameReady(ready, loadingCount);
  });

  routePlayer.start();

  app.on('update', (dt) => {
    routePlayer.update(dt);
    recorder.sample(app, splatEntity, routePlayer);
    maybeCaptureVisualSanity();
    adaptiveController.update(recorder);
    networkController.update(recorder);
    setHud();

    if (recorder.elapsedSeconds >= config.durationSeconds && !recorder.finished) {
      recorder.finish('duration');
      setHud('finished');
    }

    if (recorder.finished && !exportHandled) {
      exportHandled = true;
      handleAutoExport().catch((error) => {
        console.warn('Auto export failed', error);
      });
    }
  });

  app.graphicsDevice.on('devicelost', () => {
    recorder.finish('device-lost');
    setHud('device lost');
  });

  downloadJsonButton.addEventListener('click', () => {
    downloadJson(recorder.toSummaryJson(), recorder.getRunFilename('json', 'summary'));
    recorder.setExportStatus({ status: 'manual summary download used', method: 'browser-download' });
  });

  downloadCsvButton.addEventListener('click', () => {
    downloadCsv(recorder.toCsvRows(), recorder.getRunFilename('csv', 'frames'));
    recorder.setExportStatus({ status: 'manual frames download used', method: 'browser-download' });
  });

  setHud('running');
};

main().catch((error) => {
  console.error(error);
  recorder.finish('error', { message: error.message, stack: error.stack });
  hud.textContent = `LowEndGS failed\n${error.message}`;
});

function applyMethodConfig(app, cfg) {
  const gsplat = app.scene.gsplat;
  if (!gsplat) {
    return;
  }

  setIfNumber(gsplat, 'splatBudget', cfg.splatBudget);
  setIfNumber(gsplat, 'lodRangeMin', cfg.lodRangeMin);
  setIfNumber(gsplat, 'lodRangeMax', cfg.lodRangeMax);
  setIfNumber(gsplat, 'lodUnderfillLimit', cfg.lodUnderfillLimit);
  setIfNumber(gsplat, 'minPixelSize', cfg.minPixelSize);
  setIfNumber(gsplat, 'minContribution', cfg.minContribution);
  setIfNumber(gsplat, 'alphaClipForward', cfg.alphaClipForward);

  if ('renderer' in gsplat) {
    gsplat.renderer = rendererConstant(cfg.renderer);
  }

  if (typeof cfg.antiAlias === 'boolean' && 'antiAlias' in gsplat) {
    gsplat.antiAlias = cfg.antiAlias;
  }
}

function applyLodClamp(app, cfg, entity) {
  if (!cfg.lodClampMode || cfg.lodClampMode === 'default') {
    app.lowEndGsLodClampState = {
      mode: cfg.lodClampMode ?? 'default',
      status: 'not-applied',
      reason: 'default or unset'
    };
    return;
  }

  const gsplat = app.scene.gsplat;
  if (!gsplat) {
    app.lowEndGsLodClampState = {
      mode: cfg.lodClampMode,
      status: 'failed',
      reason: 'app.scene.gsplat unavailable'
    };
    return;
  }

  const lodLevels = readLodLevelCount(entity?.gsplat?.resource);
  if (!Number.isFinite(lodLevels) || lodLevels <= 0) {
    app.lowEndGsLodClampState = {
      mode: cfg.lodClampMode,
      status: 'unavailable',
      reason: 'LOD level count not visible on PlayCanvas resource'
    };
    return;
  }

  const maxIndex = Math.max(0, lodLevels - 1);
  let min = cfg.lodRangeMin;
  let max = cfg.lodRangeMax;

  switch (cfg.lodClampMode) {
    case 'coarseOnly':
      min = maxIndex;
      max = maxIndex;
      break;
    case 'noLOD0':
      min = Math.min(1, maxIndex);
      max = maxIndex;
      break;
    case 'noLOD0_noLOD1':
      min = Math.min(2, maxIndex);
      max = maxIndex;
      break;
    case 'midOnly': {
      const mid = Math.max(0, Math.min(maxIndex, Math.floor(maxIndex / 2)));
      min = mid;
      max = mid;
      break;
    }
    default:
      app.lowEndGsLodClampState = {
        mode: cfg.lodClampMode,
        status: 'unknown-mode',
        lodLevels
      };
      return;
  }

  setIfNumber(gsplat, 'lodRangeMin', min);
  setIfNumber(gsplat, 'lodRangeMax', max);
  app.lowEndGsLodClampState = {
    mode: cfg.lodClampMode,
    status: 'applied',
    lodLevels,
    requestedLodRangeMin: min,
    requestedLodRangeMax: max,
    lodRangeMin: 'lodRangeMin' in gsplat ? gsplat.lodRangeMin : null,
    lodRangeMax: 'lodRangeMax' in gsplat ? gsplat.lodRangeMax : null
  };
}

function rendererConstant(renderer) {
  switch (renderer) {
    case 'compute':
      return GSPLAT_RENDERER_COMPUTE;
    case 'gpu-sort':
      return GSPLAT_RENDERER_RASTER_GPU_SORT;
    case 'cpu-sort':
      return GSPLAT_RENDERER_RASTER_CPU_SORT;
    case 'auto':
    default:
      return GSPLAT_RENDERER_AUTO;
  }
}

async function uploadResult(metrics) {
  metrics.setExportStatus({
    status: 'server export attempted',
    method: 'server',
    endpoint: config.resultEndpoint,
    fallbackSucceeded: false
  });

  const response = await fetch(config.resultEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metrics.toJson())
  });
  if (!response.ok) {
    const error = new Error(`Result upload failed: ${response.status}`);
    error.httpStatus = response.status;
    throw error;
  }
  const payload = await response.json().catch(() => null);
  metrics.setExportStatus({
    status: 'server export success',
    method: 'server',
    endpoint: config.resultEndpoint,
    httpStatus: response.status,
    serverRunId: payload?.runId ?? null,
    files: payload?.files ?? null,
    fallbackSucceeded: false
  });
  return payload;
}

async function handleAutoExport() {
  if (config.autoExport === 'server') {
    try {
      await uploadResult(recorder);
    } catch (error) {
      const blockedLikely = isLikelyBlockedRequest(error);
      const failedStatus = {
        status: 'server export failed',
        method: 'server',
        endpoint: config.resultEndpoint,
        httpStatus: error.httpStatus ?? null,
        exceptionName: error.name,
        exceptionMessage: error.message,
        blockedLikely,
        fallbackSucceeded: false
      };

      if (config.downloadFallback) {
        const fallback = downloadFallback(failedStatus);
        recorder.setExportStatus(fallback);
      } else {
        recorder.setExportStatus(failedStatus);
      }
    }
    return;
  }

  if (config.autoExport === 'download') {
    recorder.setExportStatus(downloadFallback({
      status: 'browser download requested',
      method: 'browser-download'
    }));
    return;
  }

  recorder.setExportStatus({
    status: 'no export attempted',
    method: 'none'
  });
}

function downloadFallback(status) {
  const next = {
    ...status,
    status: status.status === 'browser download requested' ? 'browser download fallback used' : `${status.status}; browser download fallback used`,
    method: status.method === 'server' ? 'server-then-browser-download' : 'browser-download',
    fallbackAttempted: true,
    fallbackSucceeded: false
  };

  recorder.setExportStatus(next);
  try {
    downloadJson(recorder.toSummaryJson(), recorder.getRunFilename('json', 'summary'));
    downloadCsv(recorder.toCsvRows(), recorder.getRunFilename('csv', 'frames'));
    return {
      ...next,
      fallbackSucceeded: true
    };
  } catch (error) {
    return {
      ...next,
      fallbackExceptionMessage: error.message,
      fallbackSucceeded: false
    };
  }
}

function maybeCaptureVisualSanity() {
  if (!config.captureScreenshot || visualCaptureStarted || recorder.firstVisibleFrameMs === null) {
    return;
  }

  visualCaptureStarted = true;
  setTimeout(() => {
    captureCanvasVisualSanity(canvas).then((visualSanity) => {
      recorder.setVisualSanity(visualSanity);
    });
  }, 250);
}

function isLikelyBlockedRequest(error) {
  return error?.name === 'TypeError' || /blocked|network|fetch/i.test(error?.message ?? '');
}

function setIfNumber(target, key, value) {
  if (typeof value === 'number' && Number.isFinite(value) && key in target) {
    target[key] = value;
  }
}

function readSplatCount(resource) {
  if (!resource) {
    return null;
  }

  return resource.numSplats ?? resource.count ?? resource.splatCount ?? resource.data?.count ?? null;
}

function readLodLevelCount(resource) {
  if (!resource) {
    return null;
  }

  const candidates = [
    resource.lodLevels,
    resource.numLods,
    resource.numLodLevels,
    resource.levels?.length,
    resource.lods?.length,
    resource.octree?.lodLevels,
    resource.octree?.numLods,
    resource.octree?.numLodLevels,
    resource.octree?.levels?.length,
    resource.octree?.lods?.length,
    resource.octree?._levels?.length,
    resource.octree?._lods?.length
  ];

  for (const value of candidates) {
    if (Number.isFinite(value) && value > 0) {
      return value;
    }
  }

  const arrays = [
    resource.chunks,
    resource.nodes,
    resource.octree?.chunks,
    resource.octree?.nodes
  ].filter(Array.isArray);

  let maxLod = -1;
  for (const array of arrays) {
    for (const item of array) {
      const lod = item?.lod ?? item?.level ?? item?._lod ?? item?._level;
      if (Number.isFinite(lod)) {
        maxLod = Math.max(maxLod, lod);
      }
    }
  }

  return maxLod >= 0 ? maxLod + 1 : null;
}

function formatLodState(state, gsplat) {
  const range = `${gsplat?.lodRangeMin ?? 'n/a'}..${gsplat?.lodRangeMax ?? 'n/a'}`;
  if (!state || state.mode === 'default') {
    return range;
  }
  return `${state.mode} ${state.status} ${range}`;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}
