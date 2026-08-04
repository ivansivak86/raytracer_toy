const TRIANGLE_EPSILON = 1e-9;

function longestAxis(minX, minY, minZ, maxX, maxY, maxZ) {
  const x = maxX - minX;
  const y = maxY - minY;
  const z = maxZ - minZ;
  if (x >= y && x >= z) return 0;
  if (y >= z) return 1;
  return 2;
}

export function buildBvh(positions, leafSize = 8) {
  const triangleCount = Math.floor(positions.length / 9);
  if (!triangleCount) throw new Error('Cannot build a BVH for an empty triangle set.');

  const triangleBounds = new Float32Array(triangleCount * 6);
  const centroids = new Float32Array(triangleCount * 3);
  const indices = Array.from({ length: triangleCount }, (_, index) => index);

  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const offset = triangle * 9;
    const ax = positions[offset];
    const ay = positions[offset + 1];
    const az = positions[offset + 2];
    const bx = positions[offset + 3];
    const by = positions[offset + 4];
    const bz = positions[offset + 5];
    const cx = positions[offset + 6];
    const cy = positions[offset + 7];
    const cz = positions[offset + 8];

    const boundsOffset = triangle * 6;
    const minX = Math.min(ax, bx, cx);
    const minY = Math.min(ay, by, cy);
    const minZ = Math.min(az, bz, cz);
    const maxX = Math.max(ax, bx, cx);
    const maxY = Math.max(ay, by, cy);
    const maxZ = Math.max(az, bz, cz);
    triangleBounds[boundsOffset] = minX;
    triangleBounds[boundsOffset + 1] = minY;
    triangleBounds[boundsOffset + 2] = minZ;
    triangleBounds[boundsOffset + 3] = maxX;
    triangleBounds[boundsOffset + 4] = maxY;
    triangleBounds[boundsOffset + 5] = maxZ;

    const centroidOffset = triangle * 3;
    centroids[centroidOffset] = (minX + maxX) * 0.5;
    centroids[centroidOffset + 1] = (minY + maxY) * 0.5;
    centroids[centroidOffset + 2] = (minZ + maxZ) * 0.5;
  }

  const nodes = [];

  function buildNode(start, end) {
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;
    let centroidMinX = Infinity;
    let centroidMinY = Infinity;
    let centroidMinZ = Infinity;
    let centroidMaxX = -Infinity;
    let centroidMaxY = -Infinity;
    let centroidMaxZ = -Infinity;

    for (let cursor = start; cursor < end; cursor += 1) {
      const triangle = indices[cursor];
      const boundsOffset = triangle * 6;
      minX = Math.min(minX, triangleBounds[boundsOffset]);
      minY = Math.min(minY, triangleBounds[boundsOffset + 1]);
      minZ = Math.min(minZ, triangleBounds[boundsOffset + 2]);
      maxX = Math.max(maxX, triangleBounds[boundsOffset + 3]);
      maxY = Math.max(maxY, triangleBounds[boundsOffset + 4]);
      maxZ = Math.max(maxZ, triangleBounds[boundsOffset + 5]);

      const centroidOffset = triangle * 3;
      const cx = centroids[centroidOffset];
      const cy = centroids[centroidOffset + 1];
      const cz = centroids[centroidOffset + 2];
      centroidMinX = Math.min(centroidMinX, cx);
      centroidMinY = Math.min(centroidMinY, cy);
      centroidMinZ = Math.min(centroidMinZ, cz);
      centroidMaxX = Math.max(centroidMaxX, cx);
      centroidMaxY = Math.max(centroidMaxY, cy);
      centroidMaxZ = Math.max(centroidMaxZ, cz);
    }

    const nodeIndex = nodes.length;
    const node = {
      minX,
      minY,
      minZ,
      maxX,
      maxY,
      maxZ,
      left: -1,
      right: -1,
      start,
      count: end - start,
    };
    nodes.push(node);

    const count = end - start;
    const axis = longestAxis(
      centroidMinX,
      centroidMinY,
      centroidMinZ,
      centroidMaxX,
      centroidMaxY,
      centroidMaxZ,
    );
    const extent = [
      centroidMaxX - centroidMinX,
      centroidMaxY - centroidMinY,
      centroidMaxZ - centroidMinZ,
    ][axis];

    if (count <= leafSize || extent < 1e-7) return nodeIndex;

    const sorted = indices
      .slice(start, end)
      .sort((a, b) => centroids[a * 3 + axis] - centroids[b * 3 + axis]);
    for (let cursor = 0; cursor < sorted.length; cursor += 1) {
      indices[start + cursor] = sorted[cursor];
    }

    const midpoint = start + Math.floor(count / 2);
    node.left = buildNode(start, midpoint);
    node.right = buildNode(midpoint, end);
    node.start = 0;
    node.count = 0;
    return nodeIndex;
  }

  buildNode(0, triangleCount);

  return {
    positions,
    triangleCount,
    nodes,
    indices: new Uint32Array(indices),
    stack: new Int32Array(Math.max(128, nodes.length)),
  };
}

