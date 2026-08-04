const GITHUB_URL = 'https://github.com/ivansivak86/raytracer_delphi_threejs';

function menuItem(command, label, shortcut = '', options = {}) {
  const { disabled = false, checkable = false } = options;
  return `
    <button
      type="button"
      class="menu-item"
      role="menuitem"
      data-command="${command}"
      ${disabled ? 'disabled' : ''}
      ${checkable ? 'data-checkable="true" data-checked="false"' : ''}
    >
      <span class="menu-check" aria-hidden="true">✓</span>
      <span class="menu-label">${label}</span>
      <span class="menu-shortcut">${shortcut}</span>
    </button>
  `;
}

function menuSeparator() {
  return '<div class="menu-separator" role="separator"></div>';
}

function mainMenuMarkup() {
  return `
    <nav class="menu-bar" id="main-menu-bar" aria-label="Application menu">
      <div class="menu-root">
        <button type="button" class="menu-button" data-menu-button="file" aria-haspopup="true" aria-expanded="false"><u>F</u>ile</button>
        <div class="window menu-popup hidden" data-menu-popup="file" role="menu" aria-label="File menu">
          ${menuItem('load-model', 'Load model...', 'Ctrl+O')}
          ${menuItem('save-image', 'Save rendered image...', 'Ctrl+S')}
          ${menuSeparator()}
          ${menuItem('reload-scene', 'Reload current scene', 'F5')}
          ${menuSeparator()}
          ${menuItem('exit-web-app', 'Exit', '', { disabled: true })}
        </div>
      </div>

      <div class="menu-root">
        <button type="button" class="menu-button" data-menu-button="edit" aria-haspopup="true" aria-expanded="false"><u>E</u>dit</button>
        <div class="window menu-popup hidden" data-menu-popup="edit" role="menu" aria-label="Edit menu">
          ${menuItem('transform-translate', 'Move', 'W', { checkable: true })}
          ${menuItem('transform-rotate', 'Rotate', 'E', { checkable: true })}
          ${menuItem('transform-scale', 'Scale', 'R', { checkable: true })}
          ${menuSeparator()}
          ${menuItem('reset-transform', 'Reset selected transform')}
          ${menuItem('deselect-object', 'Deselect object', 'Esc')}
          ${menuSeparator()}
          ${menuItem('open-material-editor', 'Material Editor...', 'M')}
        </div>
      </div>

      <div class="menu-root">
        <button type="button" class="menu-button" data-menu-button="view" aria-haspopup="true" aria-expanded="false"><u>V</u>iew</button>
        <div class="window menu-popup hidden" data-menu-popup="view" role="menu" aria-label="View menu">
          ${menuItem('open-material-editor', 'Material Editor...', 'M')}
          ${menuItem('open-analysis-summary', 'Render Statistics...', 'F9')}
          ${menuItem('open-analysis-rays', 'Ray Telemetry...')}
          ${menuItem('open-analysis-intersections', 'Intersection Distribution...')}
          ${menuItem('open-analysis-pixel', 'Pixel Microscope...')}
          ${menuSeparator()}
          ${menuItem('toggle-sampled-rays', 'Show sampled render rays', '', { checkable: true })}
          ${menuItem('clear-ray-paths', 'Clear all ray paths')}
          ${menuSeparator()}
          ${menuItem('reset-camera', 'Reset camera', 'Home')}
        </div>
      </div>

      <div class="menu-root">
        <button type="button" class="menu-button" data-menu-button="render" aria-haspopup="true" aria-expanded="false"><u>R</u>ender</button>
        <div class="window menu-popup hidden" data-menu-popup="render" role="menu" aria-label="Render menu">
          ${menuItem('trace-scene', 'Trace scene', 'F10')}
          ${menuItem('cancel-render', 'Cancel render', 'Esc')}
          ${menuSeparator()}
          ${menuItem('algorithm-original', 'Original algorithm', '', { checkable: true })}
          ${menuItem('algorithm-modern', 'Modernized algorithm', '', { checkable: true })}
          ${menuItem('show-modern-info', 'Modernized algorithm details...')}
        </div>
      </div>

      <div class="menu-root">
        <button type="button" class="menu-button" data-menu-button="help" aria-haspopup="true" aria-expanded="false"><u>H</u>elp</button>
        <div class="window menu-popup menu-popup-right hidden" data-menu-popup="help" role="menu" aria-label="Help menu">
          ${menuItem('show-modern-info', 'Modernized renderer...')}
          <a class="menu-item" role="menuitem" href="${GITHUB_URL}" target="_blank" rel="noopener noreferrer">
            <span class="menu-check" aria-hidden="true"></span>
            <span class="menu-label">GitHub repository</span>
            <span class="menu-shortcut">↗</span>
          </a>
          ${menuSeparator()}
          ${menuItem('show-about', 'About My Render...')}
        </div>
      </div>

      <span class="menu-spacer"></span>
      <span class="era-caption">Delphi + GLScene, circa 2003 → JavaScript + Three.js</span>
    </nav>
  `;
}

