import { createTracer, snapshotStats } from './tracer.js';

let activeJob = null;
let retainedTracer = null;
let retainedJobId = null;
let retainedObjects = [];

function makeTiles(width, height, tileSize) {
  const tiles = [];
  const centerX = width * 0.5;
  const centerY = height * 0.5;

  for (let y = 0; y < height; y += tileSize) {
    for (let x = 0; x < width; x += tileSize) {
      const tileWidth = Math.min(tileSize, width - x);
      const tileHeight = Math.min(tileSize, height - y);
      const tileCenterX = x + tileWidth * 0.5;
      const tileCenterY = y + tileHeight * 0.5;
      tiles.push({
        x,
        y,
        width: tileWidth,
        height: tileHeight,
        distance: (tileCenterX - centerX) ** 2 + (tileCenterY - centerY) ** 2,
      });
    }
  }

  return tiles.sort((a, b) => a.distance - b.distance);
}

function shouldCaptureRay(x, y, width, height, desiredSamples) {
  if (desiredSamples <= 0) return false;
  const modulus = Math.max(1, Math.floor((width * height) / desiredSamples));
  const hash = ((Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663)) >>> 0);
  return hash % modulus === 0;
}

function yieldToEventLoop() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function render(message) {
  if (activeJob) activeJob.cancelled = true;
  const job = { id: message.jobId, cancelled: false };
  activeJob = job;
  retainedTracer = null;
  retainedJobId = null;
  retainedObjects = [];

  const renderStarted = performance.now();
  let tracer;
  try {
    tracer = createTracer(message.scene, message.config);
  } catch (error) {
    self.postMessage({
      type: 'error',
      jobId: message.jobId,
      message: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  if (job.cancelled) return;
  retainedTracer = tracer;
  retainedJobId = message.jobId;
  retainedObjects = message.scene.objects;

  self.postMessage({
    type: 'started',
    jobId: message.jobId,
    triangleCount: tracer.bvh.triangleCount,
    bvhNodeCount: tracer.bvh.nodes.length,
    bvhBuildMilliseconds: tracer.bvhBuildMilliseconds,
    objectCount: message.scene.objects.length,
    materialCount: message.scene.materials.length,
  });

  const { width, height } = message.config;
  const tiles = makeTiles(width, height, message.config.tileSize ?? 32);
  const totalPixels = width * height;
  const desiredSamples = message.config.raySampleCount ?? 260;
  let completedPixels = 0;

  for (let tileIndex = 0; tileIndex < tiles.length; tileIndex += 1) {
    if (job.cancelled) {
      self.postMessage({ type: 'cancelled', jobId: message.jobId });
      return;
    }

    const tile = tiles[tileIndex];
    const pixels = new Uint8ClampedArray(tile.width * tile.height * 4);
    const segments = [];
    let pixelOffset = 0;

    for (let localY = 0; localY < tile.height; localY += 1) {
      const y = tile.y + localY;
      for (let localX = 0; localX < tile.width; localX += 1) {
        const x = tile.x + localX;
        const capture = shouldCaptureRay(x, y, width, height, desiredSamples)
          ? { segments: [], tree: false, includeNormals: false }
          : null;
        const rgba = tracer.tracePixel(x, y, capture);
        pixels[pixelOffset] = rgba[0];
        pixels[pixelOffset + 1] = rgba[1];
        pixels[pixelOffset + 2] = rgba[2];
        pixels[pixelOffset + 3] = rgba[3];
        pixelOffset += 4;

        if (capture?.segments.length && segments.length < 80) {
          segments.push(...capture.segments.slice(0, 80 - segments.length));
        }
      }
    }

    completedPixels += tile.width * tile.height;
    const elapsedMilliseconds = performance.now() - renderStarted;
    const stats = snapshotStats(tracer.stats, message.scene.objects);
    self.postMessage(
      {
        type: 'tile',
        jobId: message.jobId,
        tile: {
          x: tile.x,
          y: tile.y,
          width: tile.width,
          height: tile.height,
          pixels,
        },
        segments,
        progress: completedPixels / totalPixels,
        completedPixels,
        totalPixels,
        elapsedMilliseconds,
        stats,
      },
      [pixels.buffer],
    );

    if (tileIndex % 2 === 1) await yieldToEventLoop();
  }

  if (job.cancelled) return;
  const elapsedMilliseconds = performance.now() - renderStarted;
  self.postMessage({
    type: 'done',
    jobId: message.jobId,
    elapsedMilliseconds,
    stats: snapshotStats(tracer.stats, message.scene.objects),
  });
}

function inspect(message) {
  if (!retainedTracer || retainedJobId !== message.jobId) {
    self.postMessage({
      type: 'inspect-error',
      jobId: message.jobId,
      requestId: message.requestId,
      message: 'No completed or active render is available for pixel inspection.',
    });
    return;
  }

  try {
    const result = retainedTracer.inspectPixel(message.x, message.y);
    self.postMessage({
      type: 'inspect-result',
      jobId: message.jobId,
      requestId: message.requestId,
      result,
      stats: snapshotStats(retainedTracer.stats, retainedObjects),
    });
  } catch (error) {
    self.postMessage({
      type: 'inspect-error',
      jobId: message.jobId,
      requestId: message.requestId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

self.onmessage = (event) => {
  const message = event.data;
  if (message.type === 'render') {
    render(message);
  } else if (message.type === 'cancel') {
    if (activeJob?.id === message.jobId) activeJob.cancelled = true;
  } else if (message.type === 'inspect') {
    inspect(message);
  }
};
