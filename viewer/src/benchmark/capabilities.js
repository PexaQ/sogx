export async function detectCapabilities() {
  const webgpu = await detectWebGpu();
  const webgl2 = detectWebGl2();
  return { webgpu, webgl2 };
}

async function detectWebGpu() {
  if (!navigator.gpu) {
    return { supported: false };
  }

  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      return { supported: false, adapter: null };
    }

    return {
      supported: true,
      adapterInfo: safeAdapterInfo(adapter),
      features: Array.from(adapter.features ?? []),
      limits: adapter.limits ? {
        maxTextureDimension2D: adapter.limits.maxTextureDimension2D,
        maxBufferSize: adapter.limits.maxBufferSize,
        maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize
      } : null
    };
  } catch (error) {
    return { supported: false, error: error.message };
  }
}

function safeAdapterInfo(adapter) {
  const info = adapter.info;
  if (!info) {
    return null;
  }
  return {
    vendor: info.vendor ?? null,
    architecture: info.architecture ?? null,
    device: info.device ?? null,
    description: info.description ?? null
  };
}

function detectWebGl2() {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false });
  if (!gl) {
    return { supported: false };
  }

  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  return {
    supported: true,
    vendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
    renderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
    maxVertexUniformVectors: gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS),
    hasTimerQuery: Boolean(gl.getExtension('EXT_disjoint_timer_query_webgl2'))
  };
}
