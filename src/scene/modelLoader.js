import { LoadingManager } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { TDSLoader } from 'three/addons/loaders/TDSLoader.js';

const BASE_URL = import.meta.env?.BASE_URL ?? '/';
const NORMALIZED_BASE_URL = BASE_URL.endsWith('/') ? BASE_URL : `${BASE_URL}/`;
const assetUrl = (path) => `${NORMALIZED_BASE_URL}${path.replace(/^\/+/, '')}`;

const PRESETS = {
  werewolf: {
    label: 'Werewolf head (.3ds)',
    url: assetUrl('models/warewolfhead.3ds'),
    extension: '3ds',
  },
  pickup: {
    label: 'Pickup truck (.3ds)',
    url: assetUrl('models/pickup.3ds'),
    extension: '3ds',
  },
};

function loaderError(error, label) {
  const detail = error instanceof Error ? error.message : String(error);
  return new Error(`Could not load ${label}: ${detail}`);
}

function createManager(onAssetError) {
  const manager = new LoadingManager();
  manager.onError = (url) => onAssetError?.(url);
  return manager;
}

async function loadByUrl(url, extension, manager) {
  if (extension === '3ds') return new TDSLoader(manager).loadAsync(url);
  if (extension === 'obj') return new OBJLoader(manager).loadAsync(url);
  if (extension === 'glb' || extension === 'gltf') {
    const gltf = await new GLTFLoader(manager).loadAsync(url);
    return gltf.scene;
  }
  throw new Error(`Unsupported model extension: .${extension}`);
}

export async function loadBuiltInModel(id, onAssetError) {
  const preset = PRESETS[id];
  if (!preset) throw new Error(`Unknown model preset: ${id}`);

  try {
    const model = await loadByUrl(
      preset.url,
      preset.extension,
      createManager(onAssetError),
    );
    return { model, label: preset.label };
  } catch (error) {
    throw loaderError(error, preset.label);
  }
}

export async function loadLocalModel(file, onAssetError) {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!extension || !['3ds', 'obj', 'glb', 'gltf'].includes(extension)) {
    throw new Error('Supported model formats are .3ds, .obj, .glb, and self-contained .gltf.');
  }

  const manager = createManager(onAssetError);
  const url = URL.createObjectURL(file);

  try {
    const model = await loadByUrl(url, extension, manager);
    return { model, label: file.name };
  } catch (error) {
    throw loaderError(error, file.name);
  } finally {
    URL.revokeObjectURL(url);
  }
}
