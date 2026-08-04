# Architecture

## Design goal

The primary constraint is historical fidelity: Three.js provides the interactive scene, selection, camera, and transform tools, while a custom CPU ray tracer remains responsible for the final pixels.

The application therefore has one editable scene graph and two rendering paths. The editor mutates that shared graph; the WebGL path previews it immediately; the CPU path compiles a point-in-time snapshot whenever the user starts a trace.

## System data flow

```text
Legacy definition or loaded model
              │
              ▼
       Three.js Object3D root
              ▲
              │
       SceneEditor mutations
  selection / transform / material / texture
              │
       ┌──────┴───────────┐
       │                  │
       ▼                  ▼
WebGL preview        serializeScene()
OrbitControls             │
TransformControls         ▼
selection/rays     transferable typed arrays
                              │
                              ▼
                       module Web Worker
                              │
                       build triangle BVH
                              │
                    center-out tile traversal
                              │
          ┌───────────────────┼──────────────────┐
          ▼                   ▼                  ▼
       RGBA tile          statistics         sampled paths
          │                   │                  │
          ▼                   ▼                  ▼
      2D canvas           dashboard          3D overlays
```

The Windows 98 shell is a presentation layer only. `98.css` styles semantic HTML controls; application-specific CSS handles the editor grid, canvases, responsive layout, compact DCC toolbar, and floating windows. `DesktopUi` converts the semantic menu and dialog markup into commands, keyboard navigation, checked/disabled state, z-order, dragging, and analysis-tab behavior.

## Desktop shell

### `layout.js`

`layout.js` emits the semantic workstation structure: five application menus, the compact object toolbar, render controls, two viewport windows, modeless Material Editor and Render Analysis windows, the Modernized-renderer information window, and About. It contains no command business logic.

### `DesktopUi.js`

`DesktopUi` is the shell controller. It owns:

- menu opening, pointer switching, arrow navigation, and command dispatch
- command disabled and checked states
- application shortcuts and Escape precedence
- modeless-window opening, closing, z-order, centering, and title-bar dragging
- Render Analysis tab state and keyboard traversal

`main.js` supplies the command map, so the shell never imports Three.js, the Worker client, or scene code. Menus and toolbar buttons therefore invoke the same application functions rather than maintaining parallel implementations.

## Scene layer

### `legacyScene.js`

Contains a neutral description of the original Delphi form scene: object type, transform, primitive parameters, material parameters, camera, and light. It has no Three.js dependency, allowing historical inventory and color rules to be tested directly in Node.js.

### `sceneFactory.js`

Builds Three.js geometry and preview materials from the neutral definition. It also normalizes imported models and adds a ray-traceable ground plane.

Every authored ray-traceable mesh carries compact metadata:

```js
mesh.userData.rayObject
mesh.userData.rayMaterial
```

Imported meshes without explicit ray metadata derive a ray material from their Three.js material during serialization. Editor changes create an explicit `rayMaterial` record so preview appearance and CPU shading can remain synchronized.

### Scene ownership and disposal

A newly installed scene becomes the sole active world root. The old root is disposed only after the preview and editor have detached from it. Geometry, editor-owned materials, original materials, textures, and object URLs are tracked to avoid leaking resources when scenes change.

## Editor layer

### `SceneEditor.js`

`SceneEditor` bridges semantic controls and the Three.js viewport. It owns:

- the list of selectable ray-traceable meshes
- the current selection
- authored transform snapshots
- authored material snapshots
- numeric transform controls
- mesh-level ray-material controls
- uploaded texture object URLs
- reset behavior
- W/E/R/Q/Escape keyboard shortcuts

It does not maintain a duplicate neutral scene. Transform changes mutate the selected `Object3D`; material changes update `mesh.userData.rayMaterial` and editor-owned preview material clones.

### Selection and manipulators

`PreviewRenderer` performs recursive ray picking against the active world root. A selected mesh receives:

- a depth-independent yellow `BoxHelper`
- Three.js `TransformControls`
- synchronized numeric position, rotation, and scale fields

Orbit controls are disabled while a transform handle is dragged. The renderer suppresses click selection after a gizmo drag so releasing a handle cannot accidentally select geometry behind it.