function objectToolbarMarkup() {
  return `
    <section class="max-toolbar" aria-label="Object transformation toolbar">
      <div class="toolbar-grip" aria-hidden="true"></div>

      <div class="max-toolbar-group toolbar-selection-group">
        <label class="toolbar-caption" for="object-select">Object:</label>
        <select id="object-select" title="Select a scene object">
          <option value="">(none)</option>
        </select>
        <button id="deselect-object-button" class="square-tool-button" type="button" title="Deselect object (Esc)" disabled aria-label="Deselect object">×</button>
      </div>

      <div class="toolbar-divider" aria-hidden="true"></div>

      <div class="max-toolbar-group transform-mode-group" role="toolbar" aria-label="Transform mode">
        <button id="transform-translate-button" class="square-tool-button default" type="button" title="Move selected object (W)" aria-label="Move selected object" aria-pressed="true"><span class="tool-glyph move-glyph" aria-hidden="true">↔</span></button>
        <button id="transform-rotate-button" class="square-tool-button" type="button" title="Rotate selected object (E)" aria-label="Rotate selected object" aria-pressed="false"><span class="tool-glyph rotate-glyph" aria-hidden="true">↻</span></button>
        <button id="transform-scale-button" class="square-tool-button" type="button" title="Scale selected object (R)" aria-label="Scale selected object" aria-pressed="false"><span class="tool-glyph scale-glyph" aria-hidden="true">□</span></button>
        <label class="toolbar-caption" for="transform-space-select">Space:</label>
        <select id="transform-space-select" title="Transformation coordinate system">
          <option value="world" selected>World</option>
          <option value="local">Local</option>
        </select>
      </div>

      <div class="toolbar-divider" aria-hidden="true"></div>

      <div class="max-toolbar-group transform-vector-group" aria-label="Position">
        <span class="toolbar-vector-title">Pos</span>
        <label class="axis-field x-axis" for="transform-position-x"><b>X</b><input class="transform-input" id="transform-position-x" type="number" step="0.01" disabled /></label>
        <label class="axis-field y-axis" for="transform-position-y"><b>Y</b><input class="transform-input" id="transform-position-y" type="number" step="0.01" disabled /></label>
        <label class="axis-field z-axis" for="transform-position-z"><b>Z</b><input class="transform-input" id="transform-position-z" type="number" step="0.01" disabled /></label>
      </div>

      <div class="toolbar-divider" aria-hidden="true"></div>

      <div class="max-toolbar-group transform-vector-group" aria-label="Rotation">
        <span class="toolbar-vector-title">Rot°</span>
        <label class="axis-field x-axis" for="transform-rotation-x"><b>X</b><input class="transform-input" id="transform-rotation-x" type="number" step="1" disabled /></label>
        <label class="axis-field y-axis" for="transform-rotation-y"><b>Y</b><input class="transform-input" id="transform-rotation-y" type="number" step="1" disabled /></label>
        <label class="axis-field z-axis" for="transform-rotation-z"><b>Z</b><input class="transform-input" id="transform-rotation-z" type="number" step="1" disabled /></label>
      </div>

      <div class="toolbar-divider" aria-hidden="true"></div>

      <div class="max-toolbar-group transform-vector-group" aria-label="Scale">
        <span class="toolbar-vector-title">Scale</span>
        <label class="axis-field x-axis" for="transform-scale-x"><b>X</b><input class="transform-input" id="transform-scale-x" type="number" min="0.001" step="0.05" disabled /></label>
        <label class="axis-field y-axis" for="transform-scale-y"><b>Y</b><input class="transform-input" id="transform-scale-y" type="number" min="0.001" step="0.05" disabled /></label>
        <label class="axis-field z-axis" for="transform-scale-z"><b>Z</b><input class="transform-input" id="transform-scale-z" type="number" min="0.001" step="0.05" disabled /></label>
      </div>

      <div class="toolbar-divider" aria-hidden="true"></div>

      <div class="max-toolbar-group toolbar-action-group" role="toolbar" aria-label="Object tools">
        <button id="transform-reset-button" class="square-tool-button" type="button" title="Reset selected object's transform" disabled aria-label="Reset transform"><span class="tool-glyph" aria-hidden="true">⟲</span></button>
        <button id="open-material-editor-button" class="square-tool-button material-tool-button" type="button" title="Open Material Editor (M)" aria-label="Open Material Editor"><span class="material-sphere-icon" aria-hidden="true"></span></button>
        <button id="open-analysis-button" class="square-tool-button analysis-tool-button" type="button" title="Open Render Analysis (F9)" aria-label="Open Render Analysis"><span class="analysis-bars-icon" aria-hidden="true"><i></i><i></i><i></i></span></button>
      </div>

      <p class="toolbar-selection-status status-field-border" id="selected-object-caption">Click a mesh in the preview or choose one from the list.</p>
    </section>
  `;
}

