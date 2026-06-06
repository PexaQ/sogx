export class MetricsRecorder {
  constructor(config) {
    this.config = config;
    performance.setResourceTimingBufferSize?.(5000);
    const runLabel = config.resultName || `${config.scene}_${config.method}`;
    this.runId = `${new Date().toISOString().replace(/[:.]/g, '-')}_${safeRunLabel(runLabel)}`;
    this.startedAt = performance.now();
    this.appReadyMs = null;
    this.assetLoadedMs = null;
    this.firstVisibleFrameMs = null;
    this.timeToAcceptableQualityMs = null;
    this.finished = false;
    this.finishReason = null;
    this.finishDetail = null;
    this.samples = [];
    this.frameTimes = [];
    this.lastFrameAt = this.startedAt;
    this.resourceStart = new Map();
    this.observedSplat = null;
    this.ready = false;
    this.loadingCount = null;
    this.controllerEnabled = {
      adaptiveBudget: false,
      networkAwareStream: false
    };
    this.exportStatus = {
      status: 'no export attempted',
      method: 'none'
    };
    this.visualSanity = {
      captured: false,
      nonEmptyCanvas: null,
      notes: 'not attempted'
    };
    this.validationStatus = {
      status: 'unvalidated'
    };
  }

  markAppReady(app, capabilities, playcanvasVersion) {
    this.appReadyMs = performance.now() - this.startedAt;
    this.device = getDeviceInfo(app, capabilities);
    this.playcanvasVersion = playcanvasVersion;
    this.resourceStart = collectResourceSizes();
  }

  markAssetLoaded(loadMs) {
    this.assetLoadedMs = loadMs;
  }

  observeSplat(entity) {
    this.observedSplat = entity;
  }

  markFrameReady(ready, loadingCount) {
    this.ready = Boolean(ready);
    this.loadingCount = loadingCount;
  }

  markControllers(controllerEnabled) {
    this.controllerEnabled = {
      adaptiveBudget: Boolean(controllerEnabled?.adaptiveBudget),
      networkAwareStream: Boolean(controllerEnabled?.networkAwareStream)
    };
  }

  setExportStatus(status) {
    this.exportStatus = {
      ...this.exportStatus,
      ...status,
      updatedAt: new Date().toISOString()
    };
  }

  setVisualSanity(visualSanity) {
    this.visualSanity = visualSanity;
  }

  sample(app, splatEntity, routePlayer) {
    if (this.finished) {
      return;
    }

    const now = performance.now();
    const frameMs = now - this.lastFrameAt;
    this.lastFrameAt = now;

    if (frameMs > 0 && frameMs < 1000) {
      this.frameTimes.push(frameMs);
      if (this.frameTimes.length > 600) {
        this.frameTimes.shift();
      }
    }

    if (this.firstVisibleFrameMs === null && isSplatReady(splatEntity)) {
      this.firstVisibleFrameMs = now - this.startedAt;
    }

    const resourceBytes = getDownloadedBytes(this.resourceStart);
    const gsplat = app.scene.gsplat;
    const sample = {
      t: round((now - this.startedAt) / 1000, 4),
      frameMs: round(frameMs, 4),
      fps: round(frameMs > 0 ? 1000 / frameMs : 0, 3),
      dpr: readDpr(app),
      renderer: gsplat?.currentRenderer ?? null,
      requestedBudget: gsplat?.splatBudget ?? null,
      requestedConfigBudget: this.config.splatBudget ?? null,
      splatBudgetAccepted: readSplatBudgetAccepted(gsplat, this.config.splatBudget),
      lodRangeMin: gsplat?.lodRangeMin ?? null,
      lodRangeMax: gsplat?.lodRangeMax ?? null,
      lodClampState: app.lowEndGsLodClampState ?? null,
      controllerState: app.lowEndGsControllerState ?? null,
      activeSplats: readActiveSplats(app, splatEntity),
      activeSplatsSource: app.stats?.frame ? 'app.stats.frame.gsplats' : 'resource-estimate',
      loadedChunks: readLoadedChunkCount(splatEntity?.gsplat?.resource),
      loadedChunksSource: splatEntity?.gsplat?.resource?.octree ? 'resource.octree-estimate' : 'unavailable',
      loadingChunks: this.loadingCount ?? readLoadingChunkCount(app),
      ready: this.ready,
      bytesDownloaded: resourceBytes,
      jsHeapUsed: performance.memory?.usedJSHeapSize ?? null,
      routeTime: routePlayer?.elapsed ?? null,
      cameraSpeed: routePlayer?.speed ?? null
    };

    this.samples.push(sample);

    if (
      this.timeToAcceptableQualityMs === null &&
      typeof this.config.acceptableSplats === 'number' &&
      sample.ready &&
      sample.activeSplats >= this.config.acceptableSplats
    ) {
      this.timeToAcceptableQualityMs = now - this.startedAt;
    }
  }

  finish(reason, detail = null) {
    if (this.finished) {
      return;
    }
    this.finished = true;
    this.finishReason = reason;
    this.finishDetail = detail;
  }

  get elapsedSeconds() {
    return (performance.now() - this.startedAt) / 1000;
  }

  getLiveSummary() {
    const windowFrames = this.frameTimes.slice(-120);
    return {
      fps: average(windowFrames.map((ms) => 1000 / ms)),
      p50FrameMs: percentile(windowFrames, 0.5),
      p95FrameMs: percentile(windowFrames, 0.95),
      dpr: this.samples.at(-1)?.dpr ?? this.config.initialDpr,
      bytesDownloaded: this.samples.at(-1)?.bytesDownloaded ?? 0,
      firstVisibleFrameMs: this.firstVisibleFrameMs
    };
  }

  getSummary() {
    const frames = this.samples.map((sample) => sample.frameMs).filter((value) => value > 0);
    const fpsValues = frames.map((ms) => 1000 / ms);
    return {
      runId: this.runId,
      scene: this.config.scene,
      method: this.config.method,
      benchmarkClass: this.config.benchmarkClass ?? null,
      resultName: this.config.resultName ?? null,
      assetUrl: this.config.assetUrl,
      durationSeconds: round(this.elapsedSeconds, 3),
      finishReason: this.finishReason,
      sampleCount: this.samples.length,
      appReadyMs: round(this.appReadyMs, 3),
      assetLoadedMs: round(this.assetLoadedMs, 3),
      firstVisibleFrameMs: round(this.firstVisibleFrameMs, 3),
      timeToAcceptableQualityMs: round(this.timeToAcceptableQualityMs, 3),
      avgFps: round(average(fpsValues), 3),
      p50FrameMs: round(percentile(frames, 0.5), 3),
      p95FrameMs: round(percentile(frames, 0.95), 3),
      p99FrameMs: round(percentile(frames, 0.99), 3),
      droppedFramesOver33_3Ms: frames.filter((ms) => ms > 33.3).length,
      droppedFramesOver41_7Ms: frames.filter((ms) => ms > 41.7).length,
      bytes5s: bytesAt(this.samples, 5),
      bytes10s: bytesAt(this.samples, 10),
      bytes30s: bytesAt(this.samples, 30),
      maxJsHeapUsed: max(this.samples.map((sample) => sample.jsHeapUsed)),
      finalActiveSplats: this.samples.at(-1)?.activeSplats ?? null,
      finalLoadedChunks: this.samples.at(-1)?.loadedChunks ?? null,
      finalSplatBudget: this.samples.at(-1)?.requestedBudget ?? null,
      finalSplatBudgetAccepted: this.samples.at(-1)?.splatBudgetAccepted ?? null,
      finalLodRangeMin: this.samples.at(-1)?.lodRangeMin ?? null,
      finalLodRangeMax: this.samples.at(-1)?.lodRangeMax ?? null,
      finalLodClampState: this.samples.at(-1)?.lodClampState ?? null,
      finalRenderer: this.samples.at(-1)?.renderer ?? null,
      finalDpr: this.samples.at(-1)?.dpr ?? null,
      exportMethod: this.exportStatus.method,
      exportStatus: this.exportStatus.status,
      visualSanity: sanitizeVisualSanity(this.visualSanity)
    };
  }

  toSummaryJson() {
    return {
      resultType: 'lowendgs-summary',
      runId: this.runId,
      config: this.config,
      device: this.device,
      playcanvasVersion: this.playcanvasVersion,
      controllerEnabled: this.controllerEnabled,
      summary: this.getSummary(),
      visualSanity: sanitizeVisualSanity(this.visualSanity),
      exportStatus: this.exportStatus,
      validationStatus: this.validationStatus,
      finishDetail: this.finishDetail,
      sampleCount: this.samples.length
    };
  }

  toJson() {
    return {
      runId: this.runId,
      config: this.config,
      device: this.device,
      playcanvasVersion: this.playcanvasVersion,
      controllerEnabled: this.controllerEnabled,
      summary: this.getSummary(),
      visualSanity: this.visualSanity,
      exportStatus: this.exportStatus,
      validationStatus: this.validationStatus,
      finishDetail: this.finishDetail,
      samples: this.samples
    };
  }

  toCsvRows() {
    return this.samples;
  }

  getRunFilename(extension, suffix = '') {
    return `${this.runId}${suffix ? `_${suffix}` : ''}.${extension}`;
  }
}

