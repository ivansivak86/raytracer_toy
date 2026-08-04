import * as THREE from 'three';
import { deriveRayMaterial } from './sceneFactory.js';

const _position = new THREE.Vector3();
const _normal = new THREE.Vector3();
const _edgeA = new THREE.Vector3();
const _edgeB = new THREE.Vector3();
const _faceNormal = new THREE.Vector3();
const _normalMatrix = new THREE.Matrix3();

function copyRayMaterial(material, textureIndex = -1) {
  return {
    color: [...material.color],
    legacyReflectivity: material.legacyReflectivity ?? 0,
    reflectivity: material.reflectivity ?? 0,
    transmission: material.transmission ?? 0,
    ior: material.ior ?? 1.5,
    roughness: material.roughness ?? 0.5,
    shininess: material.shininess ?? 35,
    specularStrength: material.specularStrength ?? 0.35,
    glass: Boolean(material.glass),
    textureIndex,
  };
}

function groupsForGeometry(geometry, elementCount) {
  if (geometry.groups.length) return [...geometry.groups].sort((a, b) => a.start - b.start);
  return [{ start: 0, count: elementCount, materialIndex: 0 }];
}

function actualMaterial(mesh, materialIndex) {
  if (Array.isArray(mesh.material)) return mesh.material[materialIndex] ?? mesh.material[0];
  return mesh.material;
}

function textureFor(mesh, sourceMaterial) {
  if (Object.hasOwn(mesh.userData, 'rayTexture')) return mesh.userData.rayTexture;
  return sourceMaterial?.map ?? null;
}

function rgbaPixelsFromData(image, width, height) {
  if (!image?.data || !ArrayBuffer.isView(image.data)) return null;
  const source = image.data;
  const pixels = width * height;
  if (source.length === pixels * 4 && source instanceof Uint8ClampedArray) {
    return new Uint8ClampedArray(source);
  }
  if (source.length !== pixels * 3 && source.length !== pixels * 4) return null;

  const channels = source.length / pixels;
  const output = new Uint8ClampedArray(pixels * 4);
  const floatingPoint = source instanceof Float32Array || source instanceof Float64Array;
  for (let pixel = 0; pixel < pixels; pixel += 1) {
    const sourceOffset = pixel * channels;
    const targetOffset = pixel * 4;
    const convert = (value) => Math.round(Math.min(255, Math.max(0, floatingPoint ? value * 255 : value)));
    output[targetOffset] = convert(source[sourceOffset]);
    output[targetOffset + 1] = convert(source[sourceOffset + 1]);
    output[targetOffset + 2] = convert(source[sourceOffset + 2]);
    output[targetOffset + 3] = channels === 4 ? convert(source[sourceOffset + 3]) : 255;
  }
  return output;
}

function imageDimensions(image) {
  return {
    width: image?.videoWidth ?? image?.naturalWidth ?? image?.width ?? 0,
    height: image?.videoHeight ?? image?.naturalHeight ?? image?.height ?? 0,
  };
}

function extractTexturePixels(texture) {
  const image = texture?.source?.data ?? texture?.image;
  const { width, height } = imageDimensions(image);
  if (!image || !width || !height) {
    throw new Error('image data is not ready');
  }

  const direct = rgbaPixelsFromData(image, width, height);
  if (direct) return { width, height, pixels: direct };

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('2D canvas is unavailable');
  context.drawImage(image, 0, 0, width, height);
  const pixels = new Uint8ClampedArray(context.getImageData(0, 0, width, height).data);
  return { width, height, pixels };
}

function serializeTexture(texture) {
  texture.updateMatrix?.();
  const image = extractTexturePixels(texture);
  return {
    name: texture.name || 'Texture',
    width: image.width,
    height: image.height,
    pixels: image.pixels,
    matrix: [...(texture.matrix?.elements ?? [1, 0, 0, 0, 1, 0, 0, 0, 1])],
    wrapS: texture.wrapS ?? THREE.ClampToEdgeWrapping,
    wrapT: texture.wrapT ?? THREE.ClampToEdgeWrapping,
    flipY: texture.flipY !== false,
    srgb: texture.colorSpace === THREE.SRGBColorSpace,
  };
}

