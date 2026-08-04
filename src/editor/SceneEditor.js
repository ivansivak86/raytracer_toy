import * as THREE from 'three';
import { deriveRayMaterial } from '../scene/sceneFactory.js';

const TRANSFORM_INPUTS = [
  'transformPositionX', 'transformPositionY', 'transformPositionZ',
  'transformRotationX', 'transformRotationY', 'transformRotationZ',
  'transformScaleX', 'transformScaleY', 'transformScaleZ',
];

const MATERIAL_INPUTS = [
  'materialColor',
  'materialReflectivity',
  'materialLegacyReflectivity',
  'materialRoughness',
  'materialSpecular',
  'materialTransmission',
  'materialIor',
];

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function materialArray(material) {
  return Array.isArray(material) ? material : [material];
}

function cloneRayMaterial(material) {
  if (!material) return null;
  return {
    color: [...material.color],
    legacyReflectivity: finite(material.legacyReflectivity),
    reflectivity: finite(material.reflectivity),
    transmission: finite(material.transmission),
    ior: finite(material.ior, 1.5),
    roughness: finite(material.roughness, 0.5),
    shininess: finite(material.shininess, 35),
    specularStrength: finite(material.specularStrength, 0.35),
    glass: Boolean(material.glass),
  };
}

function disposeMaterial(material, preserveTextures = new Set()) {
  for (const candidate of materialArray(material)) {
    if (!candidate) continue;
    for (const value of Object.values(candidate)) {
      if (value?.isTexture && !preserveTextures.has(value)) value.dispose?.();
    }
    candidate.dispose?.();
  }
}

function makePhysicalMaterial(source, rayMaterial) {
  const color = source?.color?.isColor
    ? source.color.clone()
    : new THREE.Color().fromArray(rayMaterial.color);
  const material = new THREE.MeshPhysicalMaterial({
    color,
    map: source?.map ?? null,
    normalMap: source?.normalMap ?? null,
    roughnessMap: source?.roughnessMap ?? null,
    metalnessMap: source?.metalnessMap ?? null,
    alphaMap: source?.alphaMap ?? null,
    emissiveMap: source?.emissiveMap ?? null,
    emissive: source?.emissive?.isColor ? source.emissive.clone() : new THREE.Color(0x000000),
    roughness: finite(source?.roughness, rayMaterial.roughness),
    metalness: finite(source?.metalness, Math.min(0.45, rayMaterial.reflectivity * 0.35)),
    transmission: finite(source?.transmission, 0),
    ior: finite(source?.ior, rayMaterial.ior),
    thickness: finite(source?.thickness, 0.45),
    specularIntensity: finite(source?.specularIntensity, rayMaterial.specularStrength),
    transparent: Boolean(source?.transparent),
    opacity: finite(source?.opacity, 1),
    alphaTest: finite(source?.alphaTest),
    side: source?.side ?? THREE.DoubleSide,
    depthWrite: source?.depthWrite ?? true,
    depthTest: source?.depthTest ?? true,
    wireframe: Boolean(source?.wireframe),
    vertexColors: Boolean(source?.vertexColors),
  });
  material.name = source?.name ? `${source.name} (editable)` : 'Editable ray-tracing material';
  return material;
}

function colorToHex(color) {
  return `#${new THREE.Color().fromArray(color).getHexString().toUpperCase()}`;
}

function radiansToDegrees(value) {
  return THREE.MathUtils.radToDeg(value);
}

function degreesToRadians(value) {
  return THREE.MathUtils.degToRad(value);
}

function isTextEntry(target) {
  return Boolean(
    target
    && (
      target.matches?.('input, select, textarea, button')
      || target.isContentEditable
    ),
  );
}

