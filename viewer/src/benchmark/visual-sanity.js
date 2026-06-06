export async function captureCanvasVisualSanity(canvas) {
  try {
    const screenshotDataUrl = canvas.toDataURL('image/png');
    const image = await loadImage(screenshotDataUrl);
    const maxSide = 160;
    const scale = Math.min(1, maxSide / Math.max(1, image.width, image.height));
    const width = Math.max(1, Math.floor(image.width * scale));
    const height = Math.max(1, Math.floor(image.height * scale));
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = width;
    sampleCanvas.height = height;
    const ctx = sampleCanvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0, width, height);
    const pixels = ctx.getImageData(0, 0, width, height).data;
    const stats = measurePixels(pixels);

    return {
      captured: true,
      nonEmptyCanvas: stats.variance > 4 || stats.nonBackgroundRatio > 0.01,
      width: image.width,
      height: image.height,
      sampledWidth: width,
      sampledHeight: height,
      variance: round(stats.variance, 4),
      nonBackgroundRatio: round(stats.nonBackgroundRatio, 6),
      screenshotDataUrl,
      notes: 'Canvas PNG captured in browser runtime.'
    };
  } catch (error) {
    return {
      captured: false,
      nonEmptyCanvas: null,
      notes: error?.message ?? String(error)
    };
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to decode canvas screenshot'));
    image.src = src;
  });
}

function measurePixels(pixels) {
  const first = luminance(pixels, 0);
  let sum = 0;
  let sumSq = 0;
  let changed = 0;
  const count = pixels.length / 4;

  for (let i = 0; i < pixels.length; i += 4) {
    const y = luminance(pixels, i);
    sum += y;
    sumSq += y * y;
    if (Math.abs(y - first) > 4) {
      changed += 1;
    }
  }

  const mean = sum / Math.max(1, count);
  return {
    variance: sumSq / Math.max(1, count) - mean * mean,
    nonBackgroundRatio: changed / Math.max(1, count)
  };
}

function luminance(pixels, index) {
  return pixels[index] * 0.2126 + pixels[index + 1] * 0.7152 + pixels[index + 2] * 0.0722;
}

function round(value, places) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}