export function serializeScene(root, cameraSnapshot) {
  root.updateWorldMatrix(true, true);

  const positions = [];
  const normals = [];
  const uvs = [];
  const triangleHasUvs = [];
  const triangleMaterials = [];
  const triangleObjects = [];
  const materials = [];
  const objects = [];
  const textures = [];
  const warnings = [];
  const materialMap = new Map();
  const textureMap = new Map();

  const boundsMin = [Infinity, Infinity, Infinity];
  const boundsMax = [-Infinity, -Infinity, -Infinity];

  function textureIndexFor(texture) {
    if (!texture?.isTexture) return -1;
    if (textureMap.has(texture.uuid)) return textureMap.get(texture.uuid);
    try {
      const index = textures.length;
      textures.push(serializeTexture(texture));
      textureMap.set(texture.uuid, index);
      return index;
    } catch (error) {
      textureMap.set(texture.uuid, -1);
      warnings.push(`Texture “${texture.name || 'unnamed'}” could not be copied into the CPU renderer: ${error instanceof Error ? error.message : String(error)}.`);
      return -1;
    }
  }

  root.traverse((mesh) => {
    if (!mesh.isMesh || mesh.visible === false || mesh.userData.raytrace === false) return;
    const geometry = mesh.geometry;
    const positionAttribute = geometry?.attributes?.position;
    if (!positionAttribute) return;

    if (!geometry.attributes.normal) geometry.computeVertexNormals();
    const normalAttribute = geometry.attributes.normal;
    const uvAttribute = geometry.attributes.uv;
    const indexAttribute = geometry.index;
    const elementCount = indexAttribute ? indexAttribute.count : positionAttribute.count;
    if (elementCount < 3) return;

    const rayObject = {
      name: mesh.userData.rayObject?.name || mesh.name || `Object ${objects.length + 1}`,
      legacyClass: mesh.userData.rayObject?.legacyClass || 'mesh',
      kind: mesh.userData.rayObject?.kind || 'mesh',
    };
    const objectIndex = objects.length;
    objects.push(rayObject);

    const worldPositions = new Float32Array(positionAttribute.count * 3);
    const worldNormals = new Float32Array(positionAttribute.count * 3);
    _normalMatrix.getNormalMatrix(mesh.matrixWorld);

    for (let vertexIndex = 0; vertexIndex < positionAttribute.count; vertexIndex += 1) {
      _position.fromBufferAttribute(positionAttribute, vertexIndex).applyMatrix4(mesh.matrixWorld);
      _normal.fromBufferAttribute(normalAttribute, vertexIndex).applyNormalMatrix(_normalMatrix);

      const offset = vertexIndex * 3;
      worldPositions[offset] = _position.x;
      worldPositions[offset + 1] = _position.y;
      worldPositions[offset + 2] = _position.z;
      worldNormals[offset] = _normal.x;
      worldNormals[offset + 1] = _normal.y;
      worldNormals[offset + 2] = _normal.z;
    }

    const groups = groupsForGeometry(geometry, elementCount);
    let groupCursor = 0;

    for (let elementOffset = 0; elementOffset <= elementCount - 3; elementOffset += 3) {
      while (
        groupCursor < groups.length - 1
        && elementOffset >= groups[groupCursor].start + groups[groupCursor].count
      ) {
        groupCursor += 1;
      }

      const group = groups[groupCursor];
      if (elementOffset < group.start || elementOffset + 2 >= group.start + group.count) continue;

      const a = indexAttribute ? indexAttribute.getX(elementOffset) : elementOffset;
      const b = indexAttribute ? indexAttribute.getX(elementOffset + 1) : elementOffset + 1;
      const c = indexAttribute ? indexAttribute.getX(elementOffset + 2) : elementOffset + 2;
      if (a === b || b === c || c === a) continue;

      const ao = a * 3;
      const bo = b * 3;
      const co = c * 3;

      _position.set(worldPositions[ao], worldPositions[ao + 1], worldPositions[ao + 2]);
      _edgeA.set(
        worldPositions[bo] - _position.x,
        worldPositions[bo + 1] - _position.y,
        worldPositions[bo + 2] - _position.z,
      );
      _edgeB.set(
        worldPositions[co] - _position.x,
        worldPositions[co + 1] - _position.y,
        worldPositions[co + 2] - _position.z,
      );
      _faceNormal.crossVectors(_edgeA, _edgeB);
      if (_faceNormal.lengthSq() < 1e-16) continue;

      for (const vertexOffset of [ao, bo, co]) {
        const x = worldPositions[vertexOffset];
        const y = worldPositions[vertexOffset + 1];
        const z = worldPositions[vertexOffset + 2];
        positions.push(x, y, z);
        normals.push(
          worldNormals[vertexOffset],
          worldNormals[vertexOffset + 1],
          worldNormals[vertexOffset + 2],
        );
        boundsMin[0] = Math.min(boundsMin[0], x);
        boundsMin[1] = Math.min(boundsMin[1], y);
        boundsMin[2] = Math.min(boundsMin[2], z);
        boundsMax[0] = Math.max(boundsMax[0], x);
        boundsMax[1] = Math.max(boundsMax[1], y);
        boundsMax[2] = Math.max(boundsMax[2], z);
      }

      if (uvAttribute) {
        uvs.push(
          uvAttribute.getX(a), uvAttribute.getY(a),
          uvAttribute.getX(b), uvAttribute.getY(b),
          uvAttribute.getX(c), uvAttribute.getY(c),
        );
        triangleHasUvs.push(1);
      } else {
        uvs.push(0, 0, 0, 0, 0, 0);
        triangleHasUvs.push(0);
      }

      const sourceMaterial = actualMaterial(mesh, group.materialIndex ?? 0);
      const texture = textureFor(mesh, sourceMaterial);
      const textureIndex = textureIndexFor(texture);
      const key = mesh.userData.rayMaterial
        ? `ray:${mesh.uuid}:${textureIndex}`
        : `three:${mesh.uuid}:${sourceMaterial?.uuid ?? group.materialIndex ?? 0}:${textureIndex}`;

      let materialIndex = materialMap.get(key);
      if (materialIndex === undefined) {
        const rayMaterial = mesh.userData.rayMaterial
          ? copyRayMaterial(mesh.userData.rayMaterial, textureIndex)
          : copyRayMaterial(deriveRayMaterial(sourceMaterial, rayObject), textureIndex);
        materialIndex = materials.length;
        materials.push(rayMaterial);
        materialMap.set(key, materialIndex);
      }

      triangleMaterials.push(materialIndex);
      triangleObjects.push(objectIndex);
    }
  });

  if (!positions.length) throw new Error('The scene contains no ray-traceable triangles.');

  const definition = root.userData.sceneDefinition ?? {};
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    triangleHasUvs: new Uint8Array(triangleHasUvs),
    triangleMaterials: new Uint32Array(triangleMaterials),
    triangleObjects: new Uint32Array(triangleObjects),
    materials,
    textures,
    warnings: [...new Set(warnings)],
    objects,
    lights: definition.lights ?? [
      { name: 'Light', position: [7, 10, 6], color: [1, 1, 1], intensity: 1 },
    ],
    background: definition.background ?? [0, 0, 0],
    bounds: { min: boundsMin, max: boundsMax },
    camera: cameraSnapshot,
  };
}

export function sceneTransferables(scene) {
  return [
    scene.positions.buffer,
    scene.normals.buffer,
    scene.uvs.buffer,
    scene.triangleHasUvs.buffer,
    scene.triangleMaterials.buffer,
    scene.triangleObjects.buffer,
    ...scene.textures.map((texture) => texture.pixels.buffer),
  ];
}