export class SceneEditor {
  constructor({ preview, elements, onSceneChanged, onUiChanged, toast, getRenderMode }) {
    this.preview = preview;
    this.elements = elements;
    this.onSceneChanged = onSceneChanged;
    this.onUiChanged = onUiChanged;
    this.toast = toast;
    this.getRenderMode = getRenderMode;
    this.root = null;
    this.meshes = [];
    this.selected = null;
    this.enabled = true;
    this.currentMode = 'translate';
    this.textureUrls = new Set();

    this.preview.setEditorCallbacks({
      onSelectionChange: (mesh) => this.handlePreviewSelection(mesh),
      onObjectChange: (mesh) => this.handleManipulatorChange(mesh),
    });

    this.bindEvents();
    this.setSelection(null, { updatePreview: false });
  }

  bindEvents() {
    const e = this.elements;
    e.objectSelect.addEventListener('change', () => {
      const mesh = this.meshes.find((candidate) => candidate.uuid === e.objectSelect.value) ?? null;
      this.setSelection(mesh);
    });

    e.transformTranslateButton.addEventListener('click', () => this.setTransformMode('translate'));
    e.transformRotateButton.addEventListener('click', () => this.setTransformMode('rotate'));
    e.transformScaleButton.addEventListener('click', () => this.setTransformMode('scale'));
    e.transformSpaceSelect.addEventListener('change', () => {
      this.preview.setTransformSpace(e.transformSpaceSelect.value);
    });
    e.deselectObjectButton.addEventListener('click', () => this.setSelection(null));
    e.transformResetButton.addEventListener('click', () => this.resetTransform());

    for (const key of TRANSFORM_INPUTS) {
      e[key].addEventListener('input', () => this.applyTransformFields());
    }

    e.materialColor.addEventListener('input', () => this.applyMaterialFields());
    for (const key of MATERIAL_INPUTS.filter((key) => key !== 'materialColor')) {
      e[key].addEventListener('input', () => this.applyMaterialFields());
    }
    e.materialTextureButton.addEventListener('click', () => e.materialTextureInput.click());
    e.materialTextureInput.addEventListener('change', () => {
      this.loadTexture(e.materialTextureInput.files?.[0]);
    });
    e.materialTextureRemove.addEventListener('click', () => this.removeTexture());
    e.materialResetButton.addEventListener('click', () => this.resetMaterial());

    this.handleKeyDown = (event) => {
      if (event.defaultPrevented || !this.enabled || isTextEntry(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === 'w') this.setTransformMode('translate');
      else if (key === 'e') this.setTransformMode('rotate');
      else if (key === 'r') this.setTransformMode('scale');
      else if (key === 'q') {
        const next = e.transformSpaceSelect.value === 'world' ? 'local' : 'world';
        e.transformSpaceSelect.value = next;
        this.preview.setTransformSpace(next);
      } else if (key === 'escape') {
        this.setSelection(null);
      } else {
        return;
      }
      event.preventDefault();
    };
    window.addEventListener('keydown', this.handleKeyDown);
  }

  setWorld(root) {
    if (this.root && this.root !== root) this.releaseObjectUrls(this.root);
    this.root = root;
    this.meshes = [];
    root?.traverse((object) => {
      if (!object.isMesh || object.userData.raytrace === false || !object.geometry?.attributes?.position) return;
      this.captureInitialState(object);
      this.meshes.push(object);
    });

    const nameCounts = new Map();
    for (const mesh of this.meshes) {
      const base = mesh.userData.rayObject?.name || mesh.name || 'Mesh';
      nameCounts.set(base, (nameCounts.get(base) ?? 0) + 1);
    }
    const seen = new Map();
    this.elements.objectSelect.innerHTML = '<option value="">(none)</option>';
    for (const mesh of this.meshes) {
      const base = mesh.userData.rayObject?.name || mesh.name || 'Mesh';
      const ordinal = (seen.get(base) ?? 0) + 1;
      seen.set(base, ordinal);
      const suffix = nameCounts.get(base) > 1 ? ` (${ordinal})` : '';
      const option = document.createElement('option');
      option.value = mesh.uuid;
      option.textContent = `${base}${suffix}`;
      this.elements.objectSelect.append(option);
    }

    this.setSelection(null, { updatePreview: false });
  }

  captureInitialState(mesh) {
    if (mesh.userData.editorInitialState) return;
    mesh.userData.editorInitialState = {
      position: mesh.position.toArray(),
      rotation: [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z, mesh.rotation.order],
      scale: mesh.scale.toArray(),
      hadRayMaterial: Boolean(mesh.userData.rayMaterial),
      rayMaterial: cloneRayMaterial(mesh.userData.rayMaterial),
      previewMaterial: mesh.material,
      textureName: this.textureNameForMesh(mesh),
    };
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    this.preview.setEditorEnabled(this.enabled);
    this.refreshDisabledState();
    this.onUiChanged?.();
  }

  handlePreviewSelection(mesh) {
    this.setSelection(mesh, { updatePreview: false });
  }

  handleManipulatorChange(mesh) {
    if (!mesh || mesh !== this.selected) return;
    this.syncTransformFields();
    this.onSceneChanged?.('Object transform changed');
  }

  setSelection(mesh, { updatePreview = true } = {}) {
    this.selected = mesh && this.meshes.includes(mesh) ? mesh : null;
    if (updatePreview) this.preview.selectObject(this.selected, { notify: false });
    this.elements.objectSelect.value = this.selected?.uuid ?? '';
    this.syncSelectionUi();
    this.onUiChanged?.();
  }

  syncSelectionUi() {
    const e = this.elements;
    if (!this.selected) {
      e.selectedObjectCaption.textContent = 'Click a mesh in the preview or choose one from the list.';
      if (e.materialDialogObjectCaption) e.materialDialogObjectCaption.textContent = 'No object selected.';
      for (const key of TRANSFORM_INPUTS) e[key].value = '';
      e.materialColor.value = '#ffffff';
      e.materialColorValue.textContent = '#FFFFFF';
      for (const key of MATERIAL_INPUTS.filter((key) => key !== 'materialColor')) e[key].value = '';
      e.materialTextureName.textContent = 'No texture';
      e.materialUvStatus.textContent = 'Select an object to inspect UV support.';
      this.refreshDisabledState();
      return;
    }

    const name = this.selected.userData.rayObject?.name || this.selected.name || 'Mesh';
    const kind = this.selected.userData.rayObject?.kind || 'mesh';
    const triangleCount = Math.floor(
      (this.selected.geometry.index?.count ?? this.selected.geometry.attributes.position.count) / 3,
    );
    const selectionDescription = `${name} · ${kind} · ${triangleCount.toLocaleString()} triangles`;
    e.selectedObjectCaption.textContent = selectionDescription;
    if (e.materialDialogObjectCaption) e.materialDialogObjectCaption.textContent = selectionDescription;
    this.syncTransformFields();
    this.syncMaterialFields();
    this.refreshDisabledState();
  }

  refreshDisabledState() {
    const unavailable = !this.enabled || !this.selected;
    const e = this.elements;
    e.objectSelect.disabled = !this.enabled;
    e.transformTranslateButton.disabled = unavailable;
    e.transformRotateButton.disabled = unavailable;
    e.transformScaleButton.disabled = unavailable;
    e.transformSpaceSelect.disabled = unavailable;
    e.transformResetButton.disabled = unavailable;
    e.deselectObjectButton.disabled = unavailable;
    for (const key of TRANSFORM_INPUTS) e[key].disabled = unavailable;
    for (const key of MATERIAL_INPUTS) e[key].disabled = unavailable;
    e.materialTextureButton.disabled = unavailable;
    e.materialTextureRemove.disabled = unavailable || !this.textureForMesh(this.selected);
    e.materialResetButton.disabled = unavailable;
  }

  setTransformMode(mode) {
    if (!['translate', 'rotate', 'scale'].includes(mode)) return;
    this.currentMode = mode;
    this.preview.setTransformMode(mode);
    const buttons = {
      translate: this.elements.transformTranslateButton,
      rotate: this.elements.transformRotateButton,
      scale: this.elements.transformScaleButton,
    };
    for (const [key, button] of Object.entries(buttons)) {
      button.classList.toggle('default', key === mode);
      button.setAttribute('aria-pressed', String(key === mode));
    }
    this.onUiChanged?.();
  }

  syncTransformFields() {
    if (!this.selected) return;
    const e = this.elements;
    const { position, rotation, scale } = this.selected;
    e.transformPositionX.value = position.x.toFixed(4);
    e.transformPositionY.value = position.y.toFixed(4);
    e.transformPositionZ.value = position.z.toFixed(4);
    e.transformRotationX.value = radiansToDegrees(rotation.x).toFixed(2);
    e.transformRotationY.value = radiansToDegrees(rotation.y).toFixed(2);
    e.transformRotationZ.value = radiansToDegrees(rotation.z).toFixed(2);
    e.transformScaleX.value = scale.x.toFixed(4);
    e.transformScaleY.value = scale.y.toFixed(4);
    e.transformScaleZ.value = scale.z.toFixed(4);
  }

  applyTransformFields() {
    if (!this.enabled || !this.selected) return;
    const e = this.elements;
    const value = (element, fallback) => {
      const parsed = Number(element.value);
      return Number.isFinite(parsed) ? parsed : fallback;
    };
    this.selected.position.set(
      value(e.transformPositionX, this.selected.position.x),
      value(e.transformPositionY, this.selected.position.y),
      value(e.transformPositionZ, this.selected.position.z),
    );
    this.selected.rotation.set(
      degreesToRadians(value(e.transformRotationX, radiansToDegrees(this.selected.rotation.x))),
      degreesToRadians(value(e.transformRotationY, radiansToDegrees(this.selected.rotation.y))),
      degreesToRadians(value(e.transformRotationZ, radiansToDegrees(this.selected.rotation.z))),
      this.selected.rotation.order,
    );
    this.selected.scale.set(
      Math.max(0.001, Math.abs(value(e.transformScaleX, this.selected.scale.x))),
      Math.max(0.001, Math.abs(value(e.transformScaleY, this.selected.scale.y))),
      Math.max(0.001, Math.abs(value(e.transformScaleZ, this.selected.scale.z))),
    );
    this.selected.updateMatrix();
    this.preview.refreshSelectionHelper();
    this.onSceneChanged?.('Object transform changed');
  }

  resetTransform() {
    if (!this.selected) return;
    const initial = this.selected.userData.editorInitialState;
    this.selected.position.fromArray(initial.position);
    this.selected.rotation.set(...initial.rotation);
    this.selected.scale.fromArray(initial.scale);
    this.selected.updateMatrix();
    this.syncTransformFields();
    this.preview.refreshSelectionHelper();
    this.onSceneChanged?.('Object transform reset');
  }

  rayMaterialForMesh(mesh, { create = false } = {}) {
    if (!mesh) return null;
    if (mesh.userData.rayMaterial) return mesh.userData.rayMaterial;
    const source = materialArray(mesh.material).find(Boolean);
    const derived = deriveRayMaterial(source, mesh.userData.rayObject ?? {});
    if (create) mesh.userData.rayMaterial = derived;
    return derived;
  }

  ensureEditablePreviewMaterial(mesh) {
    if (mesh.userData.editorOwnsPreviewMaterial) return;
    const rayMaterial = this.rayMaterialForMesh(mesh, { create: true });
    const originals = materialArray(mesh.material);
    const replacements = originals.map((source) => makePhysicalMaterial(source, rayMaterial));
    mesh.material = Array.isArray(mesh.material) ? replacements : replacements[0];
    mesh.userData.editorOwnsPreviewMaterial = true;
  }

  syncMaterialFields() {
    if (!this.selected) return;
    const e = this.elements;
    const material = this.rayMaterialForMesh(this.selected);
    const hex = colorToHex(material.color);
    e.materialColor.value = hex.toLowerCase();
    e.materialColorValue.textContent = hex;
    e.materialReflectivity.value = finite(material.reflectivity).toFixed(2);
    e.materialLegacyReflectivity.value = finite(material.legacyReflectivity).toFixed(2);
    e.materialRoughness.value = finite(material.roughness, 0.5).toFixed(2);
    e.materialSpecular.value = finite(material.specularStrength, 0.35).toFixed(2);
    e.materialTransmission.value = finite(material.transmission).toFixed(2);
    e.materialIor.value = finite(material.ior, 1.5).toFixed(2);

    const texture = this.textureForMesh(this.selected);
    e.materialTextureName.textContent = this.textureNameForMesh(this.selected) || 'No texture';
    const hasUv = Boolean(this.selected.geometry.attributes.uv);
    e.materialUvStatus.textContent = hasUv
      ? 'UV coordinates found. The texture is available to both preview and CPU render.'
      : 'No UV coordinates found. The preview can show a texture, but the CPU tracer will use base color.';
    e.materialTextureRemove.disabled = !this.enabled || !texture;
  }

  applyMaterialFields() {
    if (!this.enabled || !this.selected) return;
    this.ensureEditablePreviewMaterial(this.selected);
    const e = this.elements;
    const material = this.rayMaterialForMesh(this.selected, { create: true });
    const color = new THREE.Color(e.materialColor.value);
    material.color = color.toArray();
    material.reflectivity = clamp(Number(e.materialReflectivity.value) || 0, 0, 1);
    material.legacyReflectivity = clamp(Number(e.materialLegacyReflectivity.value) || 0, 0, 1);
    material.roughness = clamp(Number(e.materialRoughness.value) || 0, 0, 1);
    material.specularStrength = clamp(Number(e.materialSpecular.value) || 0, 0, 2);
    material.transmission = clamp(Number(e.materialTransmission.value) || 0, 0, 1);
    material.ior = clamp(Number(e.materialIor.value) || 1, 1, 2.5);
    material.shininess = Math.max(4, Math.round((1 - material.roughness) * 92));
    material.glass = material.transmission > 0;
    e.materialColorValue.textContent = colorToHex(material.color);
    this.updatePreviewMaterial(this.selected);
    this.onSceneChanged?.('Object material changed');
  }

  updatePreviewMaterial(mesh) {
    if (!mesh) return;
    const rayMaterial = this.rayMaterialForMesh(mesh);
    const texture = this.textureForMesh(mesh);
    for (const material of materialArray(mesh.material)) {
      if (!material) continue;
      material.color?.fromArray(rayMaterial.color);
      if ('roughness' in material) material.roughness = rayMaterial.roughness;
      if ('metalness' in material) material.metalness = Math.min(0.5, rayMaterial.reflectivity * 0.42);
      if ('specularIntensity' in material) material.specularIntensity = rayMaterial.specularStrength;
      if ('ior' in material) material.ior = rayMaterial.ior;
      if ('transmission' in material) {
        material.transmission = this.getRenderMode() === 'modern' ? rayMaterial.transmission : 0;
      }
      material.transparent = this.getRenderMode() === 'modern' && rayMaterial.transmission > 0;
      material.opacity = 1;
      material.map = texture ?? null;
      material.needsUpdate = true;
    }
  }

  refreshMaterialPreview() {
    this.root?.traverse((mesh) => {
      if (!mesh.isMesh || !mesh.userData.raytrace) return;
      if (mesh.userData.rayMaterial) this.updatePreviewMaterial(mesh);
    });
    if (this.selected) this.syncMaterialFields();
  }

  textureForMesh(mesh) {
    if (!mesh) return null;
    if (Object.hasOwn(mesh.userData, 'rayTexture')) {
      return mesh.userData.rayTexture?.isTexture ? mesh.userData.rayTexture : null;
    }
    return materialArray(mesh.material).find((material) => material?.map)?.map ?? null;
  }

  textureNameForMesh(mesh) {
    if (!mesh) return '';
    if (mesh.userData.rayTextureName) return mesh.userData.rayTextureName;
    const texture = this.textureForMesh(mesh);
    if (!texture) return '';
    return texture.name || texture.source?.data?.currentSrc?.split('/').pop() || 'Embedded texture';
  }

  async loadTexture(file) {
    if (!file || !this.selected) return;
    const mesh = this.selected;
    const url = URL.createObjectURL(file);
    this.textureUrls.add(url);
    try {
      const texture = await new THREE.TextureLoader().loadAsync(url);
      texture.name = file.name;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.needsUpdate = true;

      if (mesh.userData.rayTextureOwned && mesh.userData.rayTexture) {
        mesh.userData.rayTexture.dispose?.();
      }
      const previousUrl = mesh.userData.rayTextureUrl;
      if (previousUrl) {
        URL.revokeObjectURL(previousUrl);
        this.textureUrls.delete(previousUrl);
      }

      this.ensureEditablePreviewMaterial(mesh);
      mesh.userData.rayTexture = texture;
      mesh.userData.rayTextureOwned = true;
      mesh.userData.rayTextureName = file.name;
      mesh.userData.rayTextureUrl = url;
      this.updatePreviewMaterial(mesh);
      if (this.selected === mesh) this.syncMaterialFields();
      this.onSceneChanged?.('Object texture changed');
      if (!mesh.geometry.attributes.uv) {
        this.toast?.('The selected mesh has no UV coordinates. The texture can appear in preview, but the CPU tracer will retain the base color.', 'warning', 6500);
      }
    } catch (error) {
      URL.revokeObjectURL(url);
      this.textureUrls.delete(url);
      this.toast?.(error instanceof Error ? error.message : String(error), 'error', 7000);
    } finally {
      this.elements.materialTextureInput.value = '';
    }
  }

  removeTexture() {
    if (!this.selected) return;
    const mesh = this.selected;
    this.ensureEditablePreviewMaterial(mesh);
    if (mesh.userData.rayTextureOwned && mesh.userData.rayTexture) {
      mesh.userData.rayTexture.dispose?.();
    }
    const url = mesh.userData.rayTextureUrl;
    if (url) {
      URL.revokeObjectURL(url);
      this.textureUrls.delete(url);
    }
    mesh.userData.rayTexture = null;
    mesh.userData.rayTextureOwned = false;
    mesh.userData.rayTextureName = '';
    mesh.userData.rayTextureUrl = '';
    for (const material of materialArray(mesh.material)) {
      if (!material) continue;
      material.map = null;
      material.needsUpdate = true;
    }
    this.syncMaterialFields();
    this.onSceneChanged?.('Object texture removed');
  }

  resetMaterial() {
    if (!this.selected) return;
    const mesh = this.selected;
    const initial = mesh.userData.editorInitialState;
    const currentTexture = mesh.userData.rayTexture;
    const initialTextures = new Set();
    for (const material of materialArray(initial.previewMaterial)) {
      if (!material) continue;
      for (const value of Object.values(material)) {
        if (value?.isTexture) initialTextures.add(value);
      }
    }

    if (mesh.userData.editorOwnsPreviewMaterial) {
      disposeMaterial(mesh.material, initialTextures);
      mesh.material = initial.previewMaterial;
      mesh.userData.editorOwnsPreviewMaterial = false;
    }
    if (mesh.userData.rayTextureOwned && currentTexture && !initialTextures.has(currentTexture)) {
      currentTexture.dispose?.();
    }
    const url = mesh.userData.rayTextureUrl;
    if (url) {
      URL.revokeObjectURL(url);
      this.textureUrls.delete(url);
    }

    if (initial.hadRayMaterial) mesh.userData.rayMaterial = cloneRayMaterial(initial.rayMaterial);
    else delete mesh.userData.rayMaterial;
    delete mesh.userData.rayTexture;
    delete mesh.userData.rayTextureOwned;
    delete mesh.userData.rayTextureName;
    delete mesh.userData.rayTextureUrl;

    this.syncMaterialFields();
    this.refreshMaterialPreview();
    this.onSceneChanged?.('Object material reset');
  }

  releaseObjectUrls(root) {
    root?.traverse((mesh) => {
      const url = mesh.userData?.rayTextureUrl;
      if (!url) return;
      URL.revokeObjectURL(url);
      this.textureUrls.delete(url);
      mesh.userData.rayTextureUrl = '';
    });
  }

  dispose() {
    window.removeEventListener('keydown', this.handleKeyDown);
    this.releaseObjectUrls(this.root);
    for (const url of this.textureUrls) URL.revokeObjectURL(url);
    this.textureUrls.clear();
  }
}
