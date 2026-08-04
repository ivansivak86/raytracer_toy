import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

const RAY_COLORS = {
  primary: new THREE.Color('#5de1ff'),
  shadow: new THREE.Color('#ffc85b'),
  blocked: new THREE.Color('#ff5c74'),
  reflection: new THREE.Color('#f18cff'),
  refraction: new THREE.Color('#748cff'),
  normal: new THREE.Color('#7cf5a5'),
};

function createLineLayer(opacity) {
  const geometry = new THREE.BufferGeometry();
  const material = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const line = new THREE.LineSegments(geometry, material);
  line.frustumCulled = false;
  line.renderOrder = 50;
  return line;
}

function createWideLineLayer(linewidth, opacity) {
  const geometry = new LineSegmentsGeometry();
  const material = new LineMaterial({
    color: 0xffffff,
    vertexColors: true,
    linewidth,
    worldUnits: false,
    transparent: true,
    opacity,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const line = new LineSegments2(geometry, material);
  line.frustumCulled = false;
  line.renderOrder = 55;
  line.visible = false;
  return line;
}

function createPointLayer(size, opacity) {
  const geometry = new THREE.BufferGeometry();
  const material = new THREE.PointsMaterial({
    size,
    vertexColors: true,
    transparent: true,
    opacity,
    depthTest: false,
    depthWrite: false,
    sizeAttenuation: true,
    toneMapped: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 51;
  return points;
}

function isSelectableMesh(object, root) {
  return Boolean(
    object?.isMesh
    && object.visible !== false
    && object.userData.raytrace !== false
    && root
    && (object === root || root.getObjectByProperty('uuid', object.uuid)),
  );
}

export class PreviewRenderer {
  constructor(container, onCameraChange) {
    this.container = container;
    this.onCameraChange = onCameraChange;
    this.onSelectionChange = null;
    this.onObjectChange = null;
    this.editorEnabled = true;
    this.selectedObject = null;
    this.currentRoot = null;
    this.pickStart = null;
    this.ignorePickUntil = 0;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#000000');

    this.camera = new THREE.PerspectiveCamera(65.47, 4 / 3, 0.01, 500);
    this.camera.position.set(1.5, 1.5, 1.5);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.tabIndex = 0;
    container.append(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.075;
    this.controls.screenSpacePanning = true;
    this.controls.minDistance = 0.18;
    this.controls.maxDistance = 100;
    this.controls.addEventListener('change', () => this.onCameraChange?.());

    this.worldLayer = new THREE.Group();
    this.worldLayer.name = 'Ray-traced world';
    this.scene.add(this.worldLayer);

    this.lightLayer = new THREE.Group();
    this.lightLayer.name = 'Preview lighting';
    this.scene.add(this.lightLayer);

    this.rayLayer = new THREE.Group();
    this.rayLayer.name = 'Ray paths';
    this.renderLine = createLineLayer(0.5);
    this.inspectLine = createWideLineLayer(5, 1);
    this.renderPoints = createPointLayer(0.035, 0.65);
    this.inspectPoints = createPointLayer(0.055, 1);
    this.rayLayer.add(this.renderLine, this.inspectLine, this.renderPoints, this.inspectPoints);
    this.scene.add(this.rayLayer);

    this.selectionHelper = new THREE.BoxHelper(undefined, 0xffff00);
    this.selectionHelper.name = 'Selected object bounds';
    this.selectionHelper.visible = false;
    this.selectionHelper.material.depthTest = false;
    this.selectionHelper.material.depthWrite = false;
    this.selectionHelper.material.toneMapped = false;
    this.selectionHelper.renderOrder = 62;
    this.scene.add(this.selectionHelper);

    this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
    this.transformControls.setMode('translate');
    this.transformControls.setSpace('world');
    this.transformControls.setSize(0.82);
    this.transformHelper = this.transformControls.getHelper();
    this.transformHelper.name = 'Object transform manipulator';
    this.transformHelper.visible = false;
    this.scene.add(this.transformHelper);

    this.transformControls.addEventListener('mouseDown', () => {
      this.controls.enabled = false;
      this.ignorePickUntil = Number.POSITIVE_INFINITY;
    });
    this.transformControls.addEventListener('mouseUp', () => {
      this.controls.enabled = this.editorEnabled;
      this.ignorePickUntil = performance.now() + 90;
    });
    this.transformControls.addEventListener('objectChange', () => {
      this.refreshSelectionHelper();
      this.onObjectChange?.(this.selectedObject);
    });

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.handlePointerDown = (event) => {
      if (!this.editorEnabled || event.button !== 0) return;
      this.pickStart = { x: event.clientX, y: event.clientY };
    };
    this.handlePointerUp = (event) => {
      if (!this.editorEnabled || event.button !== 0 || !this.pickStart) return;
      const travel = Math.hypot(event.clientX - this.pickStart.x, event.clientY - this.pickStart.y);
      this.pickStart = null;
      if (travel > 5 || performance.now() < this.ignorePickUntil || this.transformControls.dragging) return;
      this.pickObjectAt(event.clientX, event.clientY);
    };
    this.handlePointerCancel = () => {
      this.pickStart = null;
    };
    this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDown);
    this.renderer.domElement.addEventListener('pointerup', this.handlePointerUp);
    this.renderer.domElement.addEventListener('pointercancel', this.handlePointerCancel);

    this.renderSegments = [];
    this.inspectSegments = [];
    this.renderRaysVisible = true;
    this.maxRenderSegments = 1400;

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.animate();
  }

  setEditorCallbacks({ onSelectionChange, onObjectChange } = {}) {
    this.onSelectionChange = onSelectionChange ?? null;
    this.onObjectChange = onObjectChange ?? null;
  }

  setWorld(root) {
    this.clearSelection();
    this.worldLayer.clear();
    this.worldLayer.add(root);
    this.currentRoot = root;
    this.configureLighting(root.userData.sceneDefinition);
    this.resetCamera();
    this.clearRays();
  }

  configureLighting(definition = {}) {
    this.lightLayer.clear();
    const target = new THREE.Vector3().fromArray(definition.camera?.target ?? [0, 0, 0]);
    const lightDefinition = definition.lights?.[0] ?? {
      position: [7, 10, 6],
      color: [1, 1, 1],
    };
    const lightPosition = new THREE.Vector3().fromArray(lightDefinition.position);
    const lightDirection = lightPosition.clone().sub(target).normalize();

    const hemisphere = new THREE.HemisphereLight(0xb7c9ff, 0x151018, 1.05);
    this.lightLayer.add(hemisphere);

    const directional = new THREE.DirectionalLight(
      new THREE.Color().fromArray(lightDefinition.color ?? [1, 1, 1]),
      3.2,
    );
    directional.position.copy(target).addScaledVector(lightDirection, 10);
    directional.target.position.copy(target);
    directional.castShadow = true;
    directional.shadow.mapSize.set(1024, 1024);
    directional.shadow.camera.near = 0.1;
    directional.shadow.camera.far = 40;
    directional.shadow.camera.left = -7;
    directional.shadow.camera.right = 7;
    directional.shadow.camera.top = 7;
    directional.shadow.camera.bottom = -7;
    directional.shadow.bias = -0.0003;
    this.lightLayer.add(directional, directional.target);

    const gizmoPosition = target.clone().addScaledVector(lightDirection, 4.2);
    const gizmo = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xffe1a3, toneMapped: false }),
    );
    gizmo.position.copy(gizmoPosition);
    gizmo.userData.raytrace = false;
    this.lightLayer.add(gizmo);

    const stemGeometry = new THREE.BufferGeometry().setFromPoints([
      target,
      gizmoPosition,
    ]);
    const stem = new THREE.Line(
      stemGeometry,
      new THREE.LineDashedMaterial({ color: 0xffca78, dashSize: 0.12, gapSize: 0.08, opacity: 0.38, transparent: true }),
    );
    stem.computeLineDistances();
    stem.userData.raytrace = false;
    this.lightLayer.add(stem);
  }

  resetCamera() {
    const definition = this.currentRoot?.userData.sceneDefinition;
    if (!definition?.camera) return;
    this.camera.position.fromArray(definition.camera.position);
    this.camera.up.fromArray(definition.camera.up ?? [0, 1, 0]);
    this.camera.far = definition.camera.far ?? 250;
    this.camera.fov = 65.47;
    this.camera.updateProjectionMatrix();
    this.controls.target.fromArray(definition.camera.target ?? [0, 0, 0]);
    this.controls.update();
  }

  getCameraSnapshot() {
    this.camera.updateMatrixWorld(true);
    const matrix = this.camera.matrixWorld;
    const right = new THREE.Vector3().setFromMatrixColumn(matrix, 0).normalize();
    const up = new THREE.Vector3().setFromMatrixColumn(matrix, 1).normalize();
    const forward = new THREE.Vector3().setFromMatrixColumn(matrix, 2).negate().normalize();

    return {
      origin: this.camera.position.toArray(),
      target: this.controls.target.toArray(),
      right: right.toArray(),
      up: up.toArray(),
      forward: forward.toArray(),
      verticalFov: THREE.MathUtils.degToRad(this.camera.fov),
      far: this.camera.far,
    };
  }

  pickObjectAt(clientX, clientY) {
    if (!this.currentRoot) return;
    const bounds = this.renderer.domElement.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    this.pointer.x = ((clientX - bounds.left) / bounds.width) * 2 - 1;
    this.pointer.y = -((clientY - bounds.top) / bounds.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersections = this.raycaster.intersectObject(this.currentRoot, true);
    const match = intersections.find((entry) => isSelectableMesh(entry.object, this.currentRoot));
    this.selectObject(match?.object ?? null);
  }

  selectObject(object, { notify = true } = {}) {
    const selectable = isSelectableMesh(object, this.currentRoot) ? object : null;
    if (this.selectedObject === selectable) {
      this.refreshSelectionHelper();
      return;
    }

    this.transformControls.detach();
    this.selectedObject = selectable;
    if (selectable) {
      this.transformControls.attach(selectable);
      this.selectionHelper.setFromObject(selectable);
      this.selectionHelper.visible = true;
    } else {
      this.selectionHelper.visible = false;
    }
    if (notify) this.onSelectionChange?.(selectable);
  }

  clearSelection({ notify = true } = {}) {
    this.selectObject(null, { notify });
  }

  getSelectedObject() {
    return this.selectedObject;
  }

  refreshSelectionHelper() {
    if (!this.selectedObject) {
      this.selectionHelper.visible = false;
      return;
    }
    this.selectionHelper.setFromObject(this.selectedObject);
    this.selectionHelper.visible = true;
  }

  setTransformMode(mode) {
    if (!['translate', 'rotate', 'scale'].includes(mode)) return;
    this.transformControls.setMode(mode);
  }

  getTransformMode() {
    return this.transformControls.getMode();
  }

  setTransformSpace(space) {
    this.transformControls.setSpace(space === 'local' ? 'local' : 'world');
  }

  getTransformSpace() {
    return this.transformControls.space;
  }

  setEditorEnabled(enabled) {
    this.editorEnabled = Boolean(enabled);
    this.transformControls.enabled = this.editorEnabled;
    this.controls.enabled = this.editorEnabled;
    this.transformHelper.visible = this.editorEnabled && Boolean(this.selectedObject);
  }

  addRenderSegments(segments) {
    if (!segments?.length) return;
    const room = Math.max(0, this.maxRenderSegments - this.renderSegments.length);
    if (!room) return;
    this.renderSegments.push(...segments.slice(0, room));
    this.rebuildLayer(this.renderLine, this.renderPoints, this.renderSegments);
    this.updateRayVisibility();
  }

  setInspectorSegments(segments) {
    this.inspectSegments = segments ?? [];
    this.rebuildLayer(this.inspectLine, this.inspectPoints, this.inspectSegments);
    this.updateRayVisibility();
  }

  rebuildLayer(line, points, segments) {
    const linePositions = new Float32Array(segments.length * 6);
    const lineColors = new Float32Array(segments.length * 6);
    const pointPositions = [];
    const pointColors = [];

    segments.forEach((segment, index) => {
      const offset = index * 6;
      linePositions.set(segment.from, offset);
      linePositions.set(segment.to, offset + 3);
      const color = RAY_COLORS[segment.blocked ? 'blocked' : segment.type] ?? RAY_COLORS.primary;
      lineColors.set(color.toArray(), offset);
      lineColors.set(color.toArray(), offset + 3);

      if (segment.hit && segment.type !== 'normal') {
        pointPositions.push(...segment.to);
        pointColors.push(...color.toArray());
      }
    });

    line.geometry.dispose();
    if (line.isLineSegments2) {
      const geometry = new LineSegmentsGeometry();
      if (segments.length) {
        geometry.setPositions(linePositions);
        geometry.setColors(lineColors);
      }
      line.geometry = geometry;
    } else {
      line.geometry = new THREE.BufferGeometry();
      line.geometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
      line.geometry.setAttribute('color', new THREE.BufferAttribute(lineColors, 3));
    }

    points.geometry.dispose();
    points.geometry = new THREE.BufferGeometry();
    points.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pointPositions, 3));
    points.geometry.setAttribute('color', new THREE.Float32BufferAttribute(pointColors, 3));
  }

  updateRayVisibility() {
    this.renderLine.visible = this.renderRaysVisible && this.renderSegments.length > 0;
    this.renderPoints.visible = this.renderRaysVisible && this.renderSegments.length > 0;
    this.inspectLine.visible = this.inspectSegments.length > 0;
    this.inspectPoints.visible = this.inspectSegments.length > 0;
  }

  clearRenderRays() {
    this.renderSegments = [];
    this.rebuildLayer(this.renderLine, this.renderPoints, []);
    this.updateRayVisibility();
  }

  clearInspectorRays() {
    this.inspectSegments = [];
    this.rebuildLayer(this.inspectLine, this.inspectPoints, []);
    this.updateRayVisibility();
  }

  clearRays() {
    this.clearRenderRays();
    this.clearInspectorRays();
  }

  setRenderRaysVisible(visible) {
    this.renderRaysVisible = Boolean(visible);
    this.updateRayVisibility();
  }

  setRaysVisible(visible) {
    this.setRenderRaysVisible(visible);
  }

  hasRenderRays() {
    return this.renderSegments.length > 0;
  }

  hasInspectorRays() {
    return this.inspectSegments.length > 0;
  }

  hasAnyRays() {
    return this.hasRenderRays() || this.hasInspectorRays();
  }

  resize() {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    if (this.inspectLine.material?.resolution) this.inspectLine.material.resolution.set(width, height);
  }

  animate = () => {
    this.animationFrame = requestAnimationFrame(this.animate);
    this.controls.update();
    if (this.selectedObject) this.selectionHelper.setFromObject(this.selectedObject);
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver.disconnect();
    this.renderer.domElement.removeEventListener('pointerdown', this.handlePointerDown);
    this.renderer.domElement.removeEventListener('pointerup', this.handlePointerUp);
    this.renderer.domElement.removeEventListener('pointercancel', this.handlePointerCancel);
    this.transformControls.detach();
    this.transformControls.dispose();
    this.controls.dispose();
    this.selectionHelper.geometry.dispose();
    this.selectionHelper.material.dispose();
    for (const layer of [this.renderLine, this.inspectLine, this.renderPoints, this.inspectPoints]) {
      layer.geometry?.dispose?.();
      layer.material?.dispose?.();
    }
    this.renderer.dispose();
  }
}
