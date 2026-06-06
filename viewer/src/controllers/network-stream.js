export class NetworkAwareStreamController {
  constructor(app, config) {
    this.app = app;
    this.config = config;
    this.enabled = false;
    this.entity = null;
    this.phase = 'idle';
    this.restoreStep = 0;
    this.lastRestoreAt = 0;
    this.ready = false;
    this.loadingCount = null;
    this.snapshot = null;
  }

  attach(entity) {
    this.entity = entity;
    if (this.enabled) {
      this.applyStartupProfile();
    }
  }

  markFrameReady(ready, loadingCount) {
    this.ready = Boolean(ready);
    this.loadingCount = Number.isFinite(loadingCount) ? loadingCount : null;
  }

  update(recorder) {
    if (!this.enabled || recorder.finished || this.phase === 'idle') {
      return;
    }

    const now = performance.now();
    const summary = recorder.getLiveSummary();
    const firstVisible = summary.firstVisibleFrameMs !== null;
    const coarseReady = this.ready && (this.loadingCount === null || this.loadingCount === 0);
    const oldEnough = recorder.elapsedSeconds >= this.config.unlockAfterSeconds;

    if (this.phase === 'startup' && firstVisible && coarseReady && oldEnough) {
      this.phase = 'unlocking';
      this.lastRestoreAt = 0;
      this.writeState();
    }

    if (this.phase !== 'unlocking') {
      return;
    }

    if (now - this.lastRestoreAt < this.config.unlockStepSeconds * 1000) {
      return;
    }

    this.restoreOneStep();
    this.lastRestoreAt = now;
  }

  applyStartupProfile() {
    const gsplat = this.app.scene.gsplat;
    if (!gsplat || this.phase !== 'idle') {
      return;
    }

    this.snapshot = captureSnapshot(gsplat, this.app);
    const lodLevels = this.entity?.gsplat?.resource?.octree?.lodLevels;
    const worstLod = Number.isFinite(lodLevels) ? lodLevels - 1 : null;
    const startLodMin = this.config.startLodRangeMin ?? worstLod;
    const startLodMax = this.config.startLodRangeMax ?? worstLod;

    setIfNumber(gsplat, 'lodRangeMin', startLodMin);
    setIfNumber(gsplat, 'lodRangeMax', startLodMax);
    setIfNumber(gsplat, 'lodUnderfillLimit', this.config.startLodUnderfillLimit);
    setIfNumber(gsplat, 'minPixelSize', this.config.startMinPixelSize);
    setIfNumber(gsplat, 'minContribution', this.config.startMinContribution);
    setIfNumber(gsplat, 'splatBudget', this.config.startSplatBudget);

    if (typeof this.config.startDpr === 'number') {
      this.app.graphicsDevice.maxPixelRatio = clamp(this.config.startDpr, this.config.minDpr, this.config.maxDpr);
    }

    this.phase = 'startup';
    this.writeState();
  }

  restoreOneStep() {
    const gsplat = this.app.scene.gsplat;
    if (!gsplat || !this.snapshot) {
      this.phase = 'done';
      return;
    }

    if (this.restoreStep === 0) {
      restore(gsplat, 'lodRangeMin', this.config.lodRangeMin ?? 0, this.snapshot);
      const lodLevels = this.entity?.gsplat?.resource?.octree?.lodLevels;
      restore(gsplat, 'lodRangeMax', this.config.lodRangeMax ?? (Number.isFinite(lodLevels) ? lodLevels - 1 : undefined), this.snapshot);
      restore(gsplat, 'lodUnderfillLimit', this.config.lodUnderfillLimit, this.snapshot);
    } else if (this.restoreStep === 1) {
      restore(gsplat, 'splatBudget', this.config.splatBudget, this.snapshot);
      restoreDpr(this.app, this.config, this.snapshot);
    } else if (this.restoreStep === 2) {
      restore(gsplat, 'minPixelSize', this.config.minPixelSize, this.snapshot);
      restore(gsplat, 'minContribution', this.config.minContribution, this.snapshot);
    } else {
      this.phase = 'done';
    }

    this.restoreStep += 1;
    this.writeState();
  }

  writeState() {
    this.app.lowEndGsControllerState = {
      controller: 'network-aware-stream',
      phase: this.phase,
      restoreStep: this.restoreStep,
      loadingCount: this.loadingCount
    };
  }
}

function captureSnapshot(gsplat, app) {
  return {
    lodRangeMin: read(gsplat, 'lodRangeMin'),
    lodRangeMax: read(gsplat, 'lodRangeMax'),
    lodUnderfillLimit: read(gsplat, 'lodUnderfillLimit'),
    minPixelSize: read(gsplat, 'minPixelSize'),
    minContribution: read(gsplat, 'minContribution'),
    splatBudget: read(gsplat, 'splatBudget'),
    dpr: app.graphicsDevice?.maxPixelRatio
  };
}

function read(target, key) {
  return key in target ? target[key] : undefined;
}

function restore(target, key, preferred, snapshot) {
  const value = preferred ?? snapshot[key];
  setIfNumber(target, key, value);
}

function restoreDpr(app, config, snapshot) {
  const value = config.maxDpr ?? snapshot.dpr;
  if (typeof value === 'number') {
    app.graphicsDevice.maxPixelRatio = clamp(value, config.minDpr, config.maxDpr);
  }
}

function setIfNumber(target, key, value) {
  if (typeof value === 'number' && Number.isFinite(value) && key in target) {
    target[key] = value;
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
