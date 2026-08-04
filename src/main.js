import '98.css/dist/98.css';
import './styles.css';
import { createLegacySceneDefinition } from './scene/legacyScene.js';
import {
  applyPreviewMode,
  buildLegacyScene,
  buildModelScene,
  disposeObject3D,
} from './scene/sceneFactory.js';
import { loadBuiltInModel, loadLocalModel } from './scene/modelLoader.js';
import { serializeScene, sceneTransferables } from './scene/serializeScene.js';
import { PreviewRenderer } from './render/PreviewRenderer.js';
import { RenderClient } from './render/RenderClient.js';
import { SceneEditor } from './editor/SceneEditor.js';
import { mountLayout } from './ui/layout.js';
import { DesktopUi } from './ui/DesktopUi.js';
import {
  escapeHtml,
  formatDuration,
  formatNumber,
  formatVector,
} from './ui/format.js';

const app = document.querySelector('#app');
mountLayout(app);

const $ = (selector) => document.querySelector(selector);
const elements = {
  statusDot: $('#status-dot'),
  statusText: $('#status-text'),
  sceneSelect: $('#scene-select'),
  modernInfoButton: $('#modern-info-button'),
  modeInputs: [...document.querySelectorAll('input[name="mode"]')],
  resolutionSelect: $('#resolution-select'),
  supersamplingSelect: $('#supersampling-select'),
  depthSelect: $('#depth-select'),
  renderButton: $('#render-button'),
  cancelButton: $('#cancel-button'),
  loadModelButton: $('#load-model-button'),
  modelFileInput: $('#model-file-input'),
  resetCameraButton: $('#reset-camera-button'),
  showRays: $('#show-rays'),
  clearRaysButton: $('#clear-rays-button'),
  saveImageButton: $('#save-image-button'),
  previewContainer: $('#preview-container'),
  cameraStale: $('#camera-stale'),
  outputCanvas: $('#output-canvas'),
  outputEmpty: $('#output-empty'),
  pixelMarker: $('#pixel-marker'),
  outputCornerLabel: $('#output-corner-label'),
  progressFill: $('#progress-fill'),
  progressLabel: $('#progress-label'),
  renderElapsedInline: $('#render-elapsed-inline'),
  renderModeChip: $('#render-mode-chip'),
  sceneObjectCount: $('#scene-object-count'),
  sceneTriangleCount: $('#scene-triangle-count'),
  sceneSource: $('#scene-source'),
  statElapsed: $('#stat-elapsed'),
  statBuildTime: $('#stat-build-time'),
  statThroughput: $('#stat-throughput'),
  statRays: $('#stat-rays'),
  statRayMix: $('#stat-ray-mix'),
  statTriangles: $('#stat-triangles'),
  statBvh: $('#stat-bvh'),
  statShadowed: $('#stat-shadowed'),
  statDepth: $('#stat-depth'),
  statIntersections: $('#stat-intersections'),
  depthChart: $('#depth-chart'),
  objectHitList: $('#object-hit-list'),
  inspectorContent: $('#inspector-content'),
  legacyStrip: $('#legacy-strip'),
  colorSeed: $('#color-seed'),
  reseedButton: $('#reseed-button'),
  objectSelect: $('#object-select'),
  selectedObjectCaption: $('#selected-object-caption'),
  materialDialogObjectCaption: $('#material-dialog-object-caption'),
  transformTranslateButton: $('#transform-translate-button'),
  transformRotateButton: $('#transform-rotate-button'),
  transformScaleButton: $('#transform-scale-button'),
  transformSpaceSelect: $('#transform-space-select'),
  transformResetButton: $('#transform-reset-button'),
  deselectObjectButton: $('#deselect-object-button'),
  transformPositionX: $('#transform-position-x'),
  transformPositionY: $('#transform-position-y'),
  transformPositionZ: $('#transform-position-z'),
  transformRotationX: $('#transform-rotation-x'),
  transformRotationY: $('#transform-rotation-y'),
  transformRotationZ: $('#transform-rotation-z'),
  transformScaleX: $('#transform-scale-x'),
  transformScaleY: $('#transform-scale-y'),
  transformScaleZ: $('#transform-scale-z'),
  materialColor: $('#material-color'),
  materialColorValue: $('#material-color-value'),
  materialTextureButton: $('#material-texture-button'),
  materialTextureRemove: $('#material-texture-remove'),
  materialTextureInput: $('#material-texture-input'),
  materialTextureName: $('#material-texture-name'),
  materialUvStatus: $('#material-uv-status'),
  materialReflectivity: $('#material-reflectivity'),
  materialLegacyReflectivity: $('#material-legacy-reflectivity'),
  materialRoughness: $('#material-roughness'),
  materialSpecular: $('#material-specular'),
  materialTransmission: $('#material-transmission'),
  materialIor: $('#material-ior'),
  materialResetButton: $('#material-reset-button'),
  openMaterialEditorButton: $('#open-material-editor-button'),
  openAnalysisButton: $('#open-analysis-button'),
  restoreRenderRaysButton: $('#restore-render-rays-button'),
  inspectorRayFocusNote: $('#inspector-ray-focus-note'),
  toastRegion: $('#toast-region'),
};

