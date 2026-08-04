import test from 'node:test';
import assert from 'node:assert/strict';
import { createTracer, sampleTextureColor } from '../src/raytracer/tracer.js';

function material(overrides = {}) {
  return {
    color: [0.8, 0.15, 0.08],
    legacyReflectivity: 0,
    reflectivity: 0,
    transmission: 0,
    ior: 1.5,
    roughness: 0.5,
    shininess: 32,
    specularStrength: 0.3,
    glass: false,
    ...overrides,
  };
}

function sceneWithTriangles({
  triangles,
  normals,
  materials = [material()],
  triangleMaterials,
  triangleObjects,
  objects,
  lightPosition = [0, 0, 1],
  background = [0, 0, 0],
  uvs,
  triangleHasUvs,
  textures = [],
} = {}) {
  const positions = new Float32Array(triangles.flat());
  const fallbackNormals = Array.from({ length: positions.length / 3 }, () => [0, 0, 1]).flat();
  const normalValues = normals ? normals.flat() : fallbackNormals;
  const triangleCount = positions.length / 9;
  return {
    positions,
    normals: new Float32Array(normalValues),
    uvs: new Float32Array(uvs ?? Array(triangleCount * 6).fill(0)),
    triangleHasUvs: new Uint8Array(triangleHasUvs ?? Array(triangleCount).fill(0)),
    triangleMaterials: new Uint32Array(triangleMaterials ?? Array(triangleCount).fill(0)),
    triangleObjects: new Uint32Array(triangleObjects ?? Array(triangleCount).fill(0)),
    materials,
    textures,
    objects: objects ?? [{ name: 'Test surface', kind: 'mesh' }],
    lights: [{ name: 'Test light', position: lightPosition, color: [1, 1, 1], intensity: 1 }],
    background,
    bounds: {
      min: [-2, -2, Math.min(...triangles.flat().filter((_, index) => index % 3 === 2))],
      max: [2, 2, Math.max(...triangles.flat().filter((_, index) => index % 3 === 2))],
    },
    camera: {
      origin: [0, 0, 1],
      forward: [0, 0, -1],
      right: [1, 0, 0],
      up: [0, 1, 0],
      verticalFov: Math.PI / 2,
    },
  };
}

const frontTriangle = [-2, -2, 0, 2, -2, 0, 0, 2, 0];

test('modern tracer shades a directly visible surface and records its path', () => {
  const scene = sceneWithTriangles({ triangles: [frontTriangle] });
  const tracer = createTracer(scene, {
    width: 1,
    height: 1,
    supersampling: 1,
    maxDepth: 3,
    mode: 'modern',
  });

  const rgba = tracer.tracePixel(0, 0);
  const inspection = tracer.inspectPixel(0, 0);

  assert.equal(rgba[3], 255);
  assert.ok(rgba[0] > rgba[1]);
  assert.ok(rgba[0] > rgba[2]);
  assert.equal(inspection.tree.hit.object, 'Test surface');
  assert.equal(inspection.tree.lights[0].blocked, false);
  assert.ok(inspection.segments.some((segment) => segment.type === 'primary' && segment.hit));
  assert.ok(inspection.segments.some((segment) => segment.type === 'normal'));
});

test('legacy mode preserves the original unbounded shadow-ray quirk', () => {
  const occluderBehindLight = [-2, -2, 2, 0, 2, 2, 2, -2, 2];
  const scene = sceneWithTriangles({
    triangles: [frontTriangle, occluderBehindLight],
    lightPosition: [0, 0, 0.5],
    triangleMaterials: [0, 1],
    triangleObjects: [0, 1],
    materials: [material(), material({ color: [0.2, 0.2, 0.2] })],
    objects: [
      { name: 'Visible surface', kind: 'mesh' },
      { name: 'Beyond-light occluder', kind: 'mesh' },
    ],
  });

  const legacy = createTracer(scene, {
    width: 2,
    height: 2,
    supersampling: 1,
    maxDepth: 1,
    mode: 'legacy',
  }).inspectPixel(1, 1);
  const modern = createTracer(scene, {
    width: 1,
    height: 1,
    supersampling: 1,
    maxDepth: 1,
    mode: 'modern',
  }).inspectPixel(0, 0);

  assert.equal(legacy.tree.lights[0].blocked, true);
  assert.equal(modern.tree.lights[0].blocked, false);
  assert.deepEqual(legacy.rgba.slice(0, 3), [0, 0, 0]);
  assert.ok(modern.rgba[0] > 0);
});

