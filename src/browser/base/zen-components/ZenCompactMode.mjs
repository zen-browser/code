const lazyCompactMode = {};

XPCOMUtils.defineLazyPreferenceGetter(
  lazyCompactMode,
  'COMPACT_MODE_FLASH_DURATION',
  'zen.view.compact.toolbar-flash-popup.duration',
  800
);

XPCOMUtils.defineLazyPreferenceGetter(
  lazyCompactMode,
  'COMPACT_MODE_FLASH_ENABLED',
  'zen.view.compact.toolbar-flash-popup',
  true
);

var gZenCompactModeManager = {
  _flashTimeouts: {},
  _evenListeners: [],
  _removeHoverFrames: {},

  init() {
    Services.prefs.addObserver('zen.view.compact', this._updateEvent.bind(this));
    Services.prefs.addObserver('zen.view.sidebar-expanded.on-hover', this._disableTabsOnHoverIfConflict.bind(this));
    Services.prefs.addObserver('zen.tabs.vertical.right-side', this._updateSidebarIsOnRight.bind(this));

    this._canAnimateSidebar = Services.prefs.getBoolPref('zen.view.compact.animate-sidebar', true);

    gZenUIManager.addPopupTrackingAttribute(this.sidebar);
    gZenUIManager.addPopupTrackingAttribute(document.getElementById('zen-appcontent-navbar-container'));

    this.addMouseActions();
    this.addContextMenu();
  },

  get prefefence() {
    return Services.prefs.getBoolPref('zen.view.compact');
  },

  set preference(value) {
    Services.prefs.setBoolPref('zen.view.compact', value);
    return value;
  },

  get sidebarIsOnRight() {
    if (this._sidebarIsOnRight) {
      return this._sidebarIsOnRight;
    }
    this._sidebarIsOnRight = Services.prefs.getBoolPref('zen.tabs.vertical.right-side');
    return this._sidebarIsOnRight;
  },

  get sidebar() {
    if (!this._sidebar) {
      this._sidebar = document.getElementById('navigator-toolbox');
    }
    return this._sidebar;
  },

  flashSidebarIfNecessary(aInstant = false) {
    if (!aInstant && this.prefefence && lazyCompactMode.COMPACT_MODE_FLASH_ENABLED && !gZenGlanceManager._animating) {
      this.flashSidebar();
    }
  },

  addContextMenu() {
    const fragment = window.MozXULElement.parseXULToFragment(`
      <menu id="zen-context-menu-compact-mode" data-l10n-id="zen-toolbar-context-compact-mode">
        <menupopup>
          <menuitem id="zen-context-menu-compact-mode-toggle" data-l10n-id="zen-toolbar-context-compact-mode-enable" type="checkbox" oncommand="gZenCompactModeManager.toggle();"/>
          <menuseparator/>
          <menuitem id="zen-context-menu-compact-mode-hide-sidebar" data-l10n-id="zen-toolbar-context-compact-mode-just-tabs" type="radio" oncommand="gZenCompactModeManager.hideSidebar();"/>
          <menuitem id="zen-context-menu-compact-mode-hide-toolbar" data-l10n-id="zen-toolbar-context-compact-mode-just-toolbar" type="radio" oncommand="gZenCompactModeManager.hideToolbar();"/>
          <menuitem id="zen-context-menu-compact-mode-hide-both" data-l10n-id="zen-toolbar-context-compact-mode-hide-both" type="radio" oncommand="gZenCompactModeManager.hideBoth();"/>
        </menupopup>
      </menu>
    `);
    document.getElementById('viewToolbarsMenuSeparator').before(fragment);
    this.updateContextMenu();
  },

  updateCompactModeContext(isSingleToolbar) {
    this.getAndApplySidebarWidth(); // Ignore return value

    const IDs = [
      'zen-context-menu-compact-mode-hide-sidebar',
      'zen-context-menu-compact-mode-hide-toolbar',
      'zen-context-menu-compact-mode-hide-both',
    ];
    for (let id of IDs) {
      document.getElementById(id).disabled = isSingleToolbar;
    }
  },

  hideSidebar() {
    Services.prefs.setBoolPref('zen.view.compact.hide-tabbar', true);
    Services.prefs.setBoolPref('zen.view.compact.hide-toolbar', false);
  },

  hideToolbar() {
    Services.prefs.setBoolPref('zen.view.compact.hide-toolbar', true);
    Services.prefs.setBoolPref('zen.view.compact.hide-tabbar', false);
  },

  hideBoth() {
    Services.prefs.setBoolPref('zen.view.compact.hide-tabbar', true);
    Services.prefs.setBoolPref('zen.view.compact.hide-toolbar', true);
  },

  addEventListener(callback) {
    this._evenListeners.push(callback);
  },

  _updateEvent() {
    this._evenListeners.forEach((callback) => callback());
    this._disableTabsOnHoverIfConflict();
    this.updateContextMenu();
    this.animateCompactMode();
  },

  getAndApplySidebarWidth() {
    let sidebarWidth = this.sidebar.getBoundingClientRect().width;
    if (sidebarWidth > 1) {
      this.sidebar.style.setProperty('--zen-sidebar-width', `${sidebarWidth}px`);
    }
    return sidebarWidth;
  },

  animateCompactMode() {
    const isCompactMode = this.prefefence;
    const canHideSidebar = Services.prefs.getBoolPref('zen.view.compact.hide-tabbar');
    if (this._isAnimating) {
      return;
    }
    this._isAnimating = true;
    // Do this so we can get the correct width ONCE compact mode styled have been applied
    if (this._canAnimateSidebar) {
      this.sidebar.setAttribute('animate', 'true');
    }
    window.requestAnimationFrame(() => {
      let sidebarWidth = this.getAndApplySidebarWidth();
      if (!this._canAnimateSidebar) {
        this.sidebar.removeAttribute('animate');
        this._isAnimating = false;
        return;
      }
      if (canHideSidebar && isCompactMode) {
        window.requestAnimationFrame(() => {
          this.sidebar.style.position = 'unset';
          this.sidebar.style.transition = 'margin .3s ease-in-out';
          this.sidebar.style.left = '0';
          if (!this.sidebarIsOnRight) {
            this.sidebar.style.marginLeft = `${-1 * sidebarWidth}px`;
          } else {
            this.sidebar.style.marginRight = `${-1 * sidebarWidth}px`;
          }
          this.sidebar.style.pointerEvents = 'none';

          window.requestAnimationFrame(() => {
            setTimeout(() => {
              window.requestAnimationFrame(() => {
                this.sidebar.style.removeProperty('pointer-events');
                this.sidebar.style.removeProperty('position');
                this.sidebar.style.removeProperty('margin-left');
                this.sidebar.style.removeProperty('margin-right');
                this.sidebar.style.removeProperty('transform');
                this.sidebar.style.removeProperty('left');
                document.getElementById('browser').style.removeProperty('overflow');
                this.sidebar.removeAttribute('animate');
                window.requestAnimationFrame(() => {
                  this.sidebar.style.removeProperty('transition');
                  this._isAnimating = false;
                });
              });
            }, 450);
          });
        });
      } else if (canHideSidebar && !isCompactMode) {
        document.getElementById('browser').style.overflow = 'hidden';
        this.sidebar.style.position = 'relative';
        this.sidebar.style.left = '0';

        if (!this.sidebarIsOnRight) {
          this.sidebar.style.marginLeft = `${-1 * sidebarWidth}px`;
        } else {
          this.sidebar.style.marginRight = `${-1 * sidebarWidth}px`;
          this.sidebar.style.transform = `translateX(${sidebarWidth}px)`;
        }

        window.requestAnimationFrame(() => {
          this.sidebar.style.transition = 'margin .3s ease-in-out, transform .275s ease-in-out, opacity .3s ease';
          // we are in compact mode and we are exiting it
          if (!this.sidebarIsOnRight) {
            this.sidebar.style.marginLeft = '0';
          } else {
            this.sidebar.style.marginRight = '0';
            this.sidebar.style.transform = 'translateX(0)';
          }
          this.sidebar.style.pointerEvents = 'none';

          setTimeout(() => {
            window.requestAnimationFrame(() => {
              this._isAnimating = false;
              this.sidebar.style.removeProperty('position');
              this.sidebar.style.removeProperty('pointer-events');
              this.sidebar.style.removeProperty('opacity');
              this.sidebar.style.removeProperty('margin-left');
              this.sidebar.style.removeProperty('margin-right');
              this.sidebar.style.removeProperty('transform');
              this.sidebar.style.removeProperty('transition');
              this.sidebar.style.removeProperty('left');

              document.getElementById('browser').style.removeProperty('overflow');
              this.sidebar.removeAttribute('animate');
            });
          }, 400);
        });
      } else {
        this.sidebar.removeAttribute('animate'); // remove the attribute if we are not animating
      }
    });
  },

  updateContextMenu() {
    document
      .getElementById('zen-context-menu-compact-mode-toggle')
      .setAttribute('checked', Services.prefs.getBoolPref('zen.view.compact'));

    const hideTabBar = Services.prefs.getBoolPref('zen.view.compact.hide-tabbar');
    const hideToolbar = Services.prefs.getBoolPref('zen.view.compact.hide-toolbar');
    const hideBoth = hideTabBar && hideToolbar;

    const idName = 'zen-context-menu-compact-mode-hide-';
    document.getElementById(idName + 'sidebar').setAttribute('checked', !hideBoth && hideTabBar);
    document.getElementById(idName + 'toolbar').setAttribute('checked', !hideBoth && hideToolbar);
    document.getElementById(idName + 'both').setAttribute('checked', hideBoth);
  },

  _removeOpenStateOnUnifiedExtensions() {
    // Fix for bug https://github.com/zen-browser/desktop/issues/1925
    const buttons = document.querySelectorAll('toolbarbutton:is(#unified-extensions-button, .webextension-browser-action)');
    for (let button of buttons) {
      button.removeAttribute('open');
    }
  },

  _disableTabsOnHoverIfConflict() {
    if (Services.prefs.getBoolPref('zen.view.compact') && Services.prefs.getBoolPref('zen.view.compact.hide-tabbar')) {
      Services.prefs.setBoolPref('zen.view.sidebar-expanded.on-hover', false);
    }
  },

  toggle() {
    return (this.preference = !this.prefefence);
  },

  _updateSidebarIsOnRight() {
    this._sidebarIsOnRight = Services.prefs.getBoolPref('zen.tabs.vertical.right-side');
  },

  toggleSidebar() {
    this.sidebar.toggleAttribute('zen-user-show');
  },

  get hideAfterHoverDuration() {
    if (this._hideAfterHoverDuration) {
      return this._hideAfterHoverDuration;
    }
    return Services.prefs.getIntPref('zen.view.compact.toolbar-hide-after-hover.duration');
  },

  get hoverableElements() {
    return [
      {
        element: this.sidebar,
        screenEdge: this.sidebarIsOnRight ? 'right' : 'left',
        keepHoverDuration: 50,
      },
      {
        element: document.getElementById('zen-appcontent-navbar-container'),
        screenEdge: 'top',
      },
    ];
  },

  flashSidebar(duration = lazyCompactMode.COMPACT_MODE_FLASH_DURATION) {
    let tabPanels = document.getElementById('tabbrowser-tabpanels');
    if (!tabPanels.matches("[zen-split-view='true']")) {
      this.flashElement(this.sidebar, duration, this.sidebar.id);
    }
  },

  flashElement(element, duration, id, attrName = 'flash-popup') {
    if (element.matches(':hover')) {
      return;
    }
    if (this._flashTimeouts[id]) {
      clearTimeout(this._flashTimeouts[id]);
    } else {
      requestAnimationFrame(() => element.setAttribute(attrName, 'true'));
    }
    this._flashTimeouts[id] = setTimeout(() => {
      window.requestAnimationFrame(() => {
        element.removeAttribute(attrName);
        this._flashTimeouts[id] = null;
      });
    }, duration);
  },

  clearFlashTimeout(id) {
    clearTimeout(this._flashTimeouts[id]);
    this._flashTimeouts[id] = null;
  },

  addMouseActions() {
    for (let i = 0; i < this.hoverableElements.length; i++) {
      let target = this.hoverableElements[i].element;
      target.addEventListener('mouseenter', (event) => {
        this.clearFlashTimeout('has-hover' + target.id);
        window.requestAnimationFrame(() => target.setAttribute('zen-has-hover', 'true'));
      });

      target.addEventListener('mouseleave', (event) => {
        // If on Mac, ignore mouseleave in the area of window buttons
        if (AppConstants.platform == 'macosx') {
          const MAC_WINDOW_BUTTONS_X_BORDER = 75;
          const MAC_WINDOW_BUTTONS_Y_BORDER = 40;
          if (event.clientX < MAC_WINDOW_BUTTONS_X_BORDER && event.clientY < MAC_WINDOW_BUTTONS_Y_BORDER) {
            return;
          }
        }

        // If it's a child element but not the target, ignore the event
        if (target.contains(event.explicitOriginalTarget) && event.explicitOriginalTarget !== target) {
          return;
        }

        if (this.hoverableElements[i].keepHoverDuration) {
          this.flashElement(target, this.hoverableElements[i].keepHoverDuration, 'has-hover' + target.id, 'zen-has-hover');
        } else {
          this._removeHoverFrames[target.id] = window.requestAnimationFrame(() => target.removeAttribute('zen-has-hover'));
        }
      });
    }

    document.documentElement.addEventListener('mouseleave', (event) => {
      const screenEdgeCrossed = this._getCrossedEdge(event.pageX, event.pageY);
      if (!screenEdgeCrossed) return;
      for (let entry of this.hoverableElements) {
        if (screenEdgeCrossed !== entry.screenEdge) continue;
        const target = entry.element;
        const boundAxis = entry.screenEdge === 'right' || entry.screenEdge === 'left' ? 'y' : 'x';
        if (!this._positionInBounds(boundAxis, target, event.pageX, event.pageY, 7)) {
          continue;
        }
        window.cancelAnimationFrame(this._removeHoverFrames[target.id]);

        this.flashElement(target, this.hideAfterHoverDuration, 'has-hover' + target.id, 'zen-has-hover');
        document.addEventListener(
          'mousemove',
          () => {
            if (target.matches(':hover')) return;
            target.removeAttribute('zen-has-hover');
            this.clearFlashTimeout('has-hover' + target.id);
          },
          { once: true }
        );
      }
    });
  },

  _getCrossedEdge(posX, posY, element = document.documentElement, maxDistance = 10) {
    const targetBox = element.getBoundingClientRect();
    posX = Math.max(targetBox.left, Math.min(posX, targetBox.right));
    posY = Math.max(targetBox.top, Math.min(posY, targetBox.bottom));
    return ['top', 'bottom', 'left', 'right'].find((edge, i) => {
      const distance = Math.abs((i < 2 ? posY : posX) - targetBox[edge]);
      return distance <= maxDistance;
    });
  },

  _positionInBounds(axis = 'x', element, x, y, error = 0) {
    const bBox = element.getBoundingClientRect();
    if (axis === 'y') return bBox.top - error < y && y < bBox.bottom + error;
    else return bBox.left - error < x && x < bBox.right + error;
  },

  toggleToolbar() {
    let toolbar = document.getElementById('zen-appcontent-navbar-container');
    toolbar.toggleAttribute('zen-user-show');
  },
};