function controlDeckMarkup() {
  return `
    <section class="control-deck" aria-label="Render controls">
      <fieldset class="scene-control-group">
        <legend>Scene</legend>
        <div class="field-row-stacked">
          <label for="scene-select">Scene preset:</label>
          <select id="scene-select">
            <option value="legacy">Original GLScene composition</option>
            <option value="werewolf">Werewolf head - bundled .3ds</option>
            <option value="pickup">Pickup truck - bundled .3ds</option>
          </select>
        </div>
        <div class="field-row toolbar-row">
          <button id="load-model-button" title="Load a local 3D model">Load model...</button>
          <input id="model-file-input" type="file" accept=".3ds,.obj,.glb,.gltf" hidden />
          <button id="reset-camera-button" title="Restore the scene's default camera">Reset camera</button>
        </div>
      </fieldset>

      <fieldset class="algorithm-control-group">
        <legend>Ray-tracing algorithm</legend>
        <div class="algorithm-options">
          <div class="field-row">
            <input type="radio" name="mode" id="mode-legacy" value="legacy" checked />
            <label for="mode-legacy">Original</label>
          </div>
          <div class="field-row modern-option-row">
            <input type="radio" name="mode" id="mode-modern" value="modern" />
            <label for="mode-modern">Modernized</label>
            <button
              type="button"
              class="help-button"
              id="modern-info-button"
              aria-label="Explain the modernized algorithm"
              aria-haspopup="dialog"
              title="How is the modernized algorithm different?"
            >?</button>
          </div>
        </div>
      </fieldset>

      <fieldset class="quality-control-group">
        <legend>Image quality</legend>
        <div class="quality-grid">
          <label for="resolution-select">Output:</label>
          <select id="resolution-select">
            <option value="256x192">256 x 192</option>
            <option value="320x240" selected>320 x 240</option>
            <option value="512x384">512 x 384 - original</option>
            <option value="640x480">640 x 480</option>
          </select>

          <label for="supersampling-select">Sampling:</label>
          <select id="supersampling-select">
            <option value="1" selected>1x</option>
            <option value="2">2x - original</option>
            <option value="3">3x</option>
          </select>

          <label for="depth-select">Trace depth:</label>
          <select id="depth-select">
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5" selected>5 - original</option>
            <option value="6">6</option>
            <option value="7">7</option>
          </select>
        </div>
      </fieldset>

      <fieldset class="render-control-group">
        <legend>Render</legend>
        <div class="render-button-stack">
          <button class="default render-command" id="render-button">Trace scene</button>
          <button id="cancel-button" disabled>Cancel</button>
          <button id="save-image-button" disabled>Save PNG...</button>
        </div>
        <div class="field-row ray-toggle-row">
          <input type="checkbox" id="show-rays" checked />
          <label for="show-rays">Show sampled rays</label>
        </div>
      </fieldset>
    </section>
  `;
}