Transform space can be world or local. Numeric transforms use the selected object's local coordinates, matching the scene graph representation that is later resolved to world space by the serializer.

### Basic material state

The editable ray material is deliberately small and renderer-oriented:

```js
{
  color,
  legacyReflectivity,
  reflectivity,
  transmission,
  ior,
  roughness,
  shininess,
  specularStrength,
  glass
}
```

A `MeshPhysicalMaterial` clone supplies a coherent preview for those values. On reset, editor-owned preview materials are disposed and the original Three.js material reference is restored.

For imported multi-material meshes, the editor applies one coherent mesh-level ray-material policy while retaining the original material slots for reset. Per-face material authoring is intentionally outside this version's scope.

### Texture state

An uploaded texture is stored in `mesh.userData.rayTexture`; explicitly setting it to `null` means “remove the inherited texture.” Its object URL and ownership flag are tracked separately so replacement, reset, scene change, and application disposal can revoke resources safely.

The preview uses Three.js texture sampling. The CPU path receives a serialized copy only when the browser can read the source pixels.

## `serializeScene()` compilation

At render start, the serializer:

1. Updates all world matrices.
2. Traverses visible ray-traceable meshes.
3. Converts indexed or non-indexed geometry into independent world-space triangles.
4. Transforms normals with each mesh's normal matrix.
5. Preserves geometry groups and material assignments.
6. Interpolates or supplies one UV triplet per triangle.
7. Associates every triangle with object and material indexes.
8. Serializes readable color textures once per texture UUID.
9. Computes world bounds.
10. Captures the current interactive camera basis.
11. Returns transferable typed arrays and compact metadata.

### Geometry payload

```text
positions             Float32Array · 9 values per triangle
normals               Float32Array · 9 values per triangle
uvs                   Float32Array · 6 values per triangle
triangleHasUvs        Uint8Array   · 1 flag per triangle
triangleMaterials     Uint32Array  · material index per triangle
triangleObjects       Uint32Array  · object index per triangle
```

### Texture payload

Each readable texture includes:

```text
name
width / height
RGBA Uint8ClampedArray
3×3 UV transform matrix
wrapS / wrapT
flipY
sRGB flag
```

The serializer accepts direct typed image data or performs a single canvas readback for browser image elements. A missing, incomplete, or security-restricted image produces a warning and a `textureIndex` of `-1`; geometry and base-color rendering continue.

The arrays and texture pixel buffers are transferred—not cloned—so large imported meshes do not incur an avoidable structured-clone copy.

## Preview path

`PreviewRenderer` owns:

- Three.js scene, camera, and renderer
- `OrbitControls`
- `TransformControls`
- recursive object picking
- selected-object bounds
- preview-only hemisphere and directional lights
- the visible light-direction gizmo
- representative render rays
- high-emphasis pixel-inspector rays

Representative paths use lightweight `THREE.LineSegments`. The microscope path uses a separate `LineSegments2` / `LineMaterial` layer with a five-pixel screen-space width. Both are depth-test-disabled so the optical structure remains legible through geometry, but their visibility is independent. Hiding sampled paths never hides or destroys the selected pixel path.

The preview lighting is intentionally aesthetic. The CPU tracer receives the exact light definition stored with the scene and does not sample the WebGL framebuffer.

## Worker protocol

`RenderClient` and `raytracer.worker.js` exchange these message types.

### Main thread → Worker

```text
render   serialized scene + render configuration
cancel   active job ID
inspect  pixel coordinate + request ID
```

### Worker → main thread

```text
started        triangle/BVH/material/object metadata
tile           RGBA tile + progress + stats + sampled paths
done           final timing and stats
cancelled      cooperative cancellation acknowledgement
error          render failure
inspect-result full pixel tree and path segments
inspect-error  inspection failure
```

Job IDs prevent stale messages from an older render from mutating the current interface.

## Progressive scheduling

The image is divided into tiles, normally 32 × 32 pixels. Tiles are sorted by squared distance from the image center. The user therefore sees the main composition emerge early instead of waiting for a top-to-bottom scanline sweep.

The Worker yields to its event loop every second tile. This makes cancellation messages observable between batches without imposing per-pixel messaging overhead.