const outputContext = elements.outputCanvas.getContext('2d', { alpha: false });
outputContext.imageSmoothingEnabled = true;

let worldRoot = null;
let currentSceneKey = 'legacy';
let currentSceneLabel = 'Original GLScene composition';
let suppressSceneDirty = false;
let renderInProgress = false;
let renderAvailable = false;
let firstTileReceived = false;
let currentResolution = { width: 320, height: 240 };
let lastUiUpdate = 0;
let assetWarnings = new Set();
let sceneEditor = null;
let desktopUi = null;

function selectedMode() {
  return document.querySelector('input[name="mode"]:checked')?.value ?? 'legacy';
}

function selectedResolution() {
  const [width, height] = elements.resolutionSelect.value.split('x').map(Number);
  return { width, height };
}

function syncDesktopCommands() {
  if (!desktopUi) return;
  const hasSelection = Boolean(sceneEditor?.selected);
  const editorAvailable = hasSelection && !renderInProgress;

  desktopUi.setCommandEnabled('load-model', !renderInProgress);
  desktopUi.setCommandEnabled('save-image', !elements.saveImageButton.disabled);
  desktopUi.setCommandEnabled('reload-scene', !renderInProgress);
  desktopUi.setCommandEnabled('transform-translate', editorAvailable);
  desktopUi.setCommandEnabled('transform-rotate', editorAvailable);
  desktopUi.setCommandEnabled('transform-scale', editorAvailable);
  desktopUi.setCommandEnabled('reset-transform', editorAvailable);
  desktopUi.setCommandEnabled('deselect-object', editorAvailable);
  desktopUi.setCommandEnabled('reset-camera', !renderInProgress);
  desktopUi.setCommandEnabled('trace-scene', !renderInProgress);
  desktopUi.setCommandEnabled('cancel-render', renderInProgress);
  desktopUi.setCommandEnabled('algorithm-original', !renderInProgress);
  desktopUi.setCommandEnabled('algorithm-modern', !renderInProgress);
  desktopUi.setCommandEnabled('clear-ray-paths', Boolean(preview?.hasAnyRays?.()));

  desktopUi.setCommandChecked('transform-translate', sceneEditor?.currentMode === 'translate');
  desktopUi.setCommandChecked('transform-rotate', sceneEditor?.currentMode === 'rotate');
  desktopUi.setCommandChecked('transform-scale', sceneEditor?.currentMode === 'scale');
  desktopUi.setCommandChecked('toggle-sampled-rays', elements.showRays.checked);
  desktopUi.setCommandChecked('algorithm-original', selectedMode() === 'legacy');
  desktopUi.setCommandChecked('algorithm-modern', selectedMode() === 'modern');
}

function setStatus(text, state = 'ready') {
  elements.statusText.textContent = text;
  elements.statusDot.dataset.state = state;
}

function setRenderControls(running) {
  renderInProgress = running;
  elements.renderButton.disabled = running;
  elements.cancelButton.disabled = !running;
  elements.sceneSelect.disabled = running;
  elements.resolutionSelect.disabled = running;
  elements.supersamplingSelect.disabled = running;
  elements.depthSelect.disabled = running;
  for (const input of elements.modeInputs) input.disabled = running;
  elements.loadModelButton.disabled = running;
  elements.resetCameraButton.disabled = running;
  elements.reseedButton.disabled = running;
  sceneEditor?.setEnabled(!running);
  syncDesktopCommands();
}

