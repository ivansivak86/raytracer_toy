import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mountLayout } from '../src/ui/layout.js';

async function source(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

test('v0.3 desktop exposes functional menus, compact tools, dialogs, and the requested GitHub link', () => {
  const host = { innerHTML: '' };
  mountLayout(host);
  const html = host.innerHTML;

  assert.match(html, /id="main-menu-bar"/);
  assert.match(html, /data-menu-button="file"/);
  assert.match(html, /data-command="load-model"/);
  assert.match(html, /data-command="trace-scene"/);
  assert.match(html, /https:\/\/github\.com\/ivansivak86\/raytracer_delphi_threejs/);

  assert.match(html, /class="max-toolbar"/);
  assert.match(html, /id="open-material-editor-button"/);
  assert.match(html, /id="material-editor-dialog"[^>]*data-dialog="material"/);
  assert.match(html, /id="analysis-dialog"[^>]*data-dialog="analysis"/);
  assert.match(html, /data-analysis-tab="summary"/);
  assert.match(html, /data-analysis-tab="rays"/);
  assert.match(html, /data-analysis-tab="intersections"/);
  assert.match(html, /data-analysis-tab="pixel"/);
});

test('desktop controller dispatches commands and manages menus, draggable dialogs, and analysis tabs', async () => {
  const desktopUi = await source('../src/ui/DesktopUi.js');

  assert.match(desktopUi, /this\.dispatch\(commandNode\.dataset\.command/);
  assert.match(desktopUi, /openDialog\(name, \{ analysisTab = null \} = \{\}\)/);
  assert.match(desktopUi, /bindDragHandle/);
  assert.match(desktopUi, /activateAnalysisTab/);
  assert.match(desktopUi, /this\.listen\(window, 'keydown', this\.handleKeyDown, true\)/);
});

test('pixel microscope hides sampled paths before drawing a separate five-pixel-wide path', async () => {
  const [main, preview] = await Promise.all([
    source('../src/main.js'),
    source('../src/render/PreviewRenderer.js'),
  ]);

  const clearIndex = main.indexOf('preview.clearInspectorRays();');
  const hideIndex = main.indexOf("setSampledRaysVisible(false, 'microscope');");
  const inspectIndex = main.indexOf('renderClient.inspect(x, y)');
  const showIndex = main.indexOf('preview.setInspectorSegments(result.segments);');

  assert.ok(clearIndex >= 0);
  assert.ok(hideIndex > clearIndex, 'sampled rays must be hidden after clearing the prior inspector path');
  assert.ok(inspectIndex > hideIndex, 'sampled rays must be hidden before pixel reconstruction');
  assert.ok(showIndex > inspectIndex, 'the isolated inspector path must be shown only after reconstruction');

  assert.match(preview, /LineSegments2/);
  assert.match(preview, /LineSegmentsGeometry/);
  assert.match(preview, /LineMaterial/);
  assert.match(preview, /this\.inspectLine = createWideLineLayer\(5, 1\)/);
  assert.match(preview, /this\.renderLine\.visible = this\.renderRaysVisible/);
  assert.match(preview, /this\.inspectLine\.visible = this\.inspectSegments\.length > 0/);

  assert.match(main, /preview\.addRenderSegments\(message\.segments\);/);
  assert.doesNotMatch(main, /if \(elements\.showRays\.checked\) preview\.addRenderSegments/);
});