function workspaceMarkup() {
  return `
    <section class="workspace-grid">
      <article class="window viewport-window">
        <div class="title-bar">
          <div class="title-bar-text">Interactive Preview - Three.js Scene Editor</div>
          <div class="title-bar-controls">
            <button type="button" aria-label="Maximize" tabindex="-1"></button>
          </div>
        </div>
        <div class="window-body viewport-window-body">
          <div class="viewport-stage field-border" id="preview-stage">
            <div id="preview-container" class="webgl-container"></div>
            <div class="viewport-hint">Select: click object | Orbit: left drag | Pan: right drag | Zoom: wheel</div>
            <div class="camera-stale" id="camera-stale">Scene changed - trace again to update the image</div>
          </div>
        </div>
        <div class="status-bar">
          <p class="status-bar-field" id="scene-object-count">- objects</p>
          <p class="status-bar-field" id="scene-triangle-count">Triangles compile at render time</p>
          <p class="status-bar-field" id="scene-source">Source: main.dfm</p>
        </div>
      </article>

      <article class="window viewport-window">
        <div class="title-bar">
          <div class="title-bar-text">CPU Ray Tracer - Progressive Image</div>
          <div class="title-bar-controls">
            <button type="button" aria-label="Maximize" tabindex="-1"></button>
          </div>
        </div>
        <div class="window-body viewport-window-body">
          <div class="viewport-stage output-stage field-border" id="output-stage">
            <canvas id="output-canvas" width="320" height="240" aria-label="Ray-traced result"></canvas>
            <div class="output-empty" id="output-empty">
              <div class="hourglass-glyph" aria-hidden="true">⌛</div>
              <strong>No rays traced yet</strong>
              <small>Position the camera, edit the scene, and click Trace scene.</small>
            </div>
            <div class="pixel-marker" id="pixel-marker"></div>
            <div class="output-corner-label" id="output-corner-label">320 x 240</div>
          </div>
          <div class="progress-indicator segmented render-progress" aria-label="Render progress">
            <span class="progress-indicator-bar" id="progress-fill" style="width: 0%"></span>
          </div>
        </div>
        <div class="status-bar">
          <p class="status-bar-field" id="progress-label">Idle</p>
          <p class="status-bar-field" id="render-mode-chip">Original algorithm</p>
          <p class="status-bar-field fixed-status" id="render-elapsed-inline">0.00 s</p>
        </div>
      </article>
    </section>
  `;
}

