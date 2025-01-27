import { AppConstants } from 'resource://gre/modules/AppConstants.sys.mjs';

export var ZenCustomizableUI = new (class {
  constructor() {}

  TYPE_TOOLBAR = 'toolbar';
  defaultSidebarIcons = ['zen-profile-button', 'zen-workspaces-button', 'downloads-button'];

  startup(CustomizableUIInternal) {
    CustomizableUIInternal.registerArea(
      'zen-sidebar-top-buttons',
      {
        type: this.TYPE_TOOLBAR,
        defaultPlacements: [],
        defaultCollapsed: null,
        overflowable: true,
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
    const toolbox = window.document.getElementById('navigator-toolbox');

    // Set a splitter to navigator-toolbox
    const splitter = window.document.createXULElement('splitter');
    splitter.setAttribute('id', 'zen-sidebar-splitter');
    splitter.setAttribute('orient', 'horizontal');
    splitter.setAttribute('resizebefore', 'sibling');
    splitter.setAttribute('resizeafter', 'none');
    toolbox.insertAdjacentElement('afterend', splitter);

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
        overflowable="true"
        default-overflowbutton="nav-bar-overflow-button"
        default-overflowtarget="widget-overflow-list"
        default-overflowpanel="widget-overflow"
        addon-webext-overflowbutton="unified-extensions-button"
        addon-webext-overflowtarget="overflowed-extensions-list"
        mode="icons">
        <hbox id="zen-sidebar-top-buttons-customization-target" class="customization-target" flex="1">
          <html:div id="zen-sidebar-top-buttons-separator" skipintoolbarset="true" overflows="false"></html:div>
        </hbox>
      </toolbar>
    `);
    toolbox.prepend(sidebarBox);
    new window.MutationObserver((e) => {
      if (e[0].type !== 'attributes' || e[0].attributeName !== 'width') return;
      this._dispatchResizeEvent(window);
    }).observe(toolbox, {
      attributes: true, //configure it to listen to attribute changes
    });

    // remove all styles except for the width, since we are xulstoring the complet style list
    const width = toolbox.style.width || '180px';
    toolbox.removeAttribute('style');
    toolbox.style.width = width;

    const newTab = window.document.getElementById('vertical-tabs-newtab-button');
    newTab.classList.add('zen-sidebar-action-button');

    for (let id of this.defaultSidebarIcons) {
      const elem = window.document.getElementById(id);
      if (!elem || elem.id === 'zen-workspaces-button') continue;
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

  _dispatchResizeEvent(window) {
    window.dispatchEvent(new window.Event('resize'));
  }

  registerToolbarNodes(window) {
    window.CustomizableUI.registerToolbarNode(window.document.getElementById('zen-sidebar-top-buttons'));
    window.CustomizableUI.registerToolbarNode(window.document.getElementById('zen-sidebar-icons-wrapper'));
    window.addEventListener(
      'MozAfterPaint',
      () => {
        this._dispatchResizeEvent(window);
      },
      { once: true }
    );
  }
})();