function toast(message, tone = 'info', timeout = 5200) {
  const node = document.createElement('div');
  node.className = `toast ${tone}`;
  node.textContent = message;
  elements.toastRegion.append(node);
  requestAnimationFrame(() => node.classList.add('visible'));
  window.setTimeout(() => {
    node.classList.remove('visible');
    window.setTimeout(() => node.remove(), 240);
  }, timeout);
}

function markSceneDirty() {
  if (suppressSceneDirty || !renderAvailable) return;
  elements.cameraStale.classList.add('visible');
}

const preview = new PreviewRenderer(elements.previewContainer, markSceneDirty);
sceneEditor = new SceneEditor({
  preview,
  elements,
  onSceneChanged: markSceneDirty,
  onUiChanged: syncDesktopCommands,
  toast,
  getRenderMode: selectedMode,
});

function setOutputEmpty(title, detail) {
  const strong = elements.outputEmpty.querySelector('strong');
  const small = elements.outputEmpty.querySelector('small');
  strong.textContent = title;
  small.textContent = detail;
  elements.outputEmpty.classList.remove('hidden');
}

function hideOutputEmpty() {
  elements.outputEmpty.classList.add('hidden');
}

function clearOutput(width = currentResolution.width, height = currentResolution.height) {
  elements.outputCanvas.width = width;
  elements.outputCanvas.height = height;
  outputContext.fillStyle = '#020307';
  outputContext.fillRect(0, 0, width, height);
  elements.outputCornerLabel.textContent = `${width} × ${height}`;
  elements.pixelMarker.classList.remove('visible');
  elements.saveImageButton.disabled = true;
  firstTileReceived = false;
  syncDesktopCommands();
}

function resetStatistics() {
  elements.progressFill.style.width = '0%';
  elements.progressLabel.textContent = 'Idle';
  elements.renderElapsedInline.textContent = '0.00 s';
  elements.statElapsed.textContent = '0.00 s';
  elements.statBuildTime.textContent = 'BVH not built';
  elements.statThroughput.textContent = '0 px/s';
  elements.statRays.textContent = '0';
  elements.statRayMix.textContent = 'primary · shadow · recursive';
  elements.statTriangles.textContent = '0 tris';
  elements.statBvh.textContent = '0 BVH nodes';
  elements.statShadowed.textContent = '0.0%';
  elements.statDepth.textContent = '0.00';
  elements.statIntersections.textContent = '0 triangle tests';
  elements.depthChart.innerHTML = '<div class="chart-placeholder">Trace a scene to populate the depth histogram.</div>';
  elements.objectHitList.innerHTML = '<div class="chart-placeholder">Object statistics will appear during rendering.</div>';
}

function previewCounts(root) {
  let objects = 0;
  let triangles = 0;
  root.traverse((child) => {
    if (!child.isMesh || child.userData.raytrace === false) return;
    objects += 1;
    const geometry = child.geometry;
    if (!geometry?.attributes?.position) return;
    triangles += Math.floor((geometry.index?.count ?? geometry.attributes.position.count) / 3);
  });
  return { objects, triangles };
}

function updateSceneMetadata(root) {
  const counts = previewCounts(root);
  const definition = root.userData.sceneDefinition ?? {};
  elements.sceneObjectCount.textContent = `${formatNumber(counts.objects)} ray-traceable objects`;
  elements.sceneTriangleCount.textContent = `${formatNumber(counts.triangles)} preview triangles`;
  elements.sceneSource.textContent = `Source: ${definition.source ?? currentSceneLabel}`;
  elements.legacyStrip.classList.toggle('hidden', currentSceneKey !== 'legacy');
}

function installWorld(root, sceneKey, label) {
  const previous = worldRoot;
  suppressSceneDirty = true;
  preview.setWorld(root);
  sceneEditor.setWorld(root);
  suppressSceneDirty = false;
  worldRoot = root;
  currentSceneKey = sceneKey;
  currentSceneLabel = label;
  if (previous) disposeObject3D(previous);

  renderAvailable = false;
  elements.cameraStale.classList.remove('visible');
  preview.clearRays();
  preview.setRenderRaysVisible(elements.showRays.checked);
  elements.restoreRenderRaysButton.disabled = true;
  elements.inspectorRayFocusNote.textContent = 'Click the rendered image to isolate and reconstruct one optical path.';
  updateSceneMetadata(root);
  clearOutput();
  setOutputEmpty('No photons interrogated yet', 'Position the camera, then trace the scene.');
  resetStatistics();
  elements.inspectorContent.innerHTML = `
    <div class="inspector-placeholder">
      <div class="crosshair-icon" aria-hidden="true"></div>
      <p>Select a pixel to reconstruct its primary, shadow, reflection, and refraction paths in 3D.</p>
    </div>
  `;
  syncDesktopCommands();
}