function materialEditorDialogMarkup() {
  return `
    <section class="window floating-dialog material-editor-dialog hidden" id="material-editor-dialog" data-dialog="material" role="dialog" aria-modal="false" aria-labelledby="material-editor-title">
      <div class="title-bar dialog-title-bar" data-dialog-drag-handle>
        <div class="title-bar-text" id="material-editor-title">Material Editor</div>
        <div class="title-bar-controls">
          <button type="button" aria-label="Close" data-dialog-close="material"></button>
        </div>
      </div>
      <div class="window-body dialog-body material-dialog-body">
        <p class="dialog-object-caption status-field-border" id="material-dialog-object-caption">No object selected.</p>
        <fieldset>
          <legend>Surface appearance</legend>
          <div class="material-form-grid">
            <label for="material-color">Base color:</label>
            <div class="color-control-wrap">
              <input id="material-color" type="color" value="#ffffff" disabled />
              <span id="material-color-value">#FFFFFF</span>
            </div>

            <label>Texture:</label>
            <div class="texture-control-stack">
              <span class="status-field-border texture-name" id="material-texture-name">No texture</span>
              <div class="toolbar-row">
                <button id="material-texture-button" disabled>Load texture...</button>
                <button id="material-texture-remove" disabled>Remove</button>
              </div>
              <input id="material-texture-input" type="file" accept="image/png,image/jpeg,image/webp,image/bmp" hidden />
              <small id="material-uv-status">Select an object to inspect UV support.</small>
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend>Ray-tracing properties</legend>
          <div class="material-form-grid numeric-material-grid">
            <label for="material-reflectivity">Reflection (modern):</label>
            <input class="material-input" id="material-reflectivity" type="number" min="0" max="1" step="0.01" disabled />

            <label for="material-legacy-reflectivity">Reflection (original):</label>
            <input class="material-input" id="material-legacy-reflectivity" type="number" min="0" max="1" step="0.01" disabled />

            <label for="material-roughness">Roughness:</label>
            <input class="material-input" id="material-roughness" type="number" min="0" max="1" step="0.01" disabled />

            <label for="material-specular">Specular strength:</label>
            <input class="material-input" id="material-specular" type="number" min="0" max="2" step="0.01" disabled />

            <label for="material-transmission">Transmission:</label>
            <input class="material-input" id="material-transmission" type="number" min="0" max="1" step="0.01" disabled />

            <label for="material-ior">Index of refraction:</label>
            <input class="material-input" id="material-ior" type="number" min="1" max="2.5" step="0.01" disabled />
          </div>
          <div class="field-row material-button-row">
            <button id="material-reset-button" disabled>Reset material</button>
          </div>
        </fieldset>
        <p class="material-note">Edits update the WebGL preview immediately and are serialized into the next CPU render.</p>
      </div>
      <div class="dialog-button-row">
        <button type="button" data-dialog-close="material">Close</button>
      </div>
    </section>
  `;
}

