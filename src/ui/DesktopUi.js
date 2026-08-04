function isTextEntry(target) {
  return Boolean(
    target
    && (
      target.matches?.('input, select, textarea, button, a')
      || target.isContentEditable
    ),
  );
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

export class DesktopUi {
  constructor({ root = document, onCommand = () => {}, onBeforeMenuOpen = () => {} } = {}) {
    this.root = root;
    this.onCommand = onCommand;
    this.onBeforeMenuOpen = onBeforeMenuOpen;
    this.activeMenu = null;
    this.zIndex = 700;
    this.openDialogs = [];
    this.disposers = [];

    this.menuBar = root.querySelector('#main-menu-bar');
    this.menuButtons = [...root.querySelectorAll('[data-menu-button]')];
    this.menuPopups = [...root.querySelectorAll('[data-menu-popup]')];
    this.dialogs = new Map(
      [...root.querySelectorAll('[data-dialog]')]
        .map((dialog) => [dialog.dataset.dialog, dialog]),
    );
    this.analysisTabs = [...root.querySelectorAll('[data-analysis-tab]')];
    this.analysisPanels = [...root.querySelectorAll('[data-analysis-panel]')];

    this.bindMenus();
    this.bindDialogs();
    this.bindAnalysisTabs();
    this.bindKeyboard();
  }

  listen(target, type, listener, options) {
    target.addEventListener(type, listener, options);
    this.disposers.push(() => target.removeEventListener(type, listener, options));
  }

  bindMenus() {
    for (const button of this.menuButtons) {
      const name = button.dataset.menuButton;
      this.listen(button, 'click', (event) => {
        event.stopPropagation();
        if (this.activeMenu === name) this.closeMenus();
        else this.openMenu(name);
      });
      this.listen(button, 'pointerenter', () => {
        if (this.activeMenu && this.activeMenu !== name) this.openMenu(name, { focus: false });
      });
    }

    for (const popup of this.menuPopups) {
      this.listen(popup, 'click', (event) => {
        const commandNode = event.target.closest?.('[data-command]');
        const link = event.target.closest?.('a[href]');
        if (link) {
          this.closeMenus();
          return;
        }
        if (!commandNode || commandNode.disabled) return;
        event.preventDefault();
        this.closeMenus();
        this.dispatch(commandNode.dataset.command, commandNode);
      });
      this.listen(popup, 'keydown', (event) => this.handleMenuKeyDown(event, popup));
    }

    this.listen(document, 'pointerdown', (event) => {
      if (!this.menuBar?.contains(event.target)) this.closeMenus();
    });
  }

  handleMenuKeyDown(event, popup) {
    const items = [...popup.querySelectorAll('.menu-item:not(:disabled)')];
    const current = items.indexOf(document.activeElement);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      items[(current + 1 + items.length) % items.length]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      items[(current - 1 + items.length) % items.length]?.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      const activeButton = this.menuButtons.find((button) => button.dataset.menuButton === this.activeMenu);
      this.closeMenus();
      activeButton?.focus();
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const currentIndex = this.menuButtons.findIndex((button) => button.dataset.menuButton === this.activeMenu);
      const delta = event.key === 'ArrowRight' ? 1 : -1;
      const next = this.menuButtons[(currentIndex + delta + this.menuButtons.length) % this.menuButtons.length];
      this.openMenu(next.dataset.menuButton);
    }
  }

  openMenu(name, { focus = true } = {}) {
    this.onBeforeMenuOpen?.(name);
    this.activeMenu = name;
    for (const button of this.menuButtons) {
      const selected = button.dataset.menuButton === name;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-expanded', String(selected));
    }
    for (const popup of this.menuPopups) {
      popup.classList.toggle('hidden', popup.dataset.menuPopup !== name);
    }
    if (focus) {
      const popup = this.menuPopups.find((candidate) => candidate.dataset.menuPopup === name);
      popup?.querySelector('.menu-item:not(:disabled)')?.focus();
    }
  }

  closeMenus() {
    this.activeMenu = null;
    for (const button of this.menuButtons) {
      button.classList.remove('active');
      button.setAttribute('aria-expanded', 'false');
    }
    for (const popup of this.menuPopups) popup.classList.add('hidden');
  }

  bindDialogs() {
    for (const [name, dialog] of this.dialogs) {
      this.listen(dialog, 'pointerdown', () => this.bringDialogToFront(name));
      const handle = dialog.querySelector('[data-dialog-drag-handle]');
      if (handle) this.bindDragHandle(name, dialog, handle);
    }

    for (const closeButton of this.root.querySelectorAll('[data-dialog-close]')) {
      this.listen(closeButton, 'click', () => this.closeDialog(closeButton.dataset.dialogClose));
    }
  }

  bindDragHandle(name, dialog, handle) {
    this.listen(handle, 'pointerdown', (event) => {
      if (event.button !== 0 || event.target.closest('.title-bar-controls')) return;
      event.preventDefault();
      this.bringDialogToFront(name);

      const bounds = dialog.getBoundingClientRect();
      const offsetX = event.clientX - bounds.left;
      const offsetY = event.clientY - bounds.top;
      handle.setPointerCapture?.(event.pointerId);
      dialog.classList.add('dragging');

      const onMove = (moveEvent) => {
        const maximumLeft = Math.max(0, document.documentElement.clientWidth - 90);
        const maximumTop = Math.max(0, document.documentElement.clientHeight - 26);
        dialog.style.left = `${clamp(moveEvent.clientX - offsetX, 0, maximumLeft)}px`;
        dialog.style.top = `${clamp(moveEvent.clientY - offsetY, 0, maximumTop)}px`;
        dialog.style.right = 'auto';
        dialog.style.bottom = 'auto';
        dialog.dataset.positioned = 'true';
      };
      const onUp = (upEvent) => {
        handle.releasePointerCapture?.(upEvent.pointerId);
        dialog.classList.remove('dragging');
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onUp);
        handle.removeEventListener('pointercancel', onUp);
      };
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
      handle.addEventListener('pointercancel', onUp);
    });
  }

  bindAnalysisTabs() {
    for (const tab of this.analysisTabs) {
      this.listen(tab, 'click', () => this.activateAnalysisTab(tab.dataset.analysisTab));
      this.listen(tab, 'keydown', (event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const current = this.analysisTabs.indexOf(tab);
        let next = current;
        if (event.key === 'ArrowLeft') next = (current - 1 + this.analysisTabs.length) % this.analysisTabs.length;
        if (event.key === 'ArrowRight') next = (current + 1) % this.analysisTabs.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = this.analysisTabs.length - 1;
        const target = this.analysisTabs[next];
        this.activateAnalysisTab(target.dataset.analysisTab);
        target.focus();
      });
    }
  }

  bindKeyboard() {
    this.handleKeyDown = (event) => {
      const key = event.key.toLowerCase();
      if (event.altKey && ['f', 'e', 'v', 'r', 'h'].includes(key)) {
        event.preventDefault();
        const names = { f: 'file', e: 'edit', v: 'view', r: 'render', h: 'help' };
        this.openMenu(names[key]);
        return;
      }

      if (event.key === 'Escape') {
        if (this.activeMenu) {
          event.preventDefault();
          this.closeMenus();
          return;
        }
        const topDialog = this.openDialogs.at(-1);
        if (topDialog && this.isDialogOpen(topDialog)) {
          event.preventDefault();
          this.closeDialog(topDialog);
          return;
        }
        const cancelCommand = this.root.querySelector('[data-command="cancel-render"]');
        if (cancelCommand && !cancelCommand.disabled) {
          event.preventDefault();
          this.dispatch('cancel-render', cancelCommand);
          return;
        }
      }

      if (isTextEntry(event.target)) return;
      if ((event.ctrlKey || event.metaKey) && key === 'o') {
        event.preventDefault();
        this.dispatch('load-model');
      } else if ((event.ctrlKey || event.metaKey) && key === 's') {
        event.preventDefault();
        this.dispatch('save-image');
      } else if (event.key === 'F5') {
        event.preventDefault();
        this.dispatch('reload-scene');
      } else if (event.key === 'F9') {
        event.preventDefault();
        this.dispatch('open-analysis-summary');
      } else if (event.key === 'F10') {
        event.preventDefault();
        this.dispatch('trace-scene');
      } else if (key === 'm') {
        event.preventDefault();
        this.dispatch('open-material-editor');
      } else if (event.key === 'Home') {
        event.preventDefault();
        this.dispatch('reset-camera');
      }
    };
    this.listen(window, 'keydown', this.handleKeyDown, true);
  }

  dispatch(command, source = null) {
    const node = source ?? this.root.querySelector(`[data-command="${command}"]`);
    if (node?.disabled) return;
    this.onCommand(command, source);
  }

  setCommandEnabled(command, enabled) {
    for (const node of this.root.querySelectorAll(`[data-command="${command}"]`)) {
      if ('disabled' in node) node.disabled = !enabled;
      node.setAttribute('aria-disabled', String(!enabled));
    }
  }

  setCommandChecked(command, checked) {
    for (const node of this.root.querySelectorAll(`[data-command="${command}"]`)) {
      node.dataset.checked = String(Boolean(checked));
      node.setAttribute('aria-checked', String(Boolean(checked)));
    }
  }

  openDialog(name, { analysisTab = null } = {}) {
    const dialog = this.dialogs.get(name);
    if (!dialog) return;
    dialog.classList.remove('hidden');
    this.bringDialogToFront(name);
    if (!dialog.dataset.positioned) this.centerDialog(dialog);
    if (analysisTab) this.activateAnalysisTab(analysisTab);
    const focusTarget = dialog.querySelector('[autofocus], button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]');
    window.setTimeout(() => focusTarget?.focus(), 0);
  }

  closeDialog(name) {
    const dialog = this.dialogs.get(name);
    if (!dialog) return;
    dialog.classList.add('hidden');
    this.openDialogs = this.openDialogs.filter((candidate) => candidate !== name);
  }

  isDialogOpen(name) {
    const dialog = this.dialogs.get(name);
    return Boolean(dialog && !dialog.classList.contains('hidden'));
  }

  bringDialogToFront(name) {
    const dialog = this.dialogs.get(name);
    if (!dialog) return;
    this.zIndex += 1;
    dialog.style.zIndex = String(this.zIndex);
    this.openDialogs = this.openDialogs.filter((candidate) => candidate !== name);
    this.openDialogs.push(name);
  }

  centerDialog(dialog) {
    const bounds = dialog.getBoundingClientRect();
    const left = Math.max(8, (document.documentElement.clientWidth - bounds.width) / 2);
    const top = Math.max(28, (document.documentElement.clientHeight - bounds.height) / 2);
    dialog.style.left = `${Math.round(left)}px`;
    dialog.style.top = `${Math.round(top)}px`;
    dialog.style.right = 'auto';
    dialog.style.bottom = 'auto';
    dialog.dataset.positioned = 'true';
  }

  activateAnalysisTab(name) {
    for (const tab of this.analysisTabs) {
      const active = tab.dataset.analysisTab === name;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    }
    for (const panel of this.analysisPanels) {
      panel.hidden = panel.dataset.analysisPanel !== name;
    }
  }

  dispose() {
    for (const dispose of this.disposers.splice(0)) dispose();
  }
}