async function loadScene(sceneKey) {
  renderClient.cancel();
  setStatus('Loading scene', 'working');
  elements.sceneSelect.disabled = true;
  assetWarnings = new Set();

  try {
    let root;
    let label;
    if (sceneKey === 'legacy') {
      const definition = createLegacySceneDefinition(Number(elements.colorSeed.value));
      root = buildLegacyScene(definition, selectedMode());
      label = definition.name;
    } else {
      const loaded = await loadBuiltInModel(sceneKey, (url) => {
        if (assetWarnings.has(url)) return;
        assetWarnings.add(url);
        toast(`A referenced texture was not found (${url.split('/').pop()}); fallback material colors remain usable.`, 'warning', 7200);
      });
      root = buildModelScene(loaded.model, loaded.label);
      label = loaded.label;
    }

    installWorld(root, sceneKey, label);
    setStatus('Ready', 'ready');
  } catch (error) {
    elements.sceneSelect.value = currentSceneKey;
    setStatus('Scene load failed', 'error');
    toast(error instanceof Error ? error.message : String(error), 'error', 8000);
  } finally {
    elements.sceneSelect.disabled = renderInProgress;
  }
}

function updateDepthChart(raysByDepth = []) {
  const values = raysByDepth.slice(1);
  const lastNonZero = values.reduce((last, value, index) => (value > 0 ? index : last), -1);
  const visible = values.slice(0, Math.max(1, lastNonZero + 1));
  const maximumLog = Math.max(1, ...visible.map((value) => Math.log10(value + 1)));

  elements.depthChart.innerHTML = visible.map((value, index) => {
    const height = value > 0 ? Math.max(4, (Math.log10(value + 1) / maximumLog) * 100) : 1;
    return `
      <div class="depth-column" title="Depth ${index + 1}: ${formatNumber(value)} traced rays">
        <span class="depth-value">${formatNumber(value)}</span>
        <div class="depth-bar-wrap"><div class="depth-bar" style="height:${height}%"></div></div>
        <span class="depth-label">D${index + 1}</span>
      </div>
    `;
  }).join('');
}

function updateObjectHits(objectHits = []) {
  const visible = objectHits
    .filter((entry) => entry.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 9);

  if (!visible.length) {
    elements.objectHitList.innerHTML = '<div class="chart-placeholder">No surface intersections yet.</div>';
    return;
  }

  const maximum = Math.max(...visible.map((entry) => entry.hits));
  elements.objectHitList.innerHTML = visible.map((entry, index) => `
    <div class="object-hit-row">
      <span class="object-rank">${String(index + 1).padStart(2, '0')}</span>
      <span class="object-name" title="${escapeHtml(entry.name)}">${escapeHtml(entry.name)}</span>
      <span class="object-kind">${escapeHtml(entry.kind)}</span>
      <span class="object-meter"><i style="width:${(entry.hits / maximum) * 100}%"></i></span>
      <strong>${formatNumber(entry.hits)}</strong>
    </div>
  `).join('');
}

function updateStatistics(stats, elapsedMilliseconds, completedPixels, totalPixels) {
  const elapsedSeconds = Math.max(0.001, elapsedMilliseconds / 1000);
  const throughput = completedPixels / elapsedSeconds;
  const shadowPercentage = stats.shadowRays ? (stats.shadowed / stats.shadowRays) * 100 : 0;
  const depthTotal = stats.raysByDepth.reduce((sum, count) => sum + count, 0);
  const weightedDepth = stats.raysByDepth.reduce((sum, count, depth) => sum + count * depth, 0);
  const meanDepth = depthTotal ? weightedDepth / depthTotal : 0;
  const recursive = stats.reflectionRays + stats.refractionRays;

  elements.statElapsed.textContent = formatDuration(elapsedMilliseconds);
  elements.renderElapsedInline.textContent = formatDuration(elapsedMilliseconds);
  elements.statThroughput.textContent = `${formatNumber(throughput)} px/s`;
  elements.statRays.textContent = formatNumber(stats.totalRays);
  elements.statRayMix.textContent = `${formatNumber(stats.primaryRays)} primary · ${formatNumber(stats.shadowRays)} shadow · ${formatNumber(recursive)} recursive`;
  elements.statShadowed.textContent = `${shadowPercentage.toFixed(1)}%`;
  elements.statDepth.textContent = meanDepth.toFixed(2);
  elements.statIntersections.textContent = `${formatNumber(stats.triangleTests)} triangle tests`;
  elements.progressLabel.textContent = `${formatNumber(completedPixels)} / ${formatNumber(totalPixels)} pixels`;
  updateDepthChart(stats.raysByDepth);
  updateObjectHits(stats.objectHits);
}