function analysisDialogMarkup() {
  return `
    <section class="window floating-dialog analysis-dialog hidden" id="analysis-dialog" data-dialog="analysis" role="dialog" aria-modal="false" aria-labelledby="analysis-dialog-title">
      <div class="title-bar dialog-title-bar" data-dialog-drag-handle>
        <div class="title-bar-text" id="analysis-dialog-title">Render Analysis</div>
        <div class="title-bar-controls">
          <button type="button" aria-label="Close" data-dialog-close="analysis"></button>
        </div>
      </div>
      <div class="window-body dialog-body analysis-dialog-body">
        <menu role="tablist" class="analysis-tabs" aria-label="Render analysis pages">
          <button type="button" role="tab" id="analysis-tab-summary" data-analysis-tab="summary" aria-controls="analysis-panel-summary" aria-selected="true">Summary</button>
          <button type="button" role="tab" id="analysis-tab-rays" data-analysis-tab="rays" aria-controls="analysis-panel-rays" aria-selected="false">Ray Telemetry</button>
          <button type="button" role="tab" id="analysis-tab-intersections" data-analysis-tab="intersections" aria-controls="analysis-panel-intersections" aria-selected="false">Intersections</button>
          <button type="button" role="tab" id="analysis-tab-pixel" data-analysis-tab="pixel" aria-controls="analysis-panel-pixel" aria-selected="false">Pixel Microscope</button>
        </menu>

        <section role="tabpanel" id="analysis-panel-summary" data-analysis-panel="summary" aria-labelledby="analysis-tab-summary">
          <div class="stat-grid">
            <div class="stat-cell"><span>Elapsed</span><strong id="stat-elapsed">0.00 s</strong><small id="stat-build-time">BVH not built</small></div>
            <div class="stat-cell"><span>Throughput</span><strong id="stat-throughput">0 px/s</strong><small>output pixels</small></div>
            <div class="stat-cell"><span>Total rays</span><strong id="stat-rays">0</strong><small id="stat-ray-mix">primary - shadow - recursive</small></div>
            <div class="stat-cell"><span>Scene</span><strong id="stat-triangles">0 tris</strong><small id="stat-bvh">0 BVH nodes</small></div>
            <div class="stat-cell"><span>Occlusion</span><strong id="stat-shadowed">0.0%</strong><small>shadow rays blocked</small></div>
            <div class="stat-cell"><span>Mean depth</span><strong id="stat-depth">0.00</strong><small id="stat-intersections">0 triangle tests</small></div>
          </div>
        </section>

        <section role="tabpanel" id="analysis-panel-rays" data-analysis-panel="rays" aria-labelledby="analysis-tab-rays" hidden>
          <div class="depth-chart field-border" id="depth-chart">
            <div class="chart-placeholder">Trace a scene to populate the depth histogram.</div>
          </div>
          <div class="ray-legend">
            <span><i class="ray-primary"></i>Primary</span>
            <span><i class="ray-shadow"></i>Light / shadow</span>
            <span><i class="ray-blocked"></i>Occluded</span>
            <span><i class="ray-reflection"></i>Reflection</span>
            <span><i class="ray-refraction"></i>Refraction</span>
            <span><i class="ray-normal"></i>Normal</span>
          </div>
          <div class="field-row analysis-actions"><button id="clear-rays-button">Clear all ray paths</button></div>
        </section>

        <section role="tabpanel" id="analysis-panel-intersections" data-analysis-panel="intersections" aria-labelledby="analysis-tab-intersections" hidden>
          <div class="object-hit-list field-border" id="object-hit-list">
            <div class="chart-placeholder">Object statistics will appear during rendering.</div>
          </div>
        </section>

        <section role="tabpanel" id="analysis-panel-pixel" data-analysis-panel="pixel" aria-labelledby="analysis-tab-pixel" hidden>
          <div class="pixel-inspector-toolbar status-field-border">
            <span id="inspector-ray-focus-note">Click the rendered image to isolate and reconstruct one optical path.</span>
            <button id="restore-render-rays-button" type="button" disabled>Restore sampled rays</button>
          </div>
          <div class="inspector-content field-border" id="inspector-content">
            <div class="inspector-placeholder">
              <div class="crosshair-icon" aria-hidden="true">⊕</div>
              <p>Click the rendered image to reconstruct its primary, shadow, reflection, and refraction paths.</p>
            </div>
          </div>
        </section>
      </div>
      <div class="dialog-button-row">
        <button type="button" data-dialog-close="analysis">Close</button>
      </div>
    </section>
  `;
}

function modernInfoDialogMarkup() {
  return `
    <section class="window floating-dialog information-dialog hidden" id="modern-info-popover" data-dialog="modern-info" role="dialog" aria-modal="false" aria-labelledby="modern-info-title">
      <div class="title-bar dialog-title-bar" data-dialog-drag-handle>
        <div class="title-bar-text" id="modern-info-title">About the Modernized Renderer</div>
        <div class="title-bar-controls">
          <button type="button" aria-label="Close" id="modern-info-close" data-dialog-close="modern-info"></button>
        </div>
      </div>
      <div class="window-body dialog-body information-dialog-body">
        <p><strong>The scene and CPU/BVH architecture remain the same.</strong> Modern mode changes the optical model:</p>
        <ul class="tree-view modern-info-list">
          <li>Camera rays use the actual perspective field of view and aspect ratio.</li>
          <li>Shadow rays stop at the light, so geometry behind it cannot cast a false shadow.</li>
          <li>Normal-based ray offsets reduce self-intersection artifacts.</li>
          <li>Materials have explicit reflection, roughness, specular, transmission, and IOR values.</li>
          <li>Glass uses Schlick Fresnel reflection, Snell refraction, and total-internal-reflection handling.</li>
          <li>Lighting is evaluated in linear space and encoded to sRGB for display.</li>
          <li>UV textures are sampled by the CPU tracer when the selected mesh supplies texture coordinates.</li>
        </ul>
        <p>The <strong>Original</strong> option intentionally preserves the historical projection, reflection tinting, and unbounded-shadow behavior.</p>
      </div>
      <div class="dialog-button-row">
        <button type="button" class="default" data-dialog-close="modern-info">OK</button>
      </div>
    </section>
  `;
}