function getDeviceInfo(app, capabilities) {
  const nav = navigator;
  const connection = nav.connection ?? nav.mozConnection ?? nav.webkitConnection ?? {};
  return {
    userAgent: nav.userAgent,
    platform: nav.platform,
    hardwareConcurrency: nav.hardwareConcurrency ?? null,
    deviceMemory: nav.deviceMemory ?? null,
    connectionEffectiveType: connection.effectiveType ?? null,
    connectionDownlink: connection.downlink ?? null,
    screen: {
      width: screen.width,
      height: screen.height,
      devicePixelRatio: window.devicePixelRatio,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight
    },
    graphicsDeviceType: app.graphicsDevice?.deviceType ?? null,
    capabilities
  };
}

function collectResourceSizes() {
  const map = new Map();
  for (const entry of performance.getEntriesByType('resource')) {
    map.set(entry.name, entry.transferSize || entry.encodedBodySize || 0);
  }
  return map;
}

function getDownloadedBytes(initial) {
  let total = 0;
  for (const entry of performance.getEntriesByType('resource')) {
    const current = entry.transferSize || entry.encodedBodySize || 0;
    const previous = initial.get(entry.name) ?? 0;
    total += Math.max(0, current - previous);
  }
  return total;
}

function isSplatReady(entity) {
  if (!entity) {
    return true;
  }
  const resource = entity?.gsplat?.resource;
  if (!resource) {
    return false;
  }
  if ('ready' in resource) {
    return Boolean(resource.ready);
  }
  return true;
}