function flattenTree(node, output = []) {
  if (!node) return output;
  output.push(node);
  for (const child of node.children ?? []) flattenTree(child, output);
  return output;
}

function colorCss(color) {
  const channels = color.map((value) => Math.round(Math.min(1, Math.max(0, value)) * 255));
  return `rgb(${channels.join(',')})`;
}

function setSampledRaysVisible(visible, reason = 'manual') {
  const next = Boolean(visible);
  elements.showRays.checked = next;
  preview.setRenderRaysVisible(next);
  elements.restoreRenderRaysButton.disabled = next || !preview.hasRenderRays();

  if (next) {
    elements.inspectorRayFocusNote.textContent = 'Sampled render rays restored. The thicker path remains the selected pixel.';
  } else if (reason === 'microscope' && preview.hasRenderRays()) {
    elements.inspectorRayFocusNote.textContent = 'Sampled render rays are hidden so the selected pixel path is easy to see.';
  } else if (preview.hasRenderRays()) {
    elements.inspectorRayFocusNote.textContent = 'Sampled render rays are hidden. Use Restore sampled rays to show them again.';
  }
  syncDesktopCommands();
}

function clearAllRayPaths() {
  preview.clearRays();
  elements.restoreRenderRaysButton.disabled = true;
  elements.inspectorRayFocusNote.textContent = 'All ray paths cleared. Click the rendered image to inspect another pixel.';
  syncDesktopCommands();
}

function restoreSampledRays() {
  if (!preview.hasRenderRays()) return;
  setSampledRaysVisible(true, 'restore');
}

function renderInspector(result) {
  const nodes = flattenTree(result.tree);
  const rayCards = nodes.map((node, index) => {
    const hit = node.hit;
    const lightRows = (node.lights ?? []).map((light) => `
      <div class="inspector-light ${light.blocked ? 'blocked' : ''}">
        <span>${escapeHtml(light.name ?? 'Light')}</span>
        <span>N·L ${light.normalDotLight.toFixed(3)}</span>
        <strong>${light.blocked ? 'occluded' : 'visible'}</strong>
      </div>
    `).join('');

    return `
      <article class="ray-node ${escapeHtml(node.rayType)}">
        <div class="ray-node-index">${String(index + 1).padStart(2, '0')}</div>
        <div class="ray-node-main">
          <div class="ray-node-title">
            <strong>${escapeHtml(node.rayType)}</strong>
            <span>depth ${node.depth}</span>
            ${hit ? `<em>${escapeHtml(hit.object)}</em>` : '<em>background miss</em>'}
          </div>
          ${hit ? `
            <div class="ray-node-grid">
              <span>distance</span><code>${hit.distance.toFixed(5)}</code>
              <span>point</span><code>${formatVector(hit.point)}</code>
              <span>normal</span><code>${formatVector(hit.normal)}</code>
              ${hit.texture ? `<span>texture</span><code>${escapeHtml(hit.texture)}</code>` : ''}
              ${hit.textureUv ? `<span>UV</span><code>${formatVector(hit.textureUv, 4)}</code>` : ''}
              <span>local</span><code>${formatVector(node.localColor)}</code>
              <span>final</span><code>${formatVector(node.finalColor)}</code>
            </div>
            ${lightRows}
          ` : `
            <div class="ray-node-grid">
              <span>direction</span><code>${formatVector(node.direction)}</code>
              <span>final</span><code>${formatVector(node.finalColor)}</code>
            </div>
          `}
        </div>
      </article>
    `;
  }).join('');

  elements.inspectorContent.innerHTML = `
    <div class="pixel-summary">
      <div class="pixel-swatch" style="background:${colorCss(result.displayColor)}"></div>
      <div>
        <span>Pixel ${result.x}, ${result.y}</span>
        <strong>RGB ${result.rgba.slice(0, 3).join(', ')}</strong>
      </div>
      <code>linear ${formatVector(result.rawColor, 4)}</code>
      <span>${result.segments.length} visualized segments</span>
    </div>
    <div class="ray-node-list">${rayCards}</div>
  `;
}

