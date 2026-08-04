import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function source(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

test('vintage editor wiring includes 98.css, transform gizmos, materials, and CPU textures', async () => {
  const [main, preview, editor, serializer, layout, packageJson] = await Promise.all([
    source('../src/main.js'),
    source('../src/render/PreviewRenderer.js'),
    source('../src/editor/SceneEditor.js'),
    source('../src/scene/serializeScene.js'),
    source('../src/ui/layout.js'),
    source('../package.json'),
  ]);

  assert.match(main, /import '98\.css\/dist\/98\.css';/);
  assert.match(preview, /TransformControls/);
  assert.match(preview, /getHelper\(\)/);
  assert.match(preview, /intersectObject\(this\.currentRoot, true\)/);
  assert.match(editor, /setTransformMode\('translate'\)/);
  assert.match(editor, /mesh\.userData\.rayMaterial/);
  assert.match(editor, /TextureLoader\(\)\.loadAsync/);
  assert.match(serializer, /triangleHasUvs/);
  assert.match(serializer, /serializeTexture/);
  assert.match(layout, /id="modern-info-button"/);
  assert.match(layout, /id="material-reflectivity"/);

  const dependencies = JSON.parse(packageJson).dependencies;
  assert.equal(dependencies['98.css'], '0.1.21');
  assert.equal(dependencies.three, '0.185.1');
});
