var TabStateInternal = {
  collect(tab) {
    let tabData = Object.create(null, {
      entries: { value: [], enumerable: true, writable: true },
      lastAccessed: { value: tab.lastAccessed, enumerable: true },
      hidden: { value: tab.hidden, enumerable: true },
      attributes: { value: {}, enumerable: true },
      image: { value: tab.image, enumerable: true },
      index: { value: null, enumerable: true, writable: true },
    });

    // Ensure that the tab state always has an index property
    // set to null. This property is updated after a state is
    // collected for all tabs.
    tabData.index = null;

    // Save hidden and muted state.
    if (tab.closing) {
      tabData.closing = true;
    }

    let browser = tab.linkedBrowser;
    if (browser) {
      if (tab.hasAttribute("muted")) {
        tabData.muted = tab.muted;
      } else if (browser.audioMuted) {
        tabData.muted = true;
      }

      // If the tab is currently loading, we may not have a valid
      // URL to store. In this case we'll use the current URL.
      if (tab.hasAttribute("busy")) {
        tabData.userTypedValue = browser.userTypedValue;
        tabData.userTypedClear = browser.userTypedClear;
      }

      // If the tab is currently zoomed, store the zoom.
      let zoom = browser.fullZoom;
      if (zoom && Math.abs(zoom - 1) > 0.01) {
        tabData.zoom = { resolution: zoom, displayValue: 100 };
      }

      if (browser.hasContentOpener) {
        tabData.hasContentOpener = true;
      }

      // Save tab icon data.
      if (tab._iconData) {
        tabData.iconData = tab._iconData;
      }

      // Save the tab's active state.
      if (tab.selected) {
        tabData.selected = true;
      }

      // Save the tab's last selected state.
      if ("_lastSelected" in browser) {
        tabData._lastSelected = browser._lastSelected;
      }

      // Save the tab's pinned state.
      if (tab.pinned) {
        tabData.pinned = true;
      }

      // Save the tab's mute reason.
      if (tab.muteReason) {
        tabData.muteReason = tab.muteReason;
      }

      tabData.zenWorkspace = tab.getAttribute("zen-workspace-id");
      tabData.zenDefaultUserContextId = tab.getAttribute("zenDefaultUserContextId");
      tabData.zenPinnedEntry = tab.getAttribute("zen-pinned-entry");
      tabData.zenPinnedIcon = tab.getAttribute("zen-pinned-icon");

      tabData.searchMode = tab.ownerGlobal.gURLBar.getSearchMode(browser, true);

      tabData.userContextId = tab.userContextId || 0;
    }

    return tabData;
  },

  // ... rest of the code remains unchanged
};