function aboutDialogMarkup() {
  return `
    <section class="window floating-dialog about-dialog hidden" id="about-dialog" data-dialog="about" role="dialog" aria-modal="false" aria-labelledby="about-dialog-title">
      <div class="title-bar dialog-title-bar" data-dialog-drag-handle>
        <div class="title-bar-text" id="about-dialog-title">About My Render</div>
        <div class="title-bar-controls">
          <button type="button" aria-label="Close" data-dialog-close="about"></button>
        </div>
      </div>
      <div class="window-body dialog-body about-dialog-body">
        <div class="about-icon" aria-hidden="true">R</div>
        <div>
          <p><strong>My Render - Delphi Ray Tracer Resurrected</strong></p>
          <p>A browser-based continuation of Ivan Sivák's early Delphi, Object Pascal, GLScene, and OpenGL project.</p>
          <p>Interactive preview: Three.js<br />Final image: recursive CPU ray tracer in a Web Worker</p>
          <p><a href="${GITHUB_URL}" target="_blank" rel="noopener noreferrer">Open the project on GitHub</a></p>
        </div>
      </div>
      <div class="dialog-button-row">
        <button type="button" class="default" data-dialog-close="about">OK</button>
      </div>
    </section>
  `;
}

export function mountLayout(app) {
  app.innerHTML = `
    <div class="desktop-shell">
      <main class="window app-window" aria-label="My Render ray-tracing application">
        <div class="title-bar app-title-bar">
          <div class="title-bar-text">My Render - Delphi Ray Tracer Resurrected</div>
          <div class="title-bar-controls" aria-hidden="true">
            <button aria-label="Minimize" tabindex="-1"></button>
            <button aria-label="Maximize" tabindex="-1"></button>
            <button aria-label="Close" tabindex="-1"></button>
          </div>
        </div>

        ${mainMenuMarkup()}
        ${objectToolbarMarkup()}

        <div class="window-body app-body">
          ${controlDeckMarkup()}
          ${workspaceMarkup()}

          <section class="legacy-strip window" id="legacy-strip">
            <div class="title-bar inactive">
              <div class="title-bar-text">Legacy Color Seed</div>
            </div>
            <div class="window-body legacy-strip-body">
              <p>The Pascal project randomized primitive colors at startup. This version uses a repeatable seed.</p>
              <div class="field-row">
                <label for="color-seed">Seed:</label>
                <input id="color-seed" type="number" value="2003" min="0" step="1" />
                <button id="reseed-button">Re-seed scene</button>
              </div>
            </div>
          </section>
        </div>

        <div class="status-bar app-status-bar">
          <p class="status-bar-field status-main"><span class="status-dot" id="status-dot"></span><span id="status-text">Ready</span></p>
          <p class="status-bar-field">CPU ray tracer - Web Worker - triangle BVH</p>
          <p class="status-bar-field">Legacy source: <code>legacy/delphi/</code></p>
        </div>
      </main>
    </div>

    <div class="desktop-dialog-layer" id="desktop-dialog-layer" aria-live="polite">
      ${materialEditorDialogMarkup()}
      ${analysisDialogMarkup()}
      ${modernInfoDialogMarkup()}
      ${aboutDialogMarkup()}
    </div>

    <div class="toast-region" id="toast-region" aria-live="polite"></div>
  `;
}