const renderClient = new RenderClient({
  onStarted(message) {
    renderAvailable = true;
    elements.statTriangles.textContent = `${formatNumber(message.triangleCount)} tris`;
    elements.statBvh.textContent = `${formatNumber(message.bvhNodeCount)} BVH nodes`;
    elements.statBuildTime.textContent = `BVH ${formatDuration(message.bvhBuildMilliseconds)}`;
    elements.sceneTriangleCount.textContent = `${formatNumber(message.triangleCount)} compiled triangles`;
    setStatus('Tracing pixels', 'working');
  },
  onTile(message) {
    const { tile } = message;
    const pixels = tile.pixels instanceof Uint8ClampedArray
      ? tile.pixels
      : new Uint8ClampedArray(tile.pixels);
    outputContext.putImageData(new ImageData(pixels, tile.width, tile.height), tile.x, tile.y);

    if (!firstTileReceived) {
      firstTileReceived = true;
      hideOutputEmpty();
      elements.saveImageButton.disabled = false;
      syncDesktopCommands();
    }
    preview.addRenderSegments(message.segments);
    if (!elements.showRays.checked && preview.hasRenderRays()) {
      elements.restoreRenderRaysButton.disabled = false;
    }

    const percentage = Math.min(100, message.progress * 100);
    elements.progressFill.style.width = `${percentage}%`;
    const now = performance.now();
    if (now - lastUiUpdate > 90 || message.progress >= 1) {
      lastUiUpdate = now;
      updateStatistics(
        message.stats,
        message.elapsedMilliseconds,
        message.completedPixels,
        message.totalPixels,
      );
    }
  },
  onDone(message) {
    setRenderControls(false);
    elements.progressFill.style.width = '100%';
    elements.progressLabel.textContent = 'Render complete';
    updateStatistics(
      message.stats,
      message.elapsedMilliseconds,
      currentResolution.width * currentResolution.height,
      currentResolution.width * currentResolution.height,
    );
    elements.cameraStale.classList.remove('visible');
    setStatus('Render complete', 'success');
    toast(`Ray trace completed in ${formatDuration(message.elapsedMilliseconds)}.`, 'success', 3600);
  },
  onCancelled() {
    setRenderControls(false);
    elements.progressLabel.textContent = 'Cancelled — partial image retained';
    setStatus('Render cancelled', 'ready');
  },
  onError(message) {
    setRenderControls(false);
    setStatus('Renderer error', 'error');
    toast(message, 'error', 8000);
  },
});

async function startRender() {
  if (!worldRoot || renderInProgress) return;

  currentResolution = selectedResolution();
  clearOutput(currentResolution.width, currentResolution.height);
  preview.clearRays();
  preview.setRenderRaysVisible(elements.showRays.checked);
  elements.restoreRenderRaysButton.disabled = true;
  elements.inspectorRayFocusNote.textContent = 'Trace a pixel after the first tile appears.';
  syncDesktopCommands();
  elements.inspectorContent.innerHTML = '<div class="inspector-placeholder"><div class="loader-ring"></div><p>Trace a pixel after the first tile appears.</p></div>';
  setOutputEmpty('Compiling scene', 'Flattening meshes and constructing the ray-tracing payload…');
  elements.progressLabel.textContent = 'Compiling triangles';
  elements.progressFill.style.width = '0%';
  elements.renderModeChip.textContent = selectedMode() === 'legacy' ? 'Original algorithm' : 'Modernized algorithm';
  setRenderControls(true);
  setStatus('Compiling scene', 'working');
  renderAvailable = false;
  elements.cameraStale.classList.remove('visible');
  await new Promise((resolve) => requestAnimationFrame(resolve));

  try {
    const camera = preview.getCameraSnapshot();
    const scene = serializeScene(worldRoot, camera);
    for (const warning of scene.warnings ?? []) toast(warning, 'warning', 7600);
    const config = {
      width: currentResolution.width,
      height: currentResolution.height,
      supersampling: Number(elements.supersamplingSelect.value),
      maxDepth: Number(elements.depthSelect.value),
      mode: selectedMode(),
      tileSize: 32,
      raySampleCount: elements.showRays.checked ? 300 : 0,
      leafSize: 8,
    };
    renderClient.start(scene, config, sceneTransferables(scene));
  } catch (error) {
    setRenderControls(false);
    setStatus('Compilation failed', 'error');
    setOutputEmpty('Could not compile scene', 'Inspect the error message and try another model.');
    toast(error instanceof Error ? error.message : String(error), 'error', 8000);
  }
}

