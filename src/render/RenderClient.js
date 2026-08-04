export class RenderClient {
  constructor(handlers = {}) {
    this.handlers = handlers;
    this.worker = new Worker(
      new URL('../raytracer/raytracer.worker.js', import.meta.url),
      { type: 'module' },
    );
    this.worker.addEventListener('message', (event) => this.handleMessage(event.data));
    this.worker.addEventListener('error', (event) => {
      this.handlers.onError?.(event.message || 'The ray-tracing worker crashed.');
    });
    this.jobCounter = 0;
    this.requestCounter = 0;
    this.inspectRequests = new Map();
  }

  start(scene, config, transferables = []) {
    if (this.activeJobId) this.cancel();
    this.activeJobId = ++this.jobCounter;
    this.worker.postMessage(
      {
        type: 'render',
        jobId: this.activeJobId,
        scene,
        config,
      },
      transferables,
    );
    return this.activeJobId;
  }

  cancel() {
    if (!this.activeJobId) return;
    this.worker.postMessage({ type: 'cancel', jobId: this.activeJobId });
  }

  inspect(x, y) {
    if (!this.activeJobId) return Promise.reject(new Error('Render the scene before inspecting a pixel.'));
    const requestId = ++this.requestCounter;
    return new Promise((resolve, reject) => {
      this.inspectRequests.set(requestId, { resolve, reject });
      this.worker.postMessage({
        type: 'inspect',
        jobId: this.activeJobId,
        requestId,
        x,
        y,
      });
    });
  }

  handleMessage(message) {
    if (message.type === 'inspect-result' || message.type === 'inspect-error') {
      const request = this.inspectRequests.get(message.requestId);
      if (!request) return;
      this.inspectRequests.delete(message.requestId);
      if (message.type === 'inspect-result') request.resolve(message.result);
      else request.reject(new Error(message.message));
      return;
    }

    if (message.jobId !== this.activeJobId) return;
    switch (message.type) {
      case 'started':
        this.handlers.onStarted?.(message);
        break;
      case 'tile':
        this.handlers.onTile?.(message);
        break;
      case 'done':
        this.handlers.onDone?.(message);
        break;
      case 'cancelled':
        this.handlers.onCancelled?.(message);
        break;
      case 'error':
        this.handlers.onError?.(message.message);
        break;
      default:
        break;
    }
  }

  dispose() {
    this.worker.terminate();
    for (const request of this.inspectRequests.values()) {
      request.reject(new Error('Renderer disposed.'));
    }
    this.inspectRequests.clear();
  }
}