function aabbEntry(node, ox, oy, oz, dx, dy, dz, minimumDistance, maximumDistance) {
  let near = minimumDistance;
  let far = maximumDistance;

  if (Math.abs(dx) < 1e-14) {
    if (ox < node.minX || ox > node.maxX) return Infinity;
  } else {
    let first = (node.minX - ox) / dx;
    let second = (node.maxX - ox) / dx;
    if (first > second) [first, second] = [second, first];
    near = Math.max(near, first);
    far = Math.min(far, second);
    if (near > far) return Infinity;
  }

  if (Math.abs(dy) < 1e-14) {
    if (oy < node.minY || oy > node.maxY) return Infinity;
  } else {
    let first = (node.minY - oy) / dy;
    let second = (node.maxY - oy) / dy;
    if (first > second) [first, second] = [second, first];
    near = Math.max(near, first);
    far = Math.min(far, second);
    if (near > far) return Infinity;
  }

  if (Math.abs(dz) < 1e-14) {
    if (oz < node.minZ || oz > node.maxZ) return Infinity;
  } else {
    let first = (node.minZ - oz) / dz;
    let second = (node.maxZ - oz) / dz;
    if (first > second) [first, second] = [second, first];
    near = Math.max(near, first);
    far = Math.min(far, second);
    if (near > far) return Infinity;
  }

  return near;
}

function intersectTriangle(positions, triangle, ox, oy, oz, dx, dy, dz, minimumDistance, maximumDistance) {
  const offset = triangle * 9;
  const ax = positions[offset];
  const ay = positions[offset + 1];
  const az = positions[offset + 2];
  const edge1x = positions[offset + 3] - ax;
  const edge1y = positions[offset + 4] - ay;
  const edge1z = positions[offset + 5] - az;
  const edge2x = positions[offset + 6] - ax;
  const edge2y = positions[offset + 7] - ay;
  const edge2z = positions[offset + 8] - az;

  const px = dy * edge2z - dz * edge2y;
  const py = dz * edge2x - dx * edge2z;
  const pz = dx * edge2y - dy * edge2x;
  const determinant = edge1x * px + edge1y * py + edge1z * pz;
  if (Math.abs(determinant) < TRIANGLE_EPSILON) return null;

  const inverseDeterminant = 1 / determinant;
  const tx = ox - ax;
  const ty = oy - ay;
  const tz = oz - az;
  const u = (tx * px + ty * py + tz * pz) * inverseDeterminant;
  if (u < 0 || u > 1) return null;

  const qx = ty * edge1z - tz * edge1y;
  const qy = tz * edge1x - tx * edge1z;
  const qz = tx * edge1y - ty * edge1x;
  const v = (dx * qx + dy * qy + dz * qz) * inverseDeterminant;
  if (v < 0 || u + v > 1) return null;

  const distance = (edge2x * qx + edge2y * qy + edge2z * qz) * inverseDeterminant;
  if (distance <= minimumDistance || distance >= maximumDistance) return null;

  return { distance, u, v };
}

export function intersectBvh(
  bvh,
  ox,
  oy,
  oz,
  dx,
  dy,
  dz,
  hit,
  {
    minimumDistance = 1e-5,
    maximumDistance = Infinity,
    anyHit = false,
    stats,
  } = {},
) {
  let closestDistance = maximumDistance;
  let found = false;
  let stackSize = 0;
  bvh.stack[stackSize++] = 0;

  while (stackSize > 0) {
    const nodeIndex = bvh.stack[--stackSize];
    const node = bvh.nodes[nodeIndex];
    stats && (stats.bvhNodeTests += 1);
    const entry = aabbEntry(
      node,
      ox,
      oy,
      oz,
      dx,
      dy,
      dz,
      minimumDistance,
      closestDistance,
    );
    if (entry === Infinity) continue;

    if (node.count > 0) {
      const end = node.start + node.count;
      for (let cursor = node.start; cursor < end; cursor += 1) {
        const triangle = bvh.indices[cursor];
        stats && (stats.triangleTests += 1);
        const intersection = intersectTriangle(
          bvh.positions,
          triangle,
          ox,
          oy,
          oz,
          dx,
          dy,
          dz,
          minimumDistance,
          closestDistance,
        );
        if (!intersection) continue;

        found = true;
        closestDistance = intersection.distance;
        hit.triangle = triangle;
        hit.distance = intersection.distance;
        hit.u = intersection.u;
        hit.v = intersection.v;
        if (anyHit) return true;
      }
      continue;
    }

    const left = bvh.nodes[node.left];
    const right = bvh.nodes[node.right];
    const leftEntry = aabbEntry(
      left,
      ox,
      oy,
      oz,
      dx,
      dy,
      dz,
      minimumDistance,
      closestDistance,
    );
    const rightEntry = aabbEntry(
      right,
      ox,
      oy,
      oz,
      dx,
      dy,
      dz,
      minimumDistance,
      closestDistance,
    );

    if (leftEntry === Infinity && rightEntry === Infinity) continue;
    if (leftEntry < rightEntry) {
      if (rightEntry !== Infinity) bvh.stack[stackSize++] = node.right;
      if (leftEntry !== Infinity) bvh.stack[stackSize++] = node.left;
    } else {
      if (leftEntry !== Infinity) bvh.stack[stackSize++] = node.left;
      if (rightEntry !== Infinity) bvh.stack[stackSize++] = node.right;
    }
  }

  return found;
}
