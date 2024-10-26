{
  const lazy = {};
  XPCOMUtils.defineLazyPreferenceGetter(lazy, 'sidebarHeightThrottle', 'zen.view.sidebar-height-throttle', 500);
  var ZenStartup = {
    init() {
      this.logHeader();
      this.openWatermark();
      window.SessionStore.promiseInitialized.then(async () => {
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
        document
          .getElementById('zen-appcontent-navbar-container')
          .appendChild(document.getElementById('tab-notification-deck-template'));

        // Disable smooth scroll
        gBrowser.tabContainer.arrowScrollbox.smoothScroll = false;

        // register contextual identity engine
        if (!Weave.Service.engineManager.get('contextualidentities')) {
          Weave.Service.engineManager.register(ZenContextualIdentityEngine);
        }

        ZenWorkspaces.init();
        gZenUIManager.init();
        gZenVerticalTabsManager.init();
        gZenCompactModeManager.init();

        XPCOMUtils.defineLazyPreferenceGetter(
          this,
          'contentElementSeparation',
          'zen.theme.content-element-separation',
          0
        );

        function throttle(f, delay) {
          let timer = 0;
          return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => f.apply(this, args), delay);
          };
        }

        new ResizeObserver(throttle(this._updateTabsToolbar.bind(this), lazy.sidebarHeightThrottle)).observe(
          document.getElementById('tabbrowser-tabs')
        );
      } catch (e) {
        console.error('ZenThemeModifier: Error initializing browser layout', e);
      }
      this.closeWatermark();
    },

    _updateTabsToolbar() {
      // Set tabs max-height to the "toolbar-items" height
      const toolbarItems = document.getElementById('tabbrowser-tabs');
      const tabs = document.getElementById('tabbrowser-arrowscrollbox');
      tabs.style.maxHeight = '0px'; // reset to 0
      const toolbarRect = toolbarItems.getBoundingClientRect();
      // -5 for the controls padding
      let totalHeight = toolbarRect.height - (this.contentElementSeparation * 2) - 5;
      // remove the height from other elements that aren't hidden
      const otherElements = document.querySelectorAll('#tabbrowser-tabs > *:not([hidden="true"])');
      for (let tab of otherElements) {
        if (tabs === tab) continue;
        totalHeight -= tab.getBoundingClientRect().height;
      }
      tabs.style.maxHeight = totalHeight + 'px';
      //console.info('ZenThemeModifier: set tabs max-height to', totalHeight + 'px');
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

      // remove all styles except for the width, since we are xulstoring the complet style list
      const width = toolbox.style.width;
      toolbox.removeAttribute('style');
      toolbox.style.width = width;

      // Set a splitter to navigator-toolbox
      const splitter = document.createXULElement('splitter');
      splitter.setAttribute('id', 'zen-sidebar-splitter');
      splitter.setAttribute('orient', 'horizontal');
      splitter.setAttribute('resizebefore', 'sibling');
      splitter.setAttribute('resizeafter', 'none');
      toolbox.insertAdjacentElement('afterend', splitter);
    },

    _initSearchBar() {
      // Only focus the url bar
      gURLBar.focus();

      gURLBar._initCopyCutController();
      gURLBar._initPasteAndGo();
      gURLBar._initStripOnShare();
    },

    logHeader() {
      console.info(`

    Welcome to Zen Browser!

  If you are seeing this message, it means that you have successfully opened Zen's developer console.
  Here you can see all the logs and errors that Zen is generating.

  If you have any questions or need help, please contact us in any media in https://zen-browser.app/

  Note: This developer console is not the same as the browser console, it has access to Zen's internal functions and variables, including your passwords and other sensitive information. Please do not paste any code here unless you know what you are doing.

  `);
    },
  };

  ZenStartup.init();
}
