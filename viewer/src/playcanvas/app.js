import {
  Application,
  Color,
  DEVICETYPE_WEBGL2,
  DEVICETYPE_WEBGPU,
  Entity,
  FILLMODE_FILL_WINDOW,
  RESOLUTION_AUTO,
  createGraphicsDevice
} from 'playcanvas';

export async function createBenchmarkApp(canvas, config) {
  const deviceTypes = config.backend === 'webgl2'
    ? [DEVICETYPE_WEBGL2]
    : [DEVICETYPE_WEBGPU, DEVICETYPE_WEBGL2];

  const graphicsDevice = await createGraphicsDevice(canvas, {
    antialias: config.canvasAntialias,
    deviceTypes,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: config.captureScreenshot
  });

  const app = new Application(canvas, { graphicsDevice });
  app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
  app.setCanvasResolution(RESOLUTION_AUTO);
  app.graphicsDevice.maxPixelRatio = config.initialDpr;

  const camera = new Entity('BenchmarkCamera');
  camera.addComponent('camera', {
    clearColor: new Color(0.035, 0.04, 0.045),
    farClip: 5000,
    fov: config.fov,
    nearClip: 0.02
  });
  camera.setPosition(0, 1.6, 4);
  camera.lookAt(0, 1.2, 0);
  app.root.addChild(camera);
  app.cameraEntity = camera;

  window.addEventListener('resize', () => {
    app.resizeCanvas(canvas.clientWidth, canvas.clientHeight);
  });

  app.start();
  return app;
}
