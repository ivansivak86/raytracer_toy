import * as THREE from 'three';

function createGeometry(object) {
  switch (object.kind) {
    case 'plane':
      return new THREE.PlaneGeometry(object.width, object.height, 1, 1);
    case 'box':
      return new THREE.BoxGeometry(...object.size);
    case 'sphere':
      return new THREE.SphereGeometry(
        object.radius,
        object.widthSegments ?? 32,
        object.heightSegments ?? 24,
      );
    case 'cylinder':
      return new THREE.CylinderGeometry(
        object.radiusTop,
        object.radiusBottom,
        object.height,
        object.radialSegments ?? 24,
        1,
        false,
      );
    case 'torus':
      return new THREE.TorusGeometry(
        object.majorRadius,
        object.minorRadius,
        object.radialSegments ?? 40,
        object.tubularSegments ?? 16,
      );
    default:
      throw new Error(`Unsupported legacy object kind: ${object.kind}`);
  }
}

function createPreviewMaterial(rayMaterial) {
  const color = new THREE.Color().fromArray(rayMaterial.color);

  if (rayMaterial.glass) {
    return new THREE.MeshPhysicalMaterial({
      color,
      roughness: rayMaterial.roughness,
      metalness: 0,
      transmission: 0,
      thickness: 0.45,
      ior: rayMaterial.ior,
      transparent: false,
      opacity: 1,
      side: THREE.DoubleSide,
    });
  }

  return new THREE.MeshStandardMaterial({
    color,
    roughness: rayMaterial.roughness,
    metalness: rayMaterial.reflectivity > 0.4 ? 0.18 : 0.03,
    side: rayMaterial.legacyReflectivity > 0 ? THREE.DoubleSide : THREE.FrontSide,
  });
}

export function buildLegacyScene(definition, mode = 'legacy') {
  const root = new THREE.Group();
  root.name = 'Legacy GLScene composition';
  root.userData.sceneDefinition = definition;

  for (const object of definition.objects) {
    const geometry = createGeometry(object);
    const material = createPreviewMaterial(object.material);
    const mesh = new THREE.Mesh(geometry, material);

    mesh.name = object.name;
    mesh.position.fromArray(object.position);
    if (object.rotation) mesh.rotation.fromArray(object.rotation);
    mesh.castShadow = object.kind !== 'plane';
    mesh.receiveShadow = true;
    mesh.userData.raytrace = true;
    mesh.userData.rayObject = {
      name: object.name,
      legacyClass: object.legacyClass,
      kind: object.kind,
    };
    mesh.userData.rayMaterial = { ...object.material };

    root.add(mesh);
  }

  applyPreviewMode(root, mode);
  return root;
}

function materialColor(material) {
  if (material?.color?.isColor) return material.color.toArray();
  return [0.62, 0.66, 0.74];
}

function prepareImportedMesh(mesh) {
  if (!mesh.geometry?.attributes?.position) return;
  if (!mesh.geometry.attributes.normal) mesh.geometry.computeVertexNormals();

  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.raytrace = true;
  mesh.userData.rayObject = {
    name: mesh.name || 'Imported mesh',
    legacyClass: 'mesh',
    kind: 'mesh',
  };

  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const material of materials) {
    if (!material) continue;
    material.side = THREE.DoubleSide;
    material.needsUpdate = true;
  }
}

function groundMaterial() {
  return {
    color: [0.16, 0.18, 0.23],
    legacyReflectivity: 0.95,
    reflectivity: 0.16,
    transmission: 0,
    ior: 1.5,
    roughness: 0.58,
    shininess: 32,
    specularStrength: 0.24,
    glass: false,
  };
}

