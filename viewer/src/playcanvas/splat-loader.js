import { Asset, Entity } from 'playcanvas';

export function loadSplatEntity(app, url) {
  return new Promise((resolve, reject) => {
    const asset = new Asset(`splat:${url}`, 'gsplat', { url });

    asset.once('load', () => {
      const entity = new Entity('BenchmarkSplat');
      entity.addComponent('gsplat', { asset });
      app.root.addChild(entity);
      resolve(entity);
    });

    asset.once('error', (err) => {
      reject(new Error(`Failed to load GSplat asset ${url}: ${err?.message ?? err}`));
    });

    app.assets.add(asset);
    app.assets.load(asset);
  });
}
