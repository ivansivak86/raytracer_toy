import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LEGACY_OBJECT_COUNT,
  createLegacySceneDefinition,
} from '../src/scene/legacyScene.js';

test('decoded Delphi scene contains the complete 47-object composition', () => {
  const scene = createLegacySceneDefinition(2003);
  const counts = scene.objects.reduce((result, object) => {
    result[object.kind] = (result[object.kind] ?? 0) + 1;
    return result;
  }, {});

  assert.equal(LEGACY_OBJECT_COUNT, 47);
  assert.equal(scene.objects.length, 47);
  assert.equal(counts.box, 23);
  assert.equal(counts.sphere, 20);
  assert.equal(counts.cylinder, 2);
  assert.equal(counts.torus, 1);
  assert.equal(counts.plane, 1);
  assert.deepEqual(scene.camera.position, [1.5, 1.5, 1.5]);
  assert.deepEqual(scene.camera.target, [0, 0, 0]);
  assert.deepEqual(scene.lights[0].position, [7, 54, 33]);
  assert.deepEqual(scene.notes.outputResolution, [512, 384]);
  assert.equal(scene.notes.supersampling, 2);
  assert.equal(scene.notes.traceDepth, 5);
});

test('legacy colors are deterministic for a seed and preserve class reflection rules', () => {
  const first = createLegacySceneDefinition(2003);
  const second = createLegacySceneDefinition(2003);
  const different = createLegacySceneDefinition(2004);

  assert.deepEqual(
    first.objects.map((object) => object.material.color),
    second.objects.map((object) => object.material.color),
  );
  assert.notDeepEqual(
    first.objects.map((object) => object.material.color),
    different.objects.map((object) => object.material.color),
  );

  for (const object of first.objects) {
    if (object.kind === 'box') {
      assert.equal(object.material.legacyReflectivity, 0);
      assert.equal(object.legacyClass, 'cube');
    } else {
      assert.equal(object.material.legacyReflectivity, 0.95);
    }
  }
});
