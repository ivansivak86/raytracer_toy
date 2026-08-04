import { buildBvh, intersectBvh } from './bvh.js';

const EPSILON = 1e-4;

function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function normalize3(x, y, z) {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

function reflect(dx, dy, dz, nx, ny, nz) {
  const dot = dx * nx + dy * ny + dz * nz;
  return normalize3(
    dx - 2 * dot * nx,
    dy - 2 * dot * ny,
    dz - 2 * dot * nz,
  );
}

function refract(dx, dy, dz, nx, ny, nz, frontFace, ior) {
  const ratio = frontFace ? 1 / ior : ior;
  const cosTheta = Math.min(-(dx * nx + dy * ny + dz * nz), 1);
  const perpendicularX = ratio * (dx + cosTheta * nx);
  const perpendicularY = ratio * (dy + cosTheta * ny);
  const perpendicularZ = ratio * (dz + cosTheta * nz);
  const parallelSquared = 1 - (
    perpendicularX * perpendicularX
    + perpendicularY * perpendicularY
    + perpendicularZ * perpendicularZ
  );
  if (parallelSquared < 0) return null;
  const parallelScale = -Math.sqrt(parallelSquared);
  return normalize3(
    perpendicularX + parallelScale * nx,
    perpendicularY + parallelScale * ny,
    perpendicularZ + parallelScale * nz,
  );
}

function fresnelSchlick(cosine, ior) {
  const r0Base = (1 - ior) / (1 + ior);
  const r0 = r0Base * r0Base;
  return r0 + (1 - r0) * ((1 - cosine) ** 5);
}

function linearToSrgb(value) {
  const clamped = Math.max(0, value);
  if (clamped <= 0.0031308) return 12.92 * clamped;
  return 1.055 * (clamped ** (1 / 2.4)) - 0.055;
}

function srgbToLinear(value) {
  const clamped = clamp(value);
  if (clamped <= 0.04045) return clamped / 12.92;
  return ((clamped + 0.055) / 1.055) ** 2.4;
}

const REPEAT_WRAPPING = 1000;
const CLAMP_TO_EDGE_WRAPPING = 1001;
const MIRRORED_REPEAT_WRAPPING = 1002;

function wrapCoordinate(value, wrapping) {
  if (wrapping === REPEAT_WRAPPING) return value - Math.floor(value);
  if (wrapping === MIRRORED_REPEAT_WRAPPING) {
    const floor = Math.floor(value);
    const fraction = value - floor;
    return Math.abs(floor % 2) === 1 ? 1 - fraction : fraction;
  }
  if (wrapping === CLAMP_TO_EDGE_WRAPPING || wrapping === undefined) return clamp(value);
  return clamp(value);
}

function texturePixel(texture, x, y) {
  const safeX = Math.min(texture.width - 1, Math.max(0, x));
  const safeY = Math.min(texture.height - 1, Math.max(0, y));
  const offset = (safeY * texture.width + safeX) * 4;
  return [
    texture.pixels[offset] / 255,
    texture.pixels[offset + 1] / 255,
    texture.pixels[offset + 2] / 255,
    texture.pixels[offset + 3] / 255,
  ];
}

export function sampleTextureColor(texture, u, v, linearize = false) {
  if (!texture?.pixels?.length || !texture.width || !texture.height) return [1, 1, 1, 1];
  const matrix = texture.matrix ?? [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const transformedU = matrix[0] * u + matrix[3] * v + matrix[6];
  const transformedV = matrix[1] * u + matrix[4] * v + matrix[7];
  const wrappedU = wrapCoordinate(transformedU, texture.wrapS);
  const wrappedV = wrapCoordinate(transformedV, texture.wrapT);
  const imageV = texture.flipY === false ? wrappedV : 1 - wrappedV;

  const x = wrappedU * Math.max(0, texture.width - 1);
  const y = imageV * Math.max(0, texture.height - 1);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(texture.width - 1, x0 + 1);
  const y1 = Math.min(texture.height - 1, y0 + 1);
  const fx = x - x0;
  const fy = y - y0;
  const p00 = texturePixel(texture, x0, y0);
  const p10 = texturePixel(texture, x1, y0);
  const p01 = texturePixel(texture, x0, y1);
  const p11 = texturePixel(texture, x1, y1);
  const output = [0, 0, 0, 0];
  for (let channel = 0; channel < 4; channel += 1) {
    const top = p00[channel] * (1 - fx) + p10[channel] * fx;
    const bottom = p01[channel] * (1 - fx) + p11[channel] * fx;
    output[channel] = top * (1 - fy) + bottom * fy;
  }
  if (linearize && texture.srgb) {
    output[0] = srgbToLinear(output[0]);
    output[1] = srgbToLinear(output[1]);
    output[2] = srgbToLinear(output[2]);
  }
  return output;
}

function makeStats(objectCount, maxDepth) {
  return {
    primaryRays: 0,
    shadowRays: 0,
    reflectionRays: 0,
    refractionRays: 0,
    totalRays: 0,
    hits: 0,
    misses: 0,
    shadowed: 0,
    bvhNodeTests: 0,
    triangleTests: 0,
    raysByDepth: new Uint32Array(maxDepth + 2),
    objectHits: new Uint32Array(objectCount),
  };
}

function cameraRay(camera, config, x, y) {
  const { width, height, supersampling, mode } = config;
  const [fx, fy, fz] = camera.forward;
  const [rx, ry, rz] = camera.right;
  const [ux, uy, uz] = camera.up;

  let horizontal;
  let vertical;
  if (mode === 'legacy') {
    const internalWidth = width * supersampling;
    const internalHeight = height * supersampling;
    const factor = 3 / (internalWidth + internalHeight);
    horizontal = (x - Math.floor(internalWidth * 0.5)) * factor;
    vertical = (Math.floor(internalHeight * 0.5) - y) * factor;
  } else {
    const normalizedX = (x / width) * 2 - 1;
    const normalizedY = 1 - (y / height) * 2;
    const tanHalfFov = Math.tan(camera.verticalFov * 0.5);
    horizontal = normalizedX * (width / height) * tanHalfFov;
    vertical = normalizedY * tanHalfFov;
  }

  return normalize3(
    fx + rx * horizontal + ux * vertical,
    fy + ry * horizontal + uy * vertical,
    fz + rz * horizontal + uz * vertical,
  );
}

function captureSegment(capture, from, to, type, depth, hit, blocked = false) {
  if (!capture) return;
  capture.segments.push({ from, to, type, depth, hit, blocked });
}

export function createTracer(scene, configuration) {
  const config = {
    width: configuration.width,
    height: configuration.height,
    supersampling: configuration.supersampling ?? 1,
    maxDepth: configuration.maxDepth ?? 5,
    mode: configuration.mode ?? 'legacy',
  };
  const buildStarted = performance.now();
  const bvh = buildBvh(scene.positions, configuration.leafSize ?? 8);
  const bvhBuildMilliseconds = performance.now() - buildStarted;
  const stats = makeStats(scene.objects.length, config.maxDepth);
  const colorStack = new Float64Array((config.maxDepth + 3) * 3);
  const hitPool = Array.from({ length: config.maxDepth + 3 }, () => ({}));
  const shadowHitPool = Array.from({ length: config.maxDepth + 3 }, () => ({}));

  const boundsCenter = [
    (scene.bounds.min[0] + scene.bounds.max[0]) * 0.5,
    (scene.bounds.min[1] + scene.bounds.max[1]) * 0.5,
    (scene.bounds.min[2] + scene.bounds.max[2]) * 0.5,
  ];
  const boundsDiagonal = Math.hypot(
    scene.bounds.max[0] - scene.bounds.min[0],
    scene.bounds.max[1] - scene.bounds.min[1],
    scene.bounds.max[2] - scene.bounds.min[2],
  );
  const missDistance = Math.max(6, Math.min(80, boundsDiagonal * 1.35));

  function addTreeNode(capture, parent, rayType, depth, origin, direction) {
    if (!capture?.tree) return null;
    const node = {
      rayType,
      depth,
      origin: [...origin],
      direction: [...direction],
      hit: null,
      lights: [],
      localColor: [0, 0, 0],
      finalColor: [0, 0, 0],
      children: [],
    };
    if (parent) parent.children.push(node);
    else capture.root = node;
    return node;
  }

  function traceRay(ox, oy, oz, dx, dy, dz, depth, rayType, capture, parentNode) {
    const colorOffset = depth * 3;
    colorStack[colorOffset] = 0;
    colorStack[colorOffset + 1] = 0;
    colorStack[colorOffset + 2] = 0;

    stats.totalRays += 1;
    stats.raysByDepth[Math.min(depth, stats.raysByDepth.length - 1)] += 1;
    if (rayType === 'primary') stats.primaryRays += 1;
    else if (rayType === 'reflection') stats.reflectionRays += 1;
    else if (rayType === 'refraction') stats.refractionRays += 1;

    const treeNode = addTreeNode(
      capture,
      parentNode,
      rayType,
      depth,
      [ox, oy, oz],
      [dx, dy, dz],
    );
    const hit = hitPool[depth];
    const found = intersectBvh(bvh, ox, oy, oz, dx, dy, dz, hit, { stats });

    if (!found) {
      stats.misses += 1;
      const end = [ox + dx * missDistance, oy + dy * missDistance, oz + dz * missDistance];
      captureSegment(capture, [ox, oy, oz], end, rayType, depth, false);
      colorStack[colorOffset] = scene.background[0];
      colorStack[colorOffset + 1] = scene.background[1];
      colorStack[colorOffset + 2] = scene.background[2];
      if (treeNode) treeNode.finalColor = [...scene.background];
      return;
    }

    stats.hits += 1;
    const triangle = hit.triangle;
    const materialIndex = scene.triangleMaterials[triangle];
    const objectIndex = scene.triangleObjects[triangle];
    const material = scene.materials[materialIndex];
    const object = scene.objects[objectIndex];
    stats.objectHits[objectIndex] += 1;

    const px = ox + dx * hit.distance;
    const py = oy + dy * hit.distance;
    const pz = oz + dz * hit.distance;
    const normalOffset = triangle * 9;
    const w = 1 - hit.u - hit.v;
    let nx = (
      scene.normals[normalOffset] * w
      + scene.normals[normalOffset + 3] * hit.u
      + scene.normals[normalOffset + 6] * hit.v
    );
    let ny = (
      scene.normals[normalOffset + 1] * w
      + scene.normals[normalOffset + 4] * hit.u
      + scene.normals[normalOffset + 7] * hit.v
    );
    let nz = (
      scene.normals[normalOffset + 2] * w
      + scene.normals[normalOffset + 5] * hit.u
      + scene.normals[normalOffset + 8] * hit.v
    );
    [nx, ny, nz] = normalize3(nx, ny, nz);
    const frontFace = dx * nx + dy * ny + dz * nz < 0;
    if (!frontFace) {
      nx = -nx;
      ny = -ny;
      nz = -nz;
    }

    captureSegment(capture, [ox, oy, oz], [px, py, pz], rayType, depth, true);
    if (capture?.includeNormals) {
      const scale = Math.max(0.12, Math.min(0.35, boundsDiagonal * 0.025));
      captureSegment(
        capture,
        [px, py, pz],
        [px + nx * scale, py + ny * scale, pz + nz * scale],
        'normal',
        depth,
        false,
      );
    }

    let textureUv = null;
    let textureColor = [1, 1, 1, 1];
    const texture = material.textureIndex >= 0 ? scene.textures?.[material.textureIndex] : null;
    if (texture && scene.uvs && scene.triangleHasUvs?.[triangle]) {
      const uvOffset = triangle * 6;
      const textureU = (
        scene.uvs[uvOffset] * w
        + scene.uvs[uvOffset + 2] * hit.u
        + scene.uvs[uvOffset + 4] * hit.v
      );
      const textureV = (
        scene.uvs[uvOffset + 1] * w
        + scene.uvs[uvOffset + 3] * hit.u
        + scene.uvs[uvOffset + 5] * hit.v
      );
      textureUv = [textureU, textureV];
      textureColor = sampleTextureColor(texture, textureU, textureV, config.mode === 'modern');
    }
    const surfaceR = material.color[0] * textureColor[0];
    const surfaceG = material.color[1] * textureColor[1];
    const surfaceB = material.color[2] * textureColor[2];

    if (treeNode) {
      treeNode.hit = {
        object: object.name,
        kind: object.kind,
        distance: hit.distance,
        point: [px, py, pz],
        normal: [nx, ny, nz],
        materialColor: [surfaceR, surfaceG, surfaceB],
        texture: texture?.name ?? null,
        textureUv,
      };
    }

    let localR = config.mode === 'modern' ? surfaceR * 0.025 : 0;
    let localG = config.mode === 'modern' ? surfaceG * 0.025 : 0;
    let localB = config.mode === 'modern' ? surfaceB * 0.025 : 0;

    for (const light of scene.lights) {
      const lxRaw = light.position[0] - px;
      const lyRaw = light.position[1] - py;
      const lzRaw = light.position[2] - pz;
      const lightDistance = Math.hypot(lxRaw, lyRaw, lzRaw) || 1;
      const lx = lxRaw / lightDistance;
      const ly = lyRaw / lightDistance;
      const lz = lzRaw / lightDistance;
      const normalDotLight = Math.max(0, nx * lx + ny * ly + nz * lz);

      const shadowOriginX = config.mode === 'legacy' ? px + lx * EPSILON : px + nx * EPSILON;
      const shadowOriginY = config.mode === 'legacy' ? py + ly * EPSILON : py + ny * EPSILON;
      const shadowOriginZ = config.mode === 'legacy' ? pz + lz * EPSILON : pz + nz * EPSILON;
      const shadowHit = shadowHitPool[depth];
      stats.shadowRays += 1;
      stats.totalRays += 1;
      const blocked = intersectBvh(
        bvh,
        shadowOriginX,
        shadowOriginY,
        shadowOriginZ,
        lx,
        ly,
        lz,
        shadowHit,
        {
          maximumDistance: config.mode === 'legacy' ? Infinity : Math.max(EPSILON, lightDistance - EPSILON * 4),
          anyHit: true,
          stats,
        },
      );
      if (blocked) stats.shadowed += 1;

      const shadowEnd = blocked
        ? [
          shadowOriginX + lx * shadowHit.distance,
          shadowOriginY + ly * shadowHit.distance,
          shadowOriginZ + lz * shadowHit.distance,
        ]
        : light.position;
      captureSegment(
        capture,
        [px, py, pz],
        shadowEnd,
        'shadow',
        depth,
        blocked,
        blocked,
      );

      const lightRecord = treeNode ? {
        name: light.name,
        direction: [lx, ly, lz],
        distance: lightDistance,
        normalDotLight,
        blocked,
        diffuse: [0, 0, 0],
        specular: [0, 0, 0],
      } : null;

      if (normalDotLight > 0) {
        if (config.mode === 'legacy') {
          if (!blocked) {
            const intensity = light.intensity ?? 1;
            const diffuseR = surfaceR * normalDotLight * light.color[0] * intensity;
            const diffuseG = surfaceG * normalDotLight * light.color[1] * intensity;
            const diffuseB = surfaceB * normalDotLight * light.color[2] * intensity;
            localR += diffuseR;
            localG += diffuseG;
            localB += diffuseB;

            const reflectedLightX = lx - 2 * normalDotLight * nx;
            const reflectedLightY = ly - 2 * normalDotLight * ny;
            const reflectedLightZ = lz - 2 * normalDotLight * nz;
            const specularDot = dx * reflectedLightX + dy * reflectedLightY + dz * reflectedLightZ;
            const specular = specularDot > 0 ? specularDot ** 30 : 0;
            localR += specular;
            localG += specular;
            localB += specular;
            if (lightRecord) {
              lightRecord.diffuse = [diffuseR, diffuseG, diffuseB];
              lightRecord.specular = [specular, specular, specular];
            }
          }
        } else {
          const visibility = blocked ? 0.04 : 1;
          const intensity = (light.intensity ?? 1) * visibility;
          const diffuseR = surfaceR * normalDotLight * light.color[0] * intensity;
          const diffuseG = surfaceG * normalDotLight * light.color[1] * intensity;
          const diffuseB = surfaceB * normalDotLight * light.color[2] * intensity;
          localR += diffuseR;
          localG += diffuseG;
          localB += diffuseB;

          const reflectedLightX = 2 * normalDotLight * nx - lx;
          const reflectedLightY = 2 * normalDotLight * ny - ly;
          const reflectedLightZ = 2 * normalDotLight * nz - lz;
          const specularDot = Math.max(
            0,
            (-dx) * reflectedLightX + (-dy) * reflectedLightY + (-dz) * reflectedLightZ,
          );
          const specular = (specularDot ** Math.max(4, material.shininess))
            * material.specularStrength
            * intensity;
          localR += specular * light.color[0];
          localG += specular * light.color[1];
          localB += specular * light.color[2];
          if (lightRecord) {
            lightRecord.diffuse = [diffuseR, diffuseG, diffuseB];
            lightRecord.specular = [
              specular * light.color[0],
              specular * light.color[1],
              specular * light.color[2],
            ];
          }
        }
      }

      if (lightRecord) treeNode.lights.push(lightRecord);
    }

    if (treeNode) treeNode.localColor = [localR, localG, localB];

    if (config.mode === 'legacy') {
      let finalR = localR;
      let finalG = localG;
      let finalB = localB;
      if (material.legacyReflectivity > 0 && depth < config.maxDepth) {
        const [rdx, rdy, rdz] = reflect(dx, dy, dz, nx, ny, nz);
        traceRay(
          px + rdx * EPSILON,
          py + rdy * EPSILON,
          pz + rdz * EPSILON,
          rdx,
          rdy,
          rdz,
          depth + 1,
          'reflection',
          capture,
          treeNode,
        );
        const childOffset = (depth + 1) * 3;
        finalR += material.legacyReflectivity * colorStack[childOffset] * surfaceR;
        finalG += material.legacyReflectivity * colorStack[childOffset + 1] * surfaceG;
        finalB += material.legacyReflectivity * colorStack[childOffset + 2] * surfaceB;
      }
      colorStack[colorOffset] = clamp(finalR);
      colorStack[colorOffset + 1] = clamp(finalG);
      colorStack[colorOffset + 2] = clamp(finalB);
    } else {
      const cosine = Math.max(0, -(dx * nx + dy * ny + dz * nz));
      const fresnel = material.transmission > 0 ? fresnelSchlick(cosine, material.ior) : 0;
      const refracted = material.transmission > 0
        ? refract(dx, dy, dz, nx, ny, nz, frontFace, material.ior)
        : null;
      let reflectionWeight = clamp(material.reflectivity + material.transmission * fresnel);
      let transmissionWeight = clamp(material.transmission * (1 - fresnel));
      if (material.transmission > 0 && !refracted) {
        reflectionWeight = clamp(reflectionWeight + transmissionWeight);
        transmissionWeight = 0;
      }
      const localWeight = clamp(1 - reflectionWeight - transmissionWeight);
      let finalR = localR * localWeight;
      let finalG = localG * localWeight;
      let finalB = localB * localWeight;

      if (reflectionWeight > 0 && depth < config.maxDepth) {
        const [rdx, rdy, rdz] = reflect(dx, dy, dz, nx, ny, nz);
        traceRay(
          px + rdx * EPSILON,
          py + rdy * EPSILON,
          pz + rdz * EPSILON,
          rdx,
          rdy,
          rdz,
          depth + 1,
          'reflection',
          capture,
          treeNode,
        );
        const childOffset = (depth + 1) * 3;
        finalR += reflectionWeight * colorStack[childOffset];
        finalG += reflectionWeight * colorStack[childOffset + 1];
        finalB += reflectionWeight * colorStack[childOffset + 2];
      } else if (reflectionWeight > 0) {
        finalR += reflectionWeight * localR;
        finalG += reflectionWeight * localG;
        finalB += reflectionWeight * localB;
      }

      if (transmissionWeight > 0 && depth < config.maxDepth && refracted) {
        const [tdx, tdy, tdz] = refracted;
        traceRay(
          px + tdx * EPSILON,
          py + tdy * EPSILON,
          pz + tdz * EPSILON,
          tdx,
          tdy,
          tdz,
          depth + 1,
          'refraction',
          capture,
          treeNode,
        );
        const childOffset = (depth + 1) * 3;
        const tintR = 0.78 + surfaceR * 0.22;
        const tintG = 0.78 + surfaceG * 0.22;
        const tintB = 0.78 + surfaceB * 0.22;
        finalR += transmissionWeight * colorStack[childOffset] * tintR;
        finalG += transmissionWeight * colorStack[childOffset + 1] * tintG;
        finalB += transmissionWeight * colorStack[childOffset + 2] * tintB;
      }

      colorStack[colorOffset] = Math.max(0, finalR);
      colorStack[colorOffset + 1] = Math.max(0, finalG);
      colorStack[colorOffset + 2] = Math.max(0, finalB);
    }

    if (treeNode) {
      treeNode.finalColor = [
        colorStack[colorOffset],
        colorStack[colorOffset + 1],
        colorStack[colorOffset + 2],
      ];
    }
  }

  function tracePixel(x, y, capture = null) {
    let r = 0;
    let g = 0;
    let b = 0;
    const sampleCount = config.supersampling ** 2;

    for (let sampleY = 0; sampleY < config.supersampling; sampleY += 1) {
      for (let sampleX = 0; sampleX < config.supersampling; sampleX += 1) {
        let rayX;
        let rayY;
        if (config.mode === 'legacy') {
          rayX = x * config.supersampling + sampleX;
          rayY = y * config.supersampling + sampleY;
        } else {
          rayX = x + (sampleX + 0.5) / config.supersampling;
          rayY = y + (sampleY + 0.5) / config.supersampling;
        }
        const [dx, dy, dz] = cameraRay(scene.camera, config, rayX, rayY);
        const sampleCapture = capture && sampleX === 0 && sampleY === 0 ? capture : null;
        traceRay(
          scene.camera.origin[0],
          scene.camera.origin[1],
          scene.camera.origin[2],
          dx,
          dy,
          dz,
          1,
          'primary',
          sampleCapture,
          null,
        );
        const colorOffset = 3;
        r += colorStack[colorOffset];
        g += colorStack[colorOffset + 1];
        b += colorStack[colorOffset + 2];
      }
    }

    r /= sampleCount;
    g /= sampleCount;
    b /= sampleCount;
    if (config.mode === 'modern') {
      r = linearToSrgb(r);
      g = linearToSrgb(g);
      b = linearToSrgb(b);
    }

    return [
      Math.round(clamp(r) * 255),
      Math.round(clamp(g) * 255),
      Math.round(clamp(b) * 255),
      255,
    ];
  }

  function inspectPixel(x, y) {
    const capture = { segments: [], tree: true, includeNormals: true, root: null };
    let rayX;
    let rayY;
    if (config.mode === 'legacy') {
      rayX = x * config.supersampling + (config.supersampling - 1) * 0.5;
      rayY = y * config.supersampling + (config.supersampling - 1) * 0.5;
    } else {
      rayX = x + 0.5;
      rayY = y + 0.5;
    }
    const [dx, dy, dz] = cameraRay(scene.camera, config, rayX, rayY);
    traceRay(
      scene.camera.origin[0],
      scene.camera.origin[1],
      scene.camera.origin[2],
      dx,
      dy,
      dz,
      1,
      'primary',
      capture,
      null,
    );
    const rawColor = [colorStack[3], colorStack[4], colorStack[5]];
    const displayColor = config.mode === 'modern'
      ? rawColor.map(linearToSrgb).map((value) => clamp(value))
      : rawColor.map((value) => clamp(value));
    return {
      x,
      y,
      rawColor,
      displayColor,
      rgba: displayColor.map((value) => Math.round(value * 255)).concat(255),
      segments: capture.segments,
      tree: capture.root,
    };
  }

  return {
    tracePixel,
    inspectPixel,
    stats,
    bvh,
    bvhBuildMilliseconds,
    boundsCenter,
    boundsDiagonal,
    config,
  };
}

export function snapshotStats(stats, objects) {
  return {
    primaryRays: stats.primaryRays,
    shadowRays: stats.shadowRays,
    reflectionRays: stats.reflectionRays,
    refractionRays: stats.refractionRays,
    totalRays: stats.totalRays,
    hits: stats.hits,
    misses: stats.misses,
    shadowed: stats.shadowed,
    bvhNodeTests: stats.bvhNodeTests,
    triangleTests: stats.triangleTests,
    raysByDepth: Array.from(stats.raysByDepth),
    objectHits: objects.map((object, index) => ({
      name: object.name,
      kind: object.kind,
      hits: stats.objectHits[index],
    })),
  };
}
