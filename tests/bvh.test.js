import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBvh, intersectBvh } from '../src/raytracer/bvh.js';

const positions = new Float32Array([
  -1, -1, 0,  1, -1, 0,  0, 1, 0,
  -1, -1, -2, 1, -1, -2, 0, 1, -2,
]);

test('BVH returns the nearest triangle and barycentric coordinates', () => {
  const bvh = buildBvh(positions, 1);
  const hit = {};
  const found = intersectBvh(bvh, 0, 0, 1, 0, 0, -1, hit);

  assert.equal(found, true);
  assert.equal(hit.triangle, 0);
  assert.ok(Math.abs(hit.distance - 1) < 1e-8);
  assert.ok(hit.u >= 0 && hit.v >= 0 && hit.u + hit.v <= 1);
});

test('BVH respects finite shadow-ray distance and any-hit mode', () => {
  const bvh = buildBvh(positions, 1);
  const hit = {};

  assert.equal(
    intersectBvh(bvh, 0, 0, 1, 0, 0, -1, hit, { maximumDistance: 0.9, anyHit: true }),
    false,
  );
  assert.equal(
    intersectBvh(bvh, 0, 0, 1, 0, 0, -1, hit, { maximumDistance: 1.1, anyHit: true }),
    true,
  );
});

test('BVH misses rays outside all node bounds', () => {
  const bvh = buildBvh(positions, 1);
  const hit = {};
  assert.equal(intersectBvh(bvh, 4, 4, 1, 0, 0, -1, hit), false);
});
