var gZenUIManager = {
  openAndChangeToTab(url, options) {
    if (window.ownerGlobal.parent) {
      let tab = window.ownerGlobal.parent.gBrowser.addTrustedTab(url, options);
      window.ownerGlobal.parent.gBrowser.selectedTab = tab;
      return tab;
    }
    let tab = window.gBrowser.addTrustedTab(url, options);
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
};

var gZenVerticalTabsManager = {
  init() {
    Services.prefs.addObserver('zen.view.sidebar-expanded', this._updateEvent.bind(this));
    Services.prefs.addObserver('zen.view.sidebar-expanded.max-width', this._updateEvent.bind(this));
    Services.prefs.addObserver('zen.view.sidebar-expanded.on-hover', this._updateOnHoverVerticalTabs.bind(this));
    this._updateMaxWidth();
    this.initRightSideOrderContextMenu();
    this._updateOnHoverVerticalTabs();
  },

  _updateOnHoverVerticalTabs() {
    let onHover = Services.prefs.getBoolPref('zen.view.sidebar-expanded.on-hover');
    let sidebar = document.getElementById('navigator-toolbox');
    if (onHover) {
      sidebar.setAttribute('zen-user-hover', 'true');
    } else {
      sidebar.removeAttribute('zen-user-hover');
    }
  },

  initRightSideOrderContextMenu() {
    const kConfigKey = 'zen.tabs.vertical.right-side';
    const fragment = window.MozXULElement.parseXULToFragment(`
      <menuitem id="zen-toolbar-context-tabs-right"
                type="checkbox"
                ${Services.prefs.getBoolPref(kConfigKey) ? 'checked="true"' : ''}
                data-lazy-l10n-id="zen-toolbar-context-tabs-right"/>
    `);
    fragment.getElementById('zen-toolbar-context-tabs-right').addEventListener('click', () => {
      let rightSide = Services.prefs.getBoolPref(kConfigKey);
      Services.prefs.setBoolPref(kConfigKey, !rightSide);
    });
    document.getElementById('viewToolbarsMenuSeparator').before(fragment);
  },

  _updateEvent() {
    this._updateMaxWidth();
  },

  _updateMaxWidth() {
    let isCompactMode = Services.prefs.getBoolPref('zen.view.compact');
    let expanded = this.expanded;
    let maxWidth = Services.prefs.getIntPref('zen.view.sidebar-expanded.max-width');
    let toolbox = document.getElementById('navigator-toolbox');
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

  //_updateExpandButton() {
  //  let isCompactMode = Services.prefs.getBoolPref('zen.view.compact');
  //  let button = this.expandButton;
  //  let expanded = this.expanded;
  //  if (expanded && !isCompactMode) {
  //    button.setAttribute('open', 'true');
  //  } else {
  //    button.removeAttribute('open');
  //  }
  //},

  toggleExpand() {
    let expanded = !this.expanded;
    Services.prefs.setBoolPref('zen.view.sidebar-expanded', expanded);
    Services.prefs.setBoolPref('zen.view.sidebar-expanded.on-hover', false);
  },
};

var gZenCompactModeManager = {
  _flashSidebarTimeout: null,

  init() {
    Services.prefs.addObserver('zen.view.compact', this._updateEvent.bind(this));
    Services.prefs.addObserver('zen.view.compact.toolbar-flash-popup.duration', this._updatedSidebarFlashDuration.bind(this));
  },

  get prefefence() {
    return Services.prefs.getBoolPref('zen.view.compact');
  },

  set preference(value) {
    Services.prefs.setBoolPref('zen.view.compact', value);
  },

  _updateEvent() {
    Services.prefs.setBoolPref('zen.view.sidebar-expanded.on-hover', false);
  },

  toggle() {
    this.preference = !this.prefefence;
  },

  _updatedSidebarFlashDuration() {
    this._flashSidebarDuration = Services.prefs.getIntPref('zen.view.compact.toolbar-flash-popup.duration');
  },

  toggleSidebar() {
    let sidebar = document.getElementById('navigator-toolbox');
    sidebar.toggleAttribute('zen-user-show');
  },

  get flashSidebarDuration() {
    if (this._flashSidebarDuration) {
      return this._flashSidebarDuration;
    }
    return Services.prefs.getIntPref('zen.view.compact.toolbar-flash-popup.duration');
  },

  flashSidebar() {
    let sidebar = document.getElementById('navigator-toolbox');
    if (sidebar.matches(':hover')) {
      return;
    }
    if (this._flashSidebarTimeout) {
      clearTimeout(this._flashSidebarTimeout);
    } else {
      window.requestAnimationFrame(() => sidebar.setAttribute('flash-popup', ''));
    }
    this._flashSidebarTimeout = setTimeout(() => {
      window.requestAnimationFrame(() => {
        sidebar.removeAttribute('flash-popup');
        this._flashSidebarTimeout = null;
      });
    }, this.flashSidebarDuration);
  },

  toggleToolbar() {
    let toolbar = document.getElementById('zen-appcontent-navbar-container');
    toolbar.toggleAttribute('zen-user-show');
  },
};
