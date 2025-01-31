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

        this._initSidebarScrolling();

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

    _initSidebarScrolling() {
      // Disable smooth scroll
      const canSmoothScroll = Services.prefs.getBoolPref('zen.startup.smooth-scroll-in-tabs', false);
      const workspaceIndicator = document.getElementById('zen-current-workspace-indicator');
      const tabsWrapper = document.getElementById('zen-browser-tabs-wrapper');
      gBrowser.tabContainer.addEventListener('wheel', (event) => {
        if (canSmoothScroll) return;
        event.preventDefault(); // Prevent the smooth scroll behavior
        gBrowser.tabContainer.scrollTop += event.deltaY * 20; // Apply immediate scroll
      });
      // Detect overflow and underflow
      const observer = new ResizeObserver((_) => {
        const tabContainer = gBrowser.tabContainer;
        const isVertical = tabContainer.getAttribute('orient') === 'vertical';
        let contentSize = tabsWrapper.getBoundingClientRect()[isVertical ? 'height' : 'width'];
        // NOTE: This should be contentSize > scrollClientSize, but due
        // to how Gecko internally rounds in those cases, we allow for some
        // minor differences (the internal Gecko layout size is 1/60th of a
        // pixel, so 0.02 should cover it).
        let overflowing = contentSize - tabContainer.arrowScrollbox.scrollClientSize > 0.02;

        window.requestAnimationFrame(() => {
          tabContainer.arrowScrollbox.toggleAttribute('overflowing', overflowing);
          tabContainer.arrowScrollbox.dispatchEvent(new CustomEvent(overflowing ? 'overflow' : 'underflow'));
        });
      });
      observer.observe(tabsWrapper);
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