async function inspectPixel(event) {
  if (!renderAvailable || !firstTileReceived) {
    toast('Wait for the first rendered tile before opening the pixel microscope.', 'warning');
    return;
  }
  const bounds = elements.outputCanvas.getBoundingClientRect();
  const x = Math.min(
    elements.outputCanvas.width - 1,
    Math.max(0, Math.floor(((event.clientX - bounds.left) / bounds.width) * elements.outputCanvas.width)),
  );
  const y = Math.min(
    elements.outputCanvas.height - 1,
    Math.max(0, Math.floor(((event.clientY - bounds.top) / bounds.height) * elements.outputCanvas.height)),
  );

  elements.pixelMarker.style.left = `${((x + 0.5) / elements.outputCanvas.width) * 100}%`;
  elements.pixelMarker.style.top = `${((y + 0.5) / elements.outputCanvas.height) * 100}%`;
  elements.pixelMarker.classList.add('visible');
  desktopUi?.openDialog('analysis', { analysisTab: 'pixel' });
  elements.inspectorContent.innerHTML = '<div class="inspector-placeholder"><div class="loader-ring"></div><p>Reconstructing the selected optical path…</p></div>';
  preview.clearInspectorRays();
  setSampledRaysVisible(false, 'microscope');

  try {
    const result = await renderClient.inspect(x, y);
    preview.setInspectorSegments(result.segments);
    elements.inspectorRayFocusNote.textContent = preview.hasRenderRays()
      ? 'Sampled render rays are hidden; the thick path in the viewport belongs only to this pixel.'
      : 'The thick path in the viewport belongs only to this selected pixel.';
    renderInspector(result);
    syncDesktopCommands();
  } catch (error) {
    toast(error instanceof Error ? error.message : String(error), 'error');
  }
}

function saveImage() {
  elements.outputCanvas.toBlob((blob) => {
    if (!blob) return;
    const link = document.createElement('a');
    const stamp = new Date().toISOString().replaceAll(':', '-').replace(/\.\d{3}Z$/, 'Z');
    link.download = `my-render-${stamp}.png`;
    link.href = URL.createObjectURL(blob);
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }, 'image/png');
}

async function loadCustomFile(file) {
  if (!file) return;
  renderClient.cancel();
  setStatus('Loading custom model', 'working');
  elements.loadModelButton.disabled = true;
  assetWarnings = new Set();

  try {
    const loaded = await loadLocalModel(file, (url) => {
      if (assetWarnings.has(url)) return;
      assetWarnings.add(url);
      toast(`A companion asset could not be resolved (${url.split('/').pop()}). Self-contained .glb files are most reliable.`, 'warning', 7200);
    });
    const root = buildModelScene(loaded.model, loaded.label);
    let customOption = elements.sceneSelect.querySelector('option[value="custom"]');
    if (!customOption) {
      customOption = document.createElement('option');
      customOption.value = 'custom';
      elements.sceneSelect.append(customOption);
    }
    customOption.textContent = `Custom · ${file.name}`;
    elements.sceneSelect.value = 'custom';
    installWorld(root, 'custom', file.name);
    setStatus('Ready', 'ready');
    toast(`${file.name} loaded and normalized for preview and CPU tracing.`, 'success');
  } catch (error) {
    setStatus('Model load failed', 'error');
    toast(error instanceof Error ? error.message : String(error), 'error', 8000);
  } finally {
    elements.loadModelButton.disabled = renderInProgress;
    elements.modelFileInput.value = '';
  }
}

function setAlgorithmMode(mode) {
  const target = mode === 'modern'
    ? document.querySelector('#mode-modern')
    : document.querySelector('#mode-legacy');
  if (!target || target.disabled || target.checked) return;
  target.checked = true;
  target.dispatchEvent(new Event('change', { bubbles: true }));
}

