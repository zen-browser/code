{
  const lazy = {};

  class ZenPinnedTabsObserver {
    static ALL_EVENTS = ['TabPinned', 'TabUnpinned'];

    #listeners = [];

    constructor() {
      XPCOMUtils.defineLazyPreferenceGetter(lazy, 'zenPinnedTabRestorePinnedTabsToPinnedUrl', 'zen.pinned-tab-manager.restore-pinned-tabs-to-pinned-url', false);
      XPCOMUtils.defineLazyPreferenceGetter(lazy, 'zenPinnedTabCloseShortcutBehavior', 'zen.pinned-tab-manager.close-shortcut-behavior', 'switch');
      ChromeUtils.defineESModuleGetters(lazy, {E10SUtils: "resource://gre/modules/E10SUtils.sys.mjs"});
      this.#listenPinnedTabEvents();
    }

    #listenPinnedTabEvents() {
      const eventListener = this.#eventListener.bind(this);
      for (const event of ZenPinnedTabsObserver.ALL_EVENTS) {
        window.addEventListener(event, eventListener);
      }
      window.addEventListener('unload', () => {
        for (const event of ZenPinnedTabsObserver.ALL_EVENTS) {
          window.removeEventListener(event, eventListener);
        }
      });
    }

    #eventListener(event) {
      for (const listener of this.#listeners) {
        listener(event.type, event);
      }
    }

    addPinnedTabListener(listener) {
      this.#listeners.push(listener);
    }
  }

  class ZenPinnedTabManager extends ZenPreloadedFeature {

    init() {
      if (!this.enabled) {
        return;
      }
      this.observer = new ZenPinnedTabsObserver();
      this._initClosePinnedTabShortcut();
      this._insertItemsIntoTabContextMenu();
      this.observer.addPinnedTabListener(this._onPinnedTabEvent.bind(this));

      this._zenClickEventListener = this._onTabClick.bind(this);
    }

    async initTabs() {
      if (!this.enabled) {
        return;
      }
      await ZenPinnedTabsStorage.init();
    }

    get enabled() {
      if (typeof this._enabled === 'undefined') {
        this._enabled = !(
          document.documentElement.hasAttribute('privatebrowsingmode') ||
          document.documentElement.getAttribute('chromehidden')?.includes('toolbar') ||
          document.documentElement.getAttribute('chromehidden')?.includes('menubar')
        );
      }
      return this._enabled;
    }

    async _refreshPinnedTabs() {
      await this._initializePinsCache();
      this._initializePinnedTabs();
    }

    async _initializePinsCache() {
      try {
        // Get pin data
        const pins = await ZenPinnedTabsStorage.getPins();

        // Enhance pins with favicons
        const enhancedPins = await Promise.all(pins.map(async pin => {
          try {
            const faviconData = await PlacesUtils.promiseFaviconData(pin.url);
            return {
              ...pin,
              iconUrl: faviconData?.uri?.spec || null
            };
          } catch(ex) {
            // If favicon fetch fails, continue without icon
            return {
              ...pin,
              iconUrl: null
            };
          }
        }));

        this._pinsCache = enhancedPins.sort((a, b) => {
          if (!a.workspaceUuid && b.workspaceUuid) return -1;
          if (a.workspaceUuid && !b.workspaceUuid) return 1;
          return 0;
        });

      } catch (ex) {
        console.error("Failed to initialize pins cache:", ex);
        this._pinsCache = [];
      }

      return this._pinsCache;
    }

    _initializePinnedTabs() {
      const pins = this._pinsCache;
      if (!pins?.length) {
        return;
      }

      const activeTab = gBrowser.selectedTab;
      const pinnedTabsByUUID = new Map();
      const pinsToCreate = new Set(pins.map(p => p.uuid));

      // First pass: identify existing tabs and remove those without pins
      for (let tab of gBrowser.tabs) {
        const pinId = tab.getAttribute("zen-pin-id");
        if (!pinId) {
          continue;
        }

        if (pinsToCreate.has(pinId)) {
          // This is a valid pinned tab that matches a pin
          pinnedTabsByUUID.set(pinId, tab);
          pinsToCreate.delete(pinId);
        } else {
          // This is a pinned tab that no longer has a corresponding pin
          gBrowser.removeTab(tab);
        }
      }

      // Second pass: create new tabs for pins that don't have tabs
      for (let pin of pins) {
        if (!pinsToCreate.has(pin.uuid)) {
          continue; // Skip pins that already have tabs
        }

        let newTab = gBrowser.addTrustedTab(pin.url, {
          skipAnimation: true,
          userContextId: pin.containerTabId || 0,
          allowInheritPrincipal: false,
          createLazyBrowser: true,
          skipLoad: true,
        });

        // Set the favicon from cache
        if (!!pin.iconUrl) {
          // TODO: Figure out if there is a better way -
          //  calling gBrowser.setIcon messes shit up and should be avoided. I think this works for now.
          newTab.setAttribute("image", pin.iconUrl);
        }

        newTab.setAttribute("zen-pin-id", pin.uuid);
        gBrowser.setInitialTabTitle(newTab, pin.title);

        if (pin.workspaceUuid) {
          newTab.setAttribute("zen-workspace-id", pin.workspaceUuid);
        }

        if (pin.isEssential) {
          newTab.setAttribute("zen-essential", "true");
        }

        gBrowser.pinTab(newTab);
      }

      // Restore active tab
      if (!activeTab.closing) {
        gBrowser.selectedTab = activeTab;
      }
    }

    _onPinnedTabEvent(action, event) {
      if (!this.enabled) return;
      const tab = event.target;
      switch (action) {
        case "TabPinned":
          tab._zenClickEventListener = this._zenClickEventListener;
          tab.addEventListener("click", tab._zenClickEventListener);
          this._setPinnedAttributes(tab);
          break;
        case "TabUnpinned":
          this._removePinnedAttributes(tab);
          if (tab._zenClickEventListener) {
            tab.removeEventListener("click", tab._zenClickEventListener);
            delete tab._zenClickEventListener;
          }
          break;
        default:
          console.warn('ZenPinnedTabManager: Unhandled tab event', action);
          break;
      }
    }

    _onTabClick(e) {
      const tab = e.target?.closest("tab");
      if (e.button === 1 && tab) {
        this._onCloseTabShortcut(e, tab);
      }
    }

    async resetPinnedTab(tab) {

      if (!tab) {
        tab = TabContextMenu.contextTab;
      }

      if (!tab || !tab.pinned) {
        return;
      }

      await this._resetTabToStoredState(tab);
    }

    async replacePinnedUrlWithCurrent() {
      const tab = TabContextMenu.contextTab;
      if (!tab || !tab.pinned || !tab.getAttribute("zen-pin-id")) {
        return;
      }

      const browser = tab.linkedBrowser;

      const pin = this._pinsCache.find(pin => pin.uuid === tab.getAttribute("zen-pin-id"));

      if (!pin) {
        return;
      }

      const userContextId = tab.getAttribute("usercontextid");

      pin.title = tab.label || browser.contentTitle;
      pin.url = browser.currentURI.spec;
      pin.workspaceUuid = tab.getAttribute("zen-workspace-id");
      pin.userContextId = userContextId ? parseInt(userContextId, 10) : 0;

      await ZenPinnedTabsStorage.savePin(pin);
      await this._refreshPinnedTabs();
    }

    async _setPinnedAttributes(tab) {

      if (tab.hasAttribute("zen-pin-id")) {
        return;
      }

      const browser = tab.linkedBrowser;

      const uuid = gZenUIManager.generateUuidv4();
      const userContextId = tab.getAttribute("usercontextid");

      let entry = null;

      if(tab.getAttribute("zen-pinned-entry")) {
        entry = JSON.parse(tab.getAttribute("zen-pinned-entry"));
      }

      await ZenPinnedTabsStorage.savePin({
        uuid,
        title: entry?.title || tab.label || browser.contentTitle,
        url: entry?.url || browser.currentURI.spec,
        containerTabId: userContextId ? parseInt(userContextId, 10) : 0,
        workspaceUuid: tab.getAttribute("zen-workspace-id"),
        isEssential: tab.getAttribute("zen-essential") === "true"
      });

      tab.setAttribute("zen-pin-id", uuid);

      // This is used while migrating old pins to new system - we don't want to refresh when migrating
      if (tab.getAttribute("zen-pinned-entry")) {
        tab.removeAttribute("zen-pinned-entry");
        return;
      }

      await this._refreshPinnedTabs();
    }

    async _removePinnedAttributes(tab, isClosing = false) {
      if(!tab.getAttribute("zen-pin-id")) {
        return;
      }

      await ZenPinnedTabsStorage.removePin(tab.getAttribute("zen-pin-id"));

      if(!isClosing) {
        tab.removeAttribute("zen-pin-id");

        if (!tab.hasAttribute("zen-workspace-id") && ZenWorkspaces.workspaceEnabled) {
          const workspace = await ZenWorkspaces.getActiveWorkspace();
          tab.setAttribute("zen-workspace-id", workspace.uuid);
        }
      }

      await this._refreshPinnedTabs();
    }

    _initClosePinnedTabShortcut() {
      let cmdClose = document.getElementById('cmd_close');

      if (cmdClose) {
        cmdClose.addEventListener('command', this._onCloseTabShortcut.bind(this));
      }
    }

    _onCloseTabShortcut(event, selectedTab = gBrowser.selectedTab) {
      if (
          !selectedTab?.pinned
      ) {
        return;
      }

      event.stopPropagation();
      event.preventDefault();

      const behavior = lazy.zenPinnedTabCloseShortcutBehavior;

      switch (behavior) {
        case 'close':
          this._removePinnedAttributes(selectedTab, true);
          gBrowser.removeTab(selectedTab, { animate: true });
          break;
        case 'reset-unload-switch':
        case 'unload-switch':
        case 'reset-switch':
        case 'switch':
          this._handleTabSwitch(selectedTab);
          if (behavior.includes('reset')) {
            this._resetTabToStoredState(selectedTab);
          }
          if (behavior.includes('unload')) {
            gBrowser.discardBrowser(selectedTab);
          }
          break;
        case 'reset':
          this._resetTabToStoredState(selectedTab);
          break;
        default:
          return;
      }
    }

    _handleTabSwitch(selectedTab) {
      if(selectedTab !== gBrowser.selectedTab) {
        return;
      }
      const findNextTab = (direction) =>
          gBrowser.tabContainer.findNextTab(selectedTab, {
            direction,
            filter: tab => !tab.hidden && !tab.pinned,
          });

      let nextTab = findNextTab(1) || findNextTab(-1);

      if (!nextTab) {
        ZenWorkspaces._createNewTabForWorkspace({ uuid: ZenWorkspaces.activeWorkspace  });

        nextTab = findNextTab(1) || findNextTab(-1);
      }

      if (nextTab) {
        gBrowser.selectedTab = nextTab;
      }
    }

    async _resetTabToStoredState(tab) {
      const id = tab.getAttribute("zen-pin-id");

      if (!id) {
        return;
      }

      const pin = this._pinsCache.find(pin => pin.uuid === id);

      if (pin) {
        const tabState = SessionStore.getTabState(tab);
        const state = JSON.parse(tabState);
        let icon = undefined;
        try {
          icon = await PlacesUtils.promiseFaviconData(pin.url);
        } catch (e) {
          console.warn("Error trying to get favicon for pinned tab", e);
        }

        state.entries = [{
          url: pin.url,
          title: pin.title,
          triggeringPrincipal_base64: lazy.E10SUtils.SERIALIZED_SYSTEMPRINCIPAL
        }];
        if (icon instanceof Ci.nsIURI || typeof icon === "string") {
          state.image = icon;
        } else {
          state.image = null;
        }
        state.index = 0;

        SessionStore.setTabState(tab, state);
      }
    }

    addToEssentials() {
      const tabs = TabContextMenu.contextTab.multiselected ? gBrowser.selectedTabs : [TabContextMenu.contextTab];
      for (let i = 0; i < tabs.length; i++) {
        const tab = tabs[i];
        tab.setAttribute("zen-essential", "true");
        if(tab.hasAttribute("zen-workspace-id")) {
          tab.removeAttribute("zen-workspace-id");
        }
        if (tab.pinned) {
          gBrowser.unpinTab(tab);
        }
        gBrowser.pinTab(tab);
      }
    }

    removeEssentials() {
      const tabs = TabContextMenu.contextTab.multiselected ? gBrowser.selectedTabs : [TabContextMenu.contextTab];
      for (let i = 0; i < tabs.length; i++) {
        const tab = tabs[i];
        tab.removeAttribute("zen-essential");
        if(ZenWorkspaces.workspaceEnabled && ZenWorkspaces.getActiveWorkspaceFromCache.uuid) {
          tab.setAttribute("zen-workspace-id", ZenWorkspaces.getActiveWorkspaceFromCache.uuid);
        }
        gBrowser.unpinTab(tab);
      }
    }

    _insertItemsIntoTabContextMenu() {
      const elements = window.MozXULElement.parseXULToFragment(`
            <menuseparator id="context_zen-pinned-tab-separator" hidden="true"/>
            <menuitem id="context_zen-replace-pinned-url-with-current"
                      data-lazy-l10n-id="tab-context-zen-replace-pinned-url-with-current"
                      hidden="true"
                      oncommand="gZenPinnedTabManager.replacePinnedUrlWithCurrent();"/>
            <menuitem id="context_zen-reset-pinned-tab"
                      data-lazy-l10n-id="tab-context-zen-reset-pinned-tab"
                      hidden="true"
                      oncommand="gZenPinnedTabManager.resetPinnedTab();"/>
        `);
      document.getElementById('tabContextMenu').appendChild(elements);

      const element = window.MozXULElement.parseXULToFragment(`
            <menuitem id="context_zen-add-essential"
                      data-lazy-l10n-id="tab-context-zen-add-essential"
                      hidden="true"
                      oncommand="gZenPinnedTabManager.addToEssentials();"/>
            <menuitem id="context_zen-remove-essential"
                      data-lazy-l10n-id="tab-context-zen-remove-essential"
                      hidden="true"
                      oncommand="gZenPinnedTabManager.removeEssentials();"/>
        `);

      document.getElementById('context_pinTab')?.after(element);
    }

    // TODO: remove this as it's not possible to know the base pinned url any more as it's now stored in tab state
    resetPinnedTabData(tabData) {
      if (lazy.zenPinnedTabRestorePinnedTabsToPinnedUrl && tabData.pinned && tabData.zenPinnedEntry) {
        tabData.entries = [JSON.parse(tabData.zenPinnedEntry)];
        tabData.image = tabData.zenPinnedIcon;
        tabData.index = 0;
      }
    }

    updatePinnedTabContextMenu(contextTab) {
      if (!this.enabled) {
        return;
      }
      const isVisible = contextTab.pinned  && !contextTab.multiselected;
      document.getElementById("context_zen-reset-pinned-tab").hidden = !isVisible || !contextTab.getAttribute("zen-pin-id");
      document.getElementById("context_zen-replace-pinned-url-with-current").hidden = !isVisible;
      document.getElementById("context_zen-add-essential").hidden = contextTab.getAttribute("zen-essential");
      document.getElementById("context_zen-remove-essential").hidden = !contextTab.getAttribute("zen-essential");
      document.getElementById("context_unpinTab").hidden = document.getElementById("context_unpinTab").hidden || contextTab.getAttribute("zen-essential");
      document.getElementById("context_unpinSelectedTabs").hidden = document.getElementById("context_unpinSelectedTabs").hidden || contextTab.getAttribute("zen-essential");
      document.getElementById("context_zen-pinned-tab-separator").hidden = !isVisible;
    }
  }

  window.gZenPinnedTabManager = new ZenPinnedTabManager();
}