export function buildModelScene(model, label = 'Imported model') {
  const root = new THREE.Group();
  root.name = label;

  const modelContainer = new THREE.Group();
  modelContainer.name = `${label} model`;
  modelContainer.add(model);
  root.add(modelContainer);

  model.traverse((child) => {
    if (child.isMesh) prepareImportedMesh(child);
  });

  model.updateWorldMatrix(true, true);
  const originalBounds = new THREE.Box3().setFromObject(model);
  if (originalBounds.isEmpty()) {
    throw new Error('The selected model contains no renderable mesh geometry.');
  }

  const center = originalBounds.getCenter(new THREE.Vector3());
  const size = originalBounds.getSize(new THREE.Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z, 1e-6);
  const scale = 3.15 / maxDimension;

  model.scale.multiplyScalar(scale);
  model.position.addScaledVector(center, -scale);
  model.updateWorldMatrix(true, true);

  const centeredBounds = new THREE.Box3().setFromObject(model);
  model.position.y -= centeredBounds.min.y;
  model.updateWorldMatrix(true, true);

  const finalBounds = new THREE.Box3().setFromObject(model);
  const finalSize = finalBounds.getSize(new THREE.Vector3());
  const target = finalBounds.getCenter(new THREE.Vector3());

  const planeSize = Math.max(8, Math.max(finalSize.x, finalSize.z) * 3.5);
  const planeRayMaterial = groundMaterial();
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(planeSize, planeSize),
    createPreviewMaterial(planeRayMaterial),
  );
  plane.name = 'Ground plane';
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = -0.012;
  plane.receiveShadow = true;
  plane.userData.raytrace = true;
  plane.userData.rayObject = {
    name: plane.name,
    legacyClass: 'plane',
    kind: 'plane',
  };
  plane.userData.rayMaterial = planeRayMaterial;
  root.add(plane);

  const radius = Math.max(finalSize.length() * 0.72, 2.4);
  const cameraPosition = target.clone().add(new THREE.Vector3(radius, radius * 0.72, radius));
  const lightPosition = target.clone().add(new THREE.Vector3(radius * 1.2, radius * 2.1, radius * 1.1));

  root.userData.sceneDefinition = {
    id: 'model',
    name: label,
    source: 'Three.js loader',
    background: [0, 0, 0],
    camera: {
      position: cameraPosition.toArray(),
      target: target.toArray(),
      up: [0, 1, 0],
      far: Math.max(250, radius * 20),
    },
    lights: [
      {
        name: 'Model key light',
        position: lightPosition.toArray(),
        color: [1, 0.98, 0.95],
        intensity: 1,
      },
    ],
  };

  return root;
}

export function applyPreviewMode(root, mode) {
  if (!root) return;
  root.traverse((child) => {
    if (!child.isMesh) return;
    const rayMaterial = child.userData.rayMaterial;
    if (!rayMaterial) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      if (!material?.isMeshPhysicalMaterial) continue;
      if (mode === 'modern') {
        material.transmission = rayMaterial.transmission;
        material.roughness = rayMaterial.roughness;
        material.thickness = 0.45;
        material.ior = rayMaterial.ior;
        material.transparent = rayMaterial.transmission > 0;
        material.opacity = 1;
      } else {
        material.transmission = 0;
        material.roughness = rayMaterial.glass ? 0.22 : rayMaterial.roughness;
        material.transparent = false;
        material.opacity = 1;
      }
      material.needsUpdate = true;
    }
  });
}

export function deriveRayMaterial(material, objectDefaults = {}) {
  const color = materialColor(material);
  const roughness = Number.isFinite(material?.roughness)
    ? material.roughness
    : Math.max(0.08, 1 - ((material?.shininess ?? 35) / 100));

  return {
    color,
    legacyReflectivity: objectDefaults.legacyClass === 'cube' ? 0 : 0.95,
    reflectivity: objectDefaults.legacyClass === 'plane' ? 0.16 : 0.12,
    transmission: Number.isFinite(material?.transmission) ? material.transmission : 0,
    ior: Number.isFinite(material?.ior) ? material.ior : 1.5,
    roughness,
    shininess: Number.isFinite(material?.shininess)
      ? material.shininess
      : Math.max(8, Math.round((1 - roughness) * 90)),
    specularStrength: objectDefaults.legacyClass === 'plane' ? 0.22 : 0.38,
    glass: (material?.transmission ?? 0) > 0,
  };
}

export function disposeObject3D(root) {
  const materials = new Set();
  const textures = new Set();
  root?.traverse((child) => {
    if (!child.isMesh) return;
    child.geometry?.dispose?.();
    const current = Array.isArray(child.material) ? child.material : [child.material];
    const original = child.userData.editorInitialState?.previewMaterial;
    const originals = Array.isArray(original) ? original : [original];
    for (const material of [...current, ...originals]) {
      if (material) materials.add(material);
    }
    if (child.userData.rayTexture?.isTexture) textures.add(child.userData.rayTexture);
  });

  for (const material of materials) {
    for (const value of Object.values(material)) {
      if (value?.isTexture) textures.add(value);
    }
    material.dispose?.();
  }
  for (const texture of textures) texture.dispose?.();
}
