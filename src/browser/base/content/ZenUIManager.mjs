var gZenUIManager = {
  _popupTrackingElements: [],
  _hoverPausedForExpand: false,

  init() {
    document.addEventListener('popupshowing', this.onPopupShowing.bind(this));
    document.addEventListener('popuphidden', this.onPopupHidden.bind(this));
  },

  openAndChangeToTab(url, options) {
    if (window.ownerGlobal.parent) {
      const tab = window.ownerGlobal.parent.gBrowser.addTrustedTab(url, options);
      window.ownerGlobal.parent.gBrowser.selectedTab = tab;
      return tab;
    }
    const tab = window.gBrowser.addTrustedTab(url, options);
    window.gBrowser.selectedTab = tab;
    return tab;
  },

  generateUuidv4() {
    return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
      (+c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (+c / 4)))).toString(16)
    );
  },

  toogleBookmarksSidebar() {
    const button = document.getElementById('zen-bookmark-button');
    SidebarController.toggle('viewBookmarksSidebar', button);
  },

  createValidXULText(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  },

  /**
   * Adds the 'has-popup-menu' attribute to the element when popup is opened on it.
   * @param element element to track
   */
  addPopupTrackingAttribute(element) {
    this._popupTrackingElements.push(element);
  },

  removePopupTrackingAttribute(element) {
    this._popupTrackingElements.remove(element);
  },

  onPopupShowing(showEvent) {
    for (const el of this._popupTrackingElements) {
      // target may be inside a shadow root, not directly under the element
      // we also ignore menus inside panels
      if (!el.contains(showEvent.explicitOriginalTarget) || (showEvent.explicitOriginalTarget && showEvent.explicitOriginalTarget?.closest('panel'))) {
        continue;
      }
      document.removeEventListener('mousemove', this.__removeHasPopupAttribute);
      el.setAttribute('has-popup-menu', '');
      this.__currentPopup = showEvent.target;
      this.__currentPopupTrackElement = el;
      break;
    }
  },

  onPopupHidden(hideEvent) {
    if (!this.__currentPopup || this.__currentPopup !== hideEvent.target) {
      return;
    }
    const element = this.__currentPopupTrackElement;
    if (document.getElementById('main-window').matches(':hover')) {
      element.removeAttribute('has-popup-menu');
    } else {
      this.__removeHasPopupAttribute = () => element.removeAttribute('has-popup-menu');
      document.addEventListener('mousemove', this.__removeHasPopupAttribute, { once: true });
    }
    this.__currentPopup = null;
    this.__currentPopupTrackElement = null;
  },
};

