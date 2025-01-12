import { AppConstants } from "resource://gre/modules/AppConstants.sys.mjs";

export var ZenCustomizableUI = new (class {
  constructor() {}

  TYPE_TOOLBAR = 'toolbar';
  defaultSidebarIcons = ['zen-profile-button', 'zen-workspaces-button', 'downloads-button'];

  startup(CustomizableUIInternal) {
    CustomizableUIInternal.registerArea(
      'zen-sidebar-top-buttons',
      {
        type: this.TYPE_TOOLBAR,
        defaultPlacements: AppConstants.platform === 'macosx' ? [] : ['zen-sidepanel-button'],
        defaultCollapsed: null,
      },
      true
    );
    CustomizableUIInternal.registerArea(
      'zen-sidebar-icons-wrapper',
      {
        type: this.TYPE_TOOLBAR,
        defaultPlacements: this.defaultSidebarIcons,
        defaultCollapsed: null,
      },
      true
    );
  }

  // We do not have access to the window object here
  init(window) {
    this._addSidebarButtons(window);
    this._hideToolbarButtons(window);
  }

  _addSidebarButtons(window) {
    const sidebarBox = window.MozXULElement.parseXULToFragment(`
      <toolbar id="zen-sidebar-top-buttons"
        fullscreentoolbar="true"
        class="browser-toolbar customization-target zen-dont-hide-on-fullscreen"
        brighttext="true"
        data-l10n-id="tabs-toolbar"
        customizable="true"
        context="toolbar-context-menu"
        flex="1"
        skipintoolbarset="true"
        customizationtarget="zen-sidebar-top-buttons-customization-target"
        mode="icons">
        <hbox id="zen-sidebar-top-buttons-customization-target" class="customization-target" flex="1">
          <toolbarbutton removable="true" class="chromeclass-toolbar-additional toolbarbutton-1 zen-sidebar-action-button" id="zen-expand-sidebar-button" data-l10n-id="sidebar-zen-expand" cui-areatype="toolbar" oncommand="gZenVerticalTabsManager.toggleExpand();"></toolbarbutton>
          <toolbarbutton removable="true" class="toolbarbutton-1 zen-sidebar-action-button zen-compact-mode-ignore" id="zen-sidepanel-button" data-l10n-id="sidebar-zen-sidepanel" onclick="gZenBrowserManagerSidebar.toggle();"></toolbarbutton>
        </hbox>
      </toolbar>
    `);
    window.document.getElementById('navigator-toolbox').prepend(sidebarBox);

    const newTab = window.document.getElementById('vertical-tabs-newtab-button');
    newTab.classList.add('zen-sidebar-action-button');

    const wrapper = window.document.createXULElement('toolbarbutton');
    wrapper.id = 'zen-workspaces-button';
    window.document.getElementById('zen-sidebar-icons-wrapper').prepend(wrapper);

    for (let id of this.defaultSidebarIcons) {
      const elem = window.document.getElementById(id);
      if (!elem) continue;
      elem.setAttribute('removable', 'true');
    }

    this._moveWindowButtons(window);
  }

  _moveWindowButtons(window) {
    const windowControls = window.document.getElementsByClassName('titlebar-buttonbox-container');
    const toolboxIcons = window.document.getElementById('zen-sidebar-top-buttons-customization-target');
    if (window.AppConstants.platform === 'macosx' || window.matchMedia('(-moz-gtk-csd-reversed-placement)').matches) {
      for (let i = 0; i < windowControls.length; i++) {
        if (i === 0) {
          toolboxIcons.prepend(windowControls[i]);
          continue;
        }
        windowControls[i].remove();
      }
    }
  }

  _hideToolbarButtons(window) {
    const wrapper = window.document.getElementById('zen-sidebar-icons-wrapper');
    const elementsToHide = ['alltabs-button', 'new-tab-button'];
    for (let id of elementsToHide) {
      const elem = window.document.getElementById(id);
      if (elem) {
        wrapper.prepend(elem);
      }
    }
  }

  registerToolbarNodes(window) {
    window.CustomizableUI.registerToolbarNode(window.document.getElementById('zen-sidebar-top-buttons'));
    window.CustomizableUI.registerToolbarNode(window.document.getElementById('zen-sidebar-icons-wrapper'));
  }
})();
