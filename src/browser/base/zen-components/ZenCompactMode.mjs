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

XPCOMUtils.defineLazyPreferenceGetter(
  lazyCompactMode,
  'COMPACT_MODE_CAN_ANIMATE_SIDEBAR',
  'zen.view.compact.animate-sidebar',
  true
);

ChromeUtils.defineLazyGetter(lazyCompactMode, 'mainAppWrapper', () => document.getElementById('zen-main-app-wrapper'));

var gZenCompactModeManager = {
  _flashTimeouts: {},
  _evenListeners: [],
  _removeHoverFrames: {},
  _animating: false,

  init() {
    Services.prefs.addObserver('zen.tabs.vertical.right-side', this._updateSidebarIsOnRight.bind(this));

    gZenUIManager.addPopupTrackingAttribute(this.sidebar);
    gZenUIManager.addPopupTrackingAttribute(document.getElementById('zen-appcontent-navbar-container'));

    this.addMouseActions();
    this.addContextMenu();
  },

  get preference() {
    if (!document.documentElement.hasAttribute('zen-compact-mode')) {
      document.documentElement.setAttribute(
        'zen-compact-mode',
        lazyCompactMode.mainAppWrapper.getAttribute('zen-compact-mode')
      );
    }
    return lazyCompactMode.mainAppWrapper.getAttribute('zen-compact-mode') === 'true';
  },

  set preference(value) {
    if (this.preference === value || this._animating) {
      // We dont want the user to be able to spam the button
      return value;
    }
    // We use this element in order to make it persis across restarts, by using the XULStore.
    // main-window can't store attributes other than window sizes, so we use this instead
    lazyCompactMode.mainAppWrapper.setAttribute('zen-compact-mode', value);
    document.documentElement.setAttribute('zen-compact-mode', value);
    this._updateEvent();
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
    if (!aInstant && this.preference && lazyCompactMode.COMPACT_MODE_FLASH_ENABLED && !gZenGlanceManager._animating) {
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
    this._animating = true;
    const isCompactMode = this.preference;
    const canHideSidebar = Services.prefs.getBoolPref('zen.view.compact.hide-tabbar');
    const canAnimate =
      lazyCompactMode.COMPACT_MODE_CAN_ANIMATE_SIDEBAR &&
      !this.sidebar.hasAttribute('zen-user-show') &&
      !this.sidebar.hasAttribute('zen-has-hover');
    // Do this so we can get the correct width ONCE compact mode styled have been applied
    if (canAnimate) {
      this.sidebar.setAttribute('animate', 'true');
    }
    window.requestAnimationFrame(() => {
      let sidebarWidth = this.getAndApplySidebarWidth();
      if (!canAnimate) {
        this.sidebar.removeAttribute('animate');
        this._animating = false;
        return;
      }
      if (canHideSidebar && isCompactMode) {
        gZenUIManager.motion
          .animate(
            this.sidebar,
            this.sidebarIsOnRight
              ? {
                  marginRight: `-${sidebarWidth}px`,
                }
              : { marginLeft: `-${sidebarWidth}px` },
            {
              ease: 'easeIn',
              type: 'spring',
              stiffness: 3000,
              damping: 150,
              mass: 1,
            }
          )
          .then(() => {
            this.sidebar.removeAttribute('animate');
            this.sidebar.style.transition = 'none';
            this.sidebar.style.removeProperty('margin-right');
            this.sidebar.style.removeProperty('margin-left');
            this.sidebar.style.removeProperty('transform');
            this._animating = false;
            setTimeout(() => {
              this.sidebar.style.removeProperty('transition');
            });
          });
      } else if (canHideSidebar && !isCompactMode) {
        document.getElementById('browser').style.overflow = 'hidden';
        if (this.sidebarIsOnRight) {
          this.sidebar.style.marginRight = `-${sidebarWidth}px`;
        } else {
          this.sidebar.style.marginLeft = `-${sidebarWidth}px`;
        }
        gZenUIManager.motion
          .animate(
            this.sidebar,
            this.sidebarIsOnRight
              ? {
                  marginRight: 0,
                  transform: ['translateX(100%)', 'translateX(0)'],
                }
              : { marginLeft: 0 },
            {
              ease: 'easeOut',
              type: 'spring',
              stiffness: 3000,
              damping: 150,
              mass: 1,
            }
          )
          .then(() => {
            this.sidebar.removeAttribute('animate');
            document.getElementById('browser').style.removeProperty('overflow');
            this.sidebar.style.transition = 'none';
            this.sidebar.style.removeProperty('margin-right');
            this.sidebar.style.removeProperty('margin-left');
            this.sidebar.style.removeProperty('transform');
            this._animating = false;
            setTimeout(() => {
              this.sidebar.style.removeProperty('transition');
            });
          });
      } else {
        this.sidebar.removeAttribute('animate'); // remove the attribute if we are not animating
        this._animating = false;
      }
    });
  },

  updateContextMenu() {
    document.getElementById('zen-context-menu-compact-mode-toggle').setAttribute('checked', this.preference);

    const hideTabBar = Services.prefs.getBoolPref('zen.view.compact.hide-tabbar', false);
    const hideToolbar = Services.prefs.getBoolPref('zen.view.compact.hide-toolbar', false);
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

  toggle() {
    return (this.preference = !this.preference);
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
        keepHoverDuration: 100,
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
        if (!event.target.matches(':hover')) return;
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