## BVH

`bvh.js` constructs a binary hierarchy over triangle axis-aligned bounds:

1. Compute each triangle's bounds and centroid.
2. Find the longest centroid-bounds axis for a node.
3. Sort that node range by the chosen centroid component.
4. Split at the median.
5. Stop at the configured leaf size or a nearly zero centroid extent.

Traversal uses a reusable integer stack. Child nodes are pushed far-first so the nearer node is popped and tested first. The current closest distance tightens both AABB and triangle tests.

The triangle kernel is two-sided Möller–Trumbore, matching the double-sided treatment of reflective and imported geometry.

## Tracer

The tracer is recursive but allocation-conscious:

- reusable hit records by depth
- reusable shadow hit records by depth
- one depth-indexed color stack
- numeric vectors inside hot loops
- optional path objects only for sampled or inspected rays
- bilinear texture sampling directly from transferred RGBA buffers

A primary call can create:

- one shadow ray per light at every surface hit
- one reflected child
- one refracted child

The maximum recursive depth is a user control. Shadow rays are counted in total-ray telemetry but are not part of the recursion-depth histogram.

### Texture interpolation

Triangle UVs are barycentrically interpolated at the nearest hit. The sampler then applies the serialized Three.js UV matrix, wrap mode, and vertical orientation. Modernized mode converts sRGB texture samples into linear light before shading. Original mode remains color-space-naive by design.

### Modern glass

Transmission uses Snell's law with explicit entering/exiting handling. Schlick's approximation controls the reflected fraction. When no refracted vector exists, the transmission share is redirected into reflection to represent total internal reflection.

## Representative path capture

Recording every ray would overwhelm memory and the WebGL line layer. The Worker instead chooses a deterministic sparse sample of output pixels using an integer hash. Each tile returns a bounded number of segments, and the preview retains a global maximum.

Pixel inspection is different: clicking the output first clears the previous microscope overlay and hides the representative render layer without deleting it. The retained tracer then recomputes exactly one ray path with a complete tree, normals, light records, texture name and UV, local colors, final colors, and all recursive branches. The result is drawn in the separate wide-line layer. Representative samples continue to be retained while hidden and can be restored from the Pixel Microscope tab.

## Stale-render semantics

A completed image represents an immutable snapshot. Camera motion, object transformation, material changes, texture changes, and render-mode changes mark it stale. Starting another render creates and transfers a fresh scene payload.

Editor controls are disabled during active rendering. This avoids presenting a preview mutation as though it affected an already-running Worker job.

## Cancellation and retained state

Cancellation is cooperative at tile boundaries. A partial image remains visible and can still be saved. The Worker retains the tracer associated with the current job so pixel inspection can operate during or after rendering without rebuilding the BVH.

## Test strategy

The core tracer and BVH do not import Three.js. Node's built-in test runner can therefore validate the computational heart without a browser or package installation.

The suite validates:

- numerical BVH behavior
- historical scene invariants
- original-versus-modern shadow semantics
- reflection and refraction recursion
- UV orientation and bilinear sampling
- textured CPU shading
- source sanitization
- layout and feature-wiring contracts
- menu commands, exact GitHub link, compact toolbar, dialogs, and analysis tabs
- ray-isolation ordering and independent sampled/inspector overlays

A dependency-free headless-Chromium harness additionally exercises the shell controller against the actual generated markup and project CSS: menu dispatch, GitHub destination, dialog opening and dragging, analysis tabs, and Escape closing order. Full browser checks after installing dependencies remain appropriate because WebGL, file loaders, transform controls, Workers, and canvas image security depend on the host browser.

## Natural next extensions

The architecture leaves clear seams for future work:

- undo/redo and serialized scene edits
- independent per-material-slot editing
- editable point and area lights
- normal-map and alpha-map sampling in the CPU tracer
- mipmapping or texture-resolution caps
- SAH-based BVH construction
- Worker pool or tiled parallelism
- soft shadows and depth of field
- side-by-side original/modern difference visualization
- WebAssembly kernels while retaining the Worker protocol

None requires replacing the historical rendering model or the Windows 98 shell.
