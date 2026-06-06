export class AdaptiveBudgetController {
  constructor(app, config) {
    this.app = app;
    this.config = config;
    this.enabled = false;
    this.lastDecisionAt = 0;
    this.cooldownMs = 1000;
    this.stableWindows = 0;
  }

  update(recorder) {
    if (!this.enabled || recorder.finished) {
      return;
    }

    const now = performance.now();
    if (now - this.lastDecisionAt < this.cooldownMs) {
      return;
    }

    const summary = recorder.getLiveSummary();
    const gsplat = this.app.scene.gsplat;
    const budget = gsplat?.splatBudget || this.config.splatBudget || this.config.maxBudget;
    const target = this.config.targetFrameMs;

    if (summary.p95FrameMs > target * 1.2) {
      gsplat.splatBudget = clamp(Math.floor(budget * 0.82), this.config.minBudget, this.config.maxBudget);
      reduceDpr(this.app, this.config);
      this.stableWindows = 0;
      this.lastDecisionAt = now;
      return;
    }

    if (summary.p95FrameMs < target * 0.82 && summary.p50FrameMs < target * 0.75) {
      this.stableWindows += 1;
      if (this.stableWindows >= 3) {
        gsplat.splatBudget = clamp(Math.floor(budget * 1.08), this.config.minBudget, this.config.maxBudget);
        raiseDpr(this.app, this.config);
        this.stableWindows = 0;
        this.lastDecisionAt = now;
      }
      return;
    }

    this.stableWindows = 0;
  }
}

function reduceDpr(app, config) {
  const device = app.graphicsDevice;
  if (!device || typeof device.maxPixelRatio !== 'number') {
    return;
  }
  device.maxPixelRatio = clamp(device.maxPixelRatio * 0.92, config.minDpr, config.maxDpr);
}

function raiseDpr(app, config) {
  const device = app.graphicsDevice;
  if (!device || typeof device.maxPixelRatio !== 'number') {
    return;
  }
  device.maxPixelRatio = clamp(device.maxPixelRatio * 1.03, config.minDpr, config.maxDpr);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
