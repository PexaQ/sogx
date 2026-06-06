import { Vec3 } from 'playcanvas';

export class RoutePlayer {
  constructor(config) {
    this.config = config;
    this.route = null;
    this.camera = null;
    this.elapsed = 0;
    this.speed = 0;
    this.lastPosition = new Vec3();
    this.running = false;
  }

  async load() {
    const response = await fetch(this.config.routeUrl);
    if (!response.ok) {
      this.route = makeDefaultRoute(this.config.durationSeconds);
      return;
    }
    this.route = await response.json();
  }

  attach(camera) {
    this.camera = camera;
    this.applyAt(0);
  }

  start() {
    this.elapsed = 0;
    this.running = true;
    if (this.camera) {
      this.lastPosition.copy(this.camera.getPosition());
    }
  }

  update(dt) {
    if (!this.running || !this.camera) {
      return;
    }
    this.elapsed += dt;
    const before = this.camera.getPosition().clone();
    this.applyAt(this.elapsed);
    const after = this.camera.getPosition();
    this.speed = before.distance(after) / Math.max(dt, 1e-5);
  }

  applyAt(time) {
    const keyframes = normalizedKeyframes(this.route, this.config.durationSeconds);
    const duration = keyframes.at(-1).t;
    const t = duration > 0 ? time % duration : 0;
    let a = keyframes[0];
    let b = keyframes.at(-1);

    for (let i = 0; i < keyframes.length - 1; i += 1) {
      if (t >= keyframes[i].t && t <= keyframes[i + 1].t) {
        a = keyframes[i];
        b = keyframes[i + 1];
        break;
      }
    }

    const span = Math.max(1e-5, b.t - a.t);
    const u = smoothstep((t - a.t) / span);
    const position = lerpVec(a.position, b.position, u);
    const target = lerpVec(a.target, b.target, u);
    this.camera.setPosition(position[0], position[1], position[2]);
    this.camera.lookAt(target[0], target[1], target[2]);

    if (typeof a.fov === 'number' && this.camera.camera) {
      this.camera.camera.fov = lerp(a.fov, b.fov ?? a.fov, u);
    }
  }
}

function normalizedKeyframes(route, fallbackDuration) {
  const keyframes = route?.keyframes?.length ? route.keyframes : makeDefaultRoute(fallbackDuration).keyframes;
  return keyframes.map((frame, index) => ({
    t: typeof frame.t === 'number' ? frame.t : index,
    position: frame.position ?? [0, 1.6, 4],
    target: frame.target ?? [0, 1.2, 0],
    fov: frame.fov
  })).toSorted((a, b) => a.t - b.t);
}

function makeDefaultRoute(duration) {
  const d = Math.max(8, duration);
  return {
    keyframes: [
      { t: 0, position: [0, 1.5, 4], target: [0, 1.2, 0], fov: 65 },
      { t: d * 0.25, position: [3, 1.6, 2], target: [0, 1.2, 0], fov: 65 },
      { t: d * 0.5, position: [0, 1.7, -4], target: [0, 1.2, 0], fov: 65 },
      { t: d * 0.75, position: [-3, 1.6, 2], target: [0, 1.2, 0], fov: 65 },
      { t: d, position: [0, 1.5, 4], target: [0, 1.2, 0], fov: 65 }
    ]
  };
}

function lerpVec(a, b, u) {
  return [
    lerp(a[0], b[0], u),
    lerp(a[1], b[1], u),
    lerp(a[2], b[2], u)
  ];
}

function lerp(a, b, u) {
  return a + (b - a) * u;
}

function smoothstep(t) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}
