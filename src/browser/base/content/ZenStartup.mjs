{
  const lazy = {};
  var ZenStartup = {
    init() {
      this.openWatermark();
      window.SessionStore.promiseInitialized.then(() => {
        this._changeSidebarLocation();
        this._zenInitBrowserLayout();
        this._initSearchBar();
      });
    },

    _zenInitBrowserLayout() {
      if (this.__hasInitBrowserLayout) return;
      this.__hasInitBrowserLayout = true;
      try {
        console.info('ZenThemeModifier: init browser layout');
        const kNavbarItems = ['nav-bar', 'PersonalToolbar'];
        const kNewContainerId = 'zen-appcontent-navbar-container';
        let newContainer = document.getElementById(kNewContainerId);
        for (let id of kNavbarItems) {
          const node = document.getElementById(id);
          console.assert(node, 'Could not find node with id: ' + id);
          if (!node) continue;
          newContainer.appendChild(node);
        }

        // Fix notification deck
        const deckTemplate = document.getElementById('tab-notification-deck-template');
        if (deckTemplate) {
          document.getElementById('zen-appcontent-navbar-container').appendChild(deckTemplate);
        }

        // Disable smooth scroll
        gBrowser.tabContainer.arrowScrollbox.smoothScroll = Services.prefs.getBoolPref(
          'zen.startup.smooth-scroll-in-tabs',
          false
        );

        gZenCompactModeManager.init();
        ZenWorkspaces.init();
        gZenVerticalTabsManager.init();
        gZenUIManager.init();

        document.l10n.setAttributes(document.getElementById('tabs-newtab-button'), 'tabs-toolbar-new-tab');
      } catch (e) {
        console.error('ZenThemeModifier: Error initializing browser layout', e);
      }
      this.closeWatermark();
    },

    openWatermark() {
      if (!Services.prefs.getBoolPref('zen.watermark.enabled', false)) {
        return;
      }
      const watermark = window.MozXULElement.parseXULToFragment(`
        <html:div id="zen-watermark">
          <image src="chrome://branding/content/about-logo.png" />
        </html:div>
      `);
      document.body.appendChild(watermark);
    },

    closeWatermark() {
      const watermark = document.getElementById('zen-watermark');
      if (watermark) {
        watermark.setAttribute('hidden', 'true');
      }
    },

    _changeSidebarLocation() {
      const kElementsToAppend = ['sidebar-splitter', 'sidebar-box'];
      const appWrapepr = document.getElementById('zen-sidebar-box-container');
      appWrapepr.setAttribute('hidden', 'true');

      const browser = document.getElementById('browser');
      const toolbox = document.getElementById('navigator-toolbox');
      browser.prepend(toolbox);

      const sidebarPanelWrapper = document.getElementById('tabbrowser-tabbox');
      for (let id of kElementsToAppend) {
        const elem = document.getElementById(id);
        if (elem) {
          sidebarPanelWrapper.prepend(elem);
        }
      }
    },

    _initSearchBar() {
      // Only focus the url bar
      gURLBar.focus();

      gURLBar._initCopyCutController();
      gURLBar._initPasteAndGo();
      gURLBar._initStripOnShare();
    },
  };

  ZenStartup.init();
}