function readActiveSplats(app, entity) {
  const stat = app.stats?.frame?.gsplats;
  if (Number.isFinite(stat)) {
    return stat;
  }
  return readSplatCount(entity?.gsplat?.resource);
}

function readDpr(app) {
  return app?.graphicsDevice?.maxPixelRatio ?? window.devicePixelRatio ?? 1;
}

function readSplatCount(resource) {
  if (!resource) {
    return null;
  }
  return resource.numSplats ?? resource.count ?? resource.splatCount ?? resource.data?.count ?? null;
}

function readLoadedChunkCount(resource) {
  const octree = resource?.octree;
  if (!octree) {
    return null;
  }
  if (Array.isArray(octree.chunks)) {
    return octree.chunks.filter((chunk) => chunk.resource || chunk.loaded).length;
  }
  if (Array.isArray(octree.nodes)) {
    return octree.nodes.filter((node) => node.resource || node.loaded).length;
  }
  return null;
}

function readLoadingChunkCount(app) {
  const system = app?.systems?.gsplat;
  return system?._loadingCount ?? system?.loadingCount ?? null;
}

function readSplatBudgetAccepted(gsplat, requested) {
  if (!gsplat || !Number.isFinite(requested) || !('splatBudget' in gsplat)) {
    return null;
  }
  return gsplat.splatBudget === requested;
}

function average(values) {
  const valid = values.filter(Number.isFinite);
  if (!valid.length) {
    return 0;
  }
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function percentile(values, p) {
  const valid = values.filter(Number.isFinite).toSorted((a, b) => a - b);
  if (!valid.length) {
    return 0;
  }
  const index = Math.min(valid.length - 1, Math.max(0, Math.floor((valid.length - 1) * p)));
  return valid[index];
}

function max(values) {
  const valid = values.filter(Number.isFinite);
  return valid.length ? Math.max(...valid) : null;
}

function bytesAt(samples, second) {
  const sample = samples.find((item) => item.t >= second) ?? samples.at(-1);
  return sample?.bytesDownloaded ?? null;
}

function round(value, places = 3) {
  if (!Number.isFinite(value)) {
    return value ?? null;
  }
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function sanitizeVisualSanity(visualSanity) {
  if (!visualSanity) {
    return visualSanity;
  }
  const next = { ...visualSanity };
  delete next.screenshotDataUrl;
  return next;
}

function safeRunLabel(value) {
  return String(value)
    .trim()
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '') || 'run';
}