function reloadCurrentScene() {
  if (currentSceneKey === 'custom') {
    toast('A local model cannot be reloaded after its file handle is released. Use File > Load model... to choose it again.', 'warning', 6200);
    return;
  }
  elements.sceneSelect.value = currentSceneKey;
  loadScene(currentSceneKey);
}

function openAnalysis(tab = 'summary') {
  desktopUi?.openDialog('analysis', { analysisTab: tab });
}

function handleDesktopCommand(command) {
  const commands = {
    'load-model': () => elements.modelFileInput.click(),
    'save-image': () => {
      if (!elements.saveImageButton.disabled) saveImage();
    },
    'reload-scene': reloadCurrentScene,
    'transform-translate': () => sceneEditor.setTransformMode('translate'),
    'transform-rotate': () => sceneEditor.setTransformMode('rotate'),
    'transform-scale': () => sceneEditor.setTransformMode('scale'),
    'reset-transform': () => sceneEditor.resetTransform(),
    'deselect-object': () => sceneEditor.setSelection(null),
    'open-material-editor': () => desktopUi?.openDialog('material'),
    'open-analysis-summary': () => openAnalysis('summary'),
    'open-analysis-rays': () => openAnalysis('rays'),
    'open-analysis-intersections': () => openAnalysis('intersections'),
    'open-analysis-pixel': () => openAnalysis('pixel'),
    'toggle-sampled-rays': () => setSampledRaysVisible(!elements.showRays.checked),
    'clear-ray-paths': clearAllRayPaths,
    'reset-camera': () => preview.resetCamera(),
    'trace-scene': startRender,
    'cancel-render': () => renderClient.cancel(),
    'algorithm-original': () => setAlgorithmMode('legacy'),
    'algorithm-modern': () => setAlgorithmMode('modern'),
    'show-modern-info': () => desktopUi?.openDialog('modern-info'),
    'show-about': () => desktopUi?.openDialog('about'),
  };
  commands[command]?.();
}

desktopUi = new DesktopUi({
  root: document,
  onCommand: handleDesktopCommand,
  onBeforeMenuOpen: syncDesktopCommands,
});
syncDesktopCommands();

elements.modernInfoButton.addEventListener('click', () => desktopUi.openDialog('modern-info'));
elements.openMaterialEditorButton.addEventListener('click', () => desktopUi.openDialog('material'));
elements.openAnalysisButton.addEventListener('click', () => openAnalysis('summary'));
elements.restoreRenderRaysButton.addEventListener('click', restoreSampledRays);

elements.sceneSelect.addEventListener('change', () => {
  if (elements.sceneSelect.value === 'custom') return;
  loadScene(elements.sceneSelect.value);
});
elements.renderButton.addEventListener('click', startRender);
elements.cancelButton.addEventListener('click', () => renderClient.cancel());
elements.resetCameraButton.addEventListener('click', () => preview.resetCamera());
elements.loadModelButton.addEventListener('click', () => elements.modelFileInput.click());
elements.modelFileInput.addEventListener('change', () => loadCustomFile(elements.modelFileInput.files?.[0]));
elements.outputCanvas.addEventListener('click', inspectPixel);
elements.saveImageButton.addEventListener('click', saveImage);
elements.showRays.addEventListener('change', () => setSampledRaysVisible(elements.showRays.checked));
elements.clearRaysButton.addEventListener('click', clearAllRayPaths);
elements.reseedButton.addEventListener('click', () => {
  if (currentSceneKey !== 'legacy') return;
  loadScene('legacy');
});

document.querySelectorAll('input[name="mode"]').forEach((input) => {
  input.addEventListener('change', () => {
    applyPreviewMode(worldRoot, selectedMode());
    sceneEditor.refreshMaterialPreview();
    elements.renderModeChip.textContent = selectedMode() === 'legacy' ? 'Original algorithm' : 'Modernized algorithm';
    markSceneDirty();
    syncDesktopCommands();
  });
});

elements.resolutionSelect.addEventListener('change', () => {
  if (renderInProgress) return;
  const resolution = selectedResolution();
  elements.outputCornerLabel.textContent = `${resolution.width} × ${resolution.height}`;
});

window.addEventListener('beforeunload', () => {
  desktopUi?.dispose();
  renderClient.dispose();
  sceneEditor.dispose();
  preview.dispose();
  disposeObject3D(worldRoot);
});

clearOutput();
resetStatistics();
loadScene('legacy');