var gZenVerticalTabsManager = {
  init() {
    var updateEvent = this._updateEvent.bind(this);
    Services.prefs.addObserver('zen.view.sidebar-expanded', updateEvent);
    Services.prefs.addObserver('zen.tabs.vertical.right-side', updateEvent);
    Services.prefs.addObserver('zen.view.sidebar-expanded.max-width', updateEvent);
    Services.prefs.addObserver('zen.view.sidebar-expanded.on-hover', updateEvent);

    gZenCompactModeManager.addEventListener(updateEvent);
    this._updateEvent();
    this.initRightSideOrderContextMenu();

    const tabs = document.getElementById('tabbrowser-tabs');

    XPCOMUtils.defineLazyPreferenceGetter(this, 'canOpenTabOnMiddleClick', 'zen.tabs.newtab-on-middle-click', true);

    if (tabs) {
      tabs.addEventListener('mouseup', this.openNewTabOnTabsMiddleClick.bind(this));
    }
  },

  openNewTabOnTabsMiddleClick(event) {
    if (event.button === 1 && event.target.id === 'tabbrowser-tabs' && this.canOpenTabOnMiddleClick) {
      document.getElementById('cmd_newNavigatorTabNoEvent').doCommand();
      event.stopPropagation();
      event.preventDefault();
    }
  },

  get navigatorToolbox() {
    if (this._navigatorToolbox) {
      return this._navigatorToolbox;
    }
    this._navigatorToolbox = document.getElementById('navigator-toolbox');
    return this._navigatorToolbox;
  },

  _updateOnHoverVerticalTabs() {
    const onHover = Services.prefs.getBoolPref('zen.view.sidebar-expanded.on-hover');
    const expanded = Services.prefs.getBoolPref('zen.view.sidebar-expanded');
    const sidebar = this.navigatorToolbox;

    if (onHover) {
      // if the sidebar is not expanded, and hover detection is enabled, show the sidebar
      sidebar.removeAttribute('zen-expanded');
      sidebar.setAttribute('zen-user-hover', 'true');

      sidebar.removeAttribute('zen-has-hover');
    } 
    else if (expanded) {
      // if the sidebar is expanded, close, and remove hover detection
      sidebar.setAttribute('zen-expanded', 'true');
      sidebar.removeAttribute('zen-user-hover');
      sidebar.removeAttribute('zen-has-hover');
    } else {
      // if the sidebar is not expanded, and hover detection is disabled, hide the sidebar
      sidebar.removeAttribute('zen-expanded');
      sidebar.removeAttribute('zen-user-show');
      sidebar.removeAttribute('zen-user-hover');
    }
  },

  initRightSideOrderContextMenu() {
    const kConfigKey = 'zen.tabs.vertical.right-side';
    const fragment = window.MozXULElement.parseXULToFragment(`
      <menuitem id="zen-toolbar-context-tabs-right"
                type="checkbox"
                ${Services.prefs.getBoolPref(kConfigKey) ? 'checked="true"' : ''}
                data-lazy-l10n-id="zen-toolbar-context-tabs-right"
                oncommand="gZenVerticalTabsManager.toggleTabsOnRight();"
        />
    `);
    document.getElementById('viewToolbarsMenuSeparator').before(fragment);
  },

  _updateEvent() {
    this._updateMaxWidth();
    const topButtons = document.getElementById('zen-sidebar-top-buttons');
    const customizationTarget = document.getElementById('nav-bar-customization-target');
    const tabboxWrapper = document.getElementById('zen-tabbox-wrapper');
    const browser = document.getElementById('browser');
    const sidebarExpanded = Services.prefs.getBoolPref('zen.view.sidebar-expanded');

    if (Services.prefs.getBoolPref('zen.tabs.vertical.right-side')) {
      this.navigatorToolbox.setAttribute('zen-right-side', 'true');
    } else {
      this.navigatorToolbox.removeAttribute('zen-right-side');
    }

    // Check if the sidebar is in hover mode
    if (
      sidebarExpanded &&
      !this.navigatorToolbox.hasAttribute('zen-right-side') &&
      !Services.prefs.getBoolPref('zen.view.compact') &&
      !Services.prefs.getBoolPref('zen.view.sidebar-expanded.on-hover')
    ) {
      this.navigatorToolbox.prepend(topButtons);
      browser.prepend(this.navigatorToolbox);
    } else {
      customizationTarget.prepend(topButtons);
      tabboxWrapper.prepend(this.navigatorToolbox);
    }

    // Always move the splitter next to the sidebar
    this.navigatorToolbox.after(document.getElementById('zen-sidebar-splitter'));

    this._updateOnHoverVerticalTabs();
  },

  _updateMaxWidth() {
    const isCompactMode = Services.prefs.getBoolPref('zen.view.compact');
    const expanded = this.expanded;
    const maxWidth = Services.prefs.getIntPref('zen.view.sidebar-expanded.max-width');
    const toolbox = document.getElementById('navigator-toolbox');
    if (expanded && !isCompactMode) {
      toolbox.style.maxWidth = `${maxWidth}px`;
    } else {
      toolbox.style.removeProperty('maxWidth');
    }
  },

  get expanded() {
    return Services.prefs.getBoolPref('zen.view.sidebar-expanded');
  },

  get expandButton() {
    if (this._expandButton) {
      return this._expandButton;
    }
    this._expandButton = document.getElementById('zen-expand-sidebar-button');
    return this._expandButton;
  },

  toggleExpand() {
    const pausedForExpand = this._hoverPausedForExpand;
    const onHover = Services.prefs.getBoolPref('zen.view.sidebar-expanded.on-hover');
    const expanded = Services.prefs.getBoolPref('zen.view.sidebar-expanded');

  
    if (onHover && !expanded) {
      // Expand sidebar and disable hover detection
      Services.prefs.setBoolPref('zen.view.sidebar-expanded.on-hover', false);
      this._hoverPausedForExpand = true;
      Services.prefs.setBoolPref('zen.view.sidebar-expanded', true);
    } else if (pausedForExpand && expanded) {
      // Re-enable hover detection when closing
      this._hoverPausedForExpand = false;
      Services.prefs.setBoolPref('zen.view.sidebar-expanded', false);
      Services.prefs.setBoolPref('zen.view.sidebar-expanded.on-hover', true); // Re-enable hover detection when closing
    }
    else {
      // Toggle sidebar
      Services.prefs.setBoolPref('zen.view.sidebar-expanded.on-hover', false);
      Services.prefs.setBoolPref('zen.view.sidebar-expanded', !expanded);
    }
  },

  toggleTabsOnRight() {
    const newVal = !Services.prefs.getBoolPref('zen.tabs.vertical.right-side');
    Services.prefs.setBoolPref('zen.tabs.vertical.right-side', newVal);
  },
};