test('recursive reflection returns the background and is counted', () => {
  const scene = sceneWithTriangles({
    triangles: [frontTriangle],
    materials: [material({ color: [1, 1, 1], reflectivity: 1 })],
    background: [0.2, 0.3, 0.4],
  });
  const tracer = createTracer(scene, {
    width: 1,
    height: 1,
    supersampling: 1,
    maxDepth: 3,
    mode: 'modern',
  });

  const inspection = tracer.inspectPixel(0, 0);
  assert.equal(tracer.stats.reflectionRays, 1);
  assert.equal(inspection.tree.children[0].rayType, 'reflection');
  assert.equal(inspection.tree.children[0].hit, null);
  assert.ok(inspection.rgba[0] > 0 && inspection.rgba[1] > inspection.rgba[0]);
});

test('modern glass emits both Fresnel reflection and refraction rays', () => {
  const scene = sceneWithTriangles({
    triangles: [frontTriangle],
    materials: [material({
      color: [0.55, 0.78, 1],
      reflectivity: 0.04,
      transmission: 0.88,
      ior: 1.3,
      glass: true,
    })],
    background: [0.1, 0.12, 0.16],
  });
  const tracer = createTracer(scene, {
    width: 1,
    height: 1,
    supersampling: 1,
    maxDepth: 3,
    mode: 'modern',
  });

  const inspection = tracer.inspectPixel(0, 0);
  const rayTypes = inspection.tree.children.map((child) => child.rayType);
  assert.ok(rayTypes.includes('reflection'));
  assert.ok(rayTypes.includes('refraction'));
  assert.ok(tracer.stats.reflectionRays >= 1);
  assert.ok(tracer.stats.refractionRays >= 1);
  assert.ok(inspection.segments.some((segment) => segment.type === 'refraction'));
});


test('texture sampling follows Three.js-style UV orientation and bilinear interpolation', () => {
  const texture = {
    width: 2,
    height: 2,
    pixels: new Uint8ClampedArray([
      255, 0, 0, 255, 0, 255, 0, 255,
      0, 0, 255, 255, 255, 255, 255, 255,
    ]),
    matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    wrapS: 1001,
    wrapT: 1001,
    flipY: true,
    srgb: false,
  };

  assert.deepEqual(sampleTextureColor(texture, 0, 1), [1, 0, 0, 1]);
  assert.deepEqual(sampleTextureColor(texture, 1, 0), [1, 1, 1, 1]);
  assert.deepEqual(sampleTextureColor(texture, 0.5, 0.5), [0.5, 0.5, 0.5, 1]);
});

test('CPU tracer modulates a material with its serialized UV texture', () => {
  const scene = sceneWithTriangles({
    triangles: [frontTriangle],
    uvs: [0, 0, 1, 0, 0.5, 1],
    triangleHasUvs: [1],
    textures: [{
      name: 'Blue test texture',
      width: 1,
      height: 1,
      pixels: new Uint8ClampedArray([20, 40, 255, 255]),
      matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      wrapS: 1001,
      wrapT: 1001,
      flipY: true,
      srgb: false,
    }],
    materials: [material({
      color: [1, 1, 1],
      specularStrength: 0,
      textureIndex: 0,
    })],
  });
  const tracer = createTracer(scene, {
    width: 1,
    height: 1,
    supersampling: 1,
    maxDepth: 1,
    mode: 'modern',
  });

  const inspection = tracer.inspectPixel(0, 0);
  assert.equal(inspection.tree.hit.texture, 'Blue test texture');
  assert.ok(inspection.rgba[2] > inspection.rgba[1]);
  assert.ok(inspection.rgba[1] > inspection.rgba[0]);
});
