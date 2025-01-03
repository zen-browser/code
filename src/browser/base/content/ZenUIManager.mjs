var gZenUIManager = {
  _popupTrackingElements: [],
  _hoverPausedForExpand: false,

  init() {
    document.addEventListener('popupshowing', this.onPopupShowing.bind(this));
    document.addEventListener('popuphidden', this.onPopupHidden.bind(this));
    XPCOMUtils.defineLazyPreferenceGetter(this, 'sidebarHeightThrottle', 'zen.view.sidebar-height-throttle', 500);
    XPCOMUtils.defineLazyPreferenceGetter(
      this,
      'contentElementSeparation',
      'zen.theme.content-element-separation',
      0
    );

    new ResizeObserver(gZenCommonActions.throttle(this.updateTabsToolbar.bind(this), this.sidebarHeightThrottle)).observe(
      document.getElementById('tabbrowser-tabs')
    );

    new ResizeObserver(gZenCommonActions.throttle(gZenCompactModeManager.getAndApplySidebarWidth.bind(gZenCompactModeManager), this.sidebarHeightThrottle)).observe(
      document.getElementById('navigator-toolbox')
    );
  },

  updateTabsToolbar() {
    // Set tabs max-height to the "toolbar-items" height
    const toolbarItems = document.getElementById('tabbrowser-tabs');
    const tabs = document.getElementById('tabbrowser-arrowscrollbox');
    tabs.style.maxHeight = '0px'; // reset to 0
    const toolbarRect = toolbarItems.getBoundingClientRect();
    let height = toolbarRect.height;
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
      if (!el.contains(showEvent.explicitOriginalTarget) || (showEvent.explicitOriginalTarget instanceof Element && showEvent.explicitOriginalTarget?.closest('panel'))) {
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
    this._multiWindowFeature = new ZenMultiWindowFeature();

    ChromeUtils.defineLazyGetter(this, 'isWindowsStyledButtons', () => {
      return !(window.AppConstants.platform === 'macosx' || window.matchMedia('(-moz-gtk-csd-reversed-placement)').matches
        || Services.prefs.getBoolPref('zen.view.experimental-force-window-controls-left'));
    });

    ChromeUtils.defineLazyGetter(this, 'hidesTabsToolbar', () => {
      return (
        document.documentElement.getAttribute('chromehidden').includes('toolbar') ||
        document.documentElement.getAttribute('chromehidden').includes('menubar')
      );
    });

    var updateEvent = this._updateEvent.bind(this);

    this.initializePreferences(updateEvent);
    this._toolbarOriginalParent = document.getElementById('nav-bar').parentElement;

    gZenCompactModeManager.addEventListener(updateEvent);
    this.initRightSideOrderContextMenu();

    window.addEventListener('customizationstarting', this._preCustomize.bind(this));
    window.addEventListener('aftercustomization', this._postCustomize.bind(this));

    window.addEventListener('DOMContentLoaded', updateEvent, { once: true });

    const tabs = document.getElementById('tabbrowser-tabs');

    XPCOMUtils.defineLazyPreferenceGetter(this, 'canOpenTabOnMiddleClick', 'zen.tabs.newtab-on-middle-click', true);

    if (!this.isWindowsStyledButtons) {
      document.documentElement.setAttribute("zen-window-buttons-reversed", true);
    }

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

  toggleExpand() {
    const newVal = !Services.prefs.getBoolPref('zen.view.sidebar-expanded');
    Services.prefs.setBoolPref('zen.view.sidebar-expanded', newVal);
  },

  get navigatorToolbox() {
    if (this._navigatorToolbox) {
      return this._navigatorToolbox;
    }
    this._navigatorToolbox = document.getElementById('navigator-toolbox');
    return this._navigatorToolbox;
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

  get _topButtonsSeparatorElement() {
    if (this.__topButtonsSeparatorElement) {
      return this.__topButtonsSeparatorElement;
    }
    this.__topButtonsSeparatorElement = document.createElement('div');
    this.__topButtonsSeparatorElement.id = 'zen-sidebar-top-buttons-separator';
    this.__topButtonsSeparatorElement.setAttribute('skipintoolbarset', 'true');
    return this.__topButtonsSeparatorElement;
  },

  get actualWindowButtons() {
    // we have multiple ".titlebar-buttonbox-container" in the DOM, because of the titlebar
    if (!this.__actualWindowButtons) {
      this.__actualWindowButtons = (!this.isWindowsStyledButtons) ?
          document.querySelector('.titlebar-buttonbox-container') : // TODO: test if it works 100% of the time
          document.querySelector('#nav-bar .titlebar-buttonbox-container');
    }
    return this.__actualWindowButtons;
  },

  async _preCustomize() {
    await this._multiWindowFeature.foreachWindowAsActive(async (browser) => {
      browser.gZenVerticalTabsManager._updateEvent({ forCustomizableMode: true, dontRebuildAreas: true });
    });
    this.rebuildAreas();
    this.navigatorToolbox.setAttribute('zen-sidebar-expanded', 'true');
    document.documentElement.setAttribute('zen-sidebar-expanded', 'true'); // force expanded sidebar
  },

  _postCustomize() {
    // No need to use `await` here, because the customization is already done
    this._multiWindowFeature.foreachWindowAsActive(async (browser) => {
      browser.gZenVerticalTabsManager._updateEvent({ dontRebuildAreas: true });
    });
  },

  initializePreferences(updateEvent) {
    XPCOMUtils.defineLazyPreferenceGetter(
      this,
      "_prefsCompactMode",
      "zen.view.compact",
      false
      // no need to update the event, it's handled by the compact mode manager
    );

    XPCOMUtils.defineLazyPreferenceGetter(
      this,
      "_prefsVerticalTabs",
      "zen.tabs.vertical",
      true,
      updateEvent
    );
    XPCOMUtils.defineLazyPreferenceGetter(
      this,
      "_prefsRightSide",
      "zen.tabs.vertical.right-side",
      false,
      updateEvent
    );
    XPCOMUtils.defineLazyPreferenceGetter(
      this,
      "_prefsUseSingleToolbar",
      "zen.view.use-single-toolbar",
      false,
      updateEvent
    );
    XPCOMUtils.defineLazyPreferenceGetter(
      this,
      "_prefsSidebarExpanded",
      "zen.view.sidebar-expanded",
      false,
      updateEvent
    );
    XPCOMUtils.defineLazyPreferenceGetter(
      this,
      "_prefsSidebarExpandedMaxWidth",
      "zen.view.sidebar-expanded.max-width",
      300,
      updateEvent
    );
  },

  _updateEvent({ forCustomizableMode = false, dontRebuildAreas = false } = {}) {
    if (this._isUpdating) {
      return;
    }
    this._isUpdating = true;
    try {
      this._updateMaxWidth();

      window.docShell.treeOwner
        .QueryInterface(Ci.nsIInterfaceRequestor)
        .getInterface(Ci.nsIAppWindow)
        .rollupAllPopups();

      const topButtons = document.getElementById('zen-sidebar-top-buttons');
      const isCompactMode = this._prefsCompactMode && !forCustomizableMode;
      const isVerticalTabs = this._prefsVerticalTabs || forCustomizableMode;
      const isSidebarExpanded = this._prefsSidebarExpanded || !isVerticalTabs;
      const isRightSide = this._prefsRightSide && isVerticalTabs;
      const isSingleToolbar = ((this._prefsUseSingleToolbar && (isVerticalTabs && isSidebarExpanded) )|| !isVerticalTabs) && !forCustomizableMode && !this.hidesTabsToolbar;
      const titlebar = document.getElementById('titlebar');

      gBrowser.tabContainer.setAttribute('orient', isVerticalTabs ? 'vertical' : 'horizontal');
      gBrowser.tabContainer.arrowScrollbox.setAttribute('orient', isVerticalTabs ? 'vertical' : 'horizontal');

      const buttonsTarget = document.getElementById('zen-sidebar-top-buttons-customization-target');
      if (isRightSide) {
        this.navigatorToolbox.setAttribute('zen-right-side', 'true');
        document.documentElement.setAttribute('zen-right-side', 'true');
      } else {
        this.navigatorToolbox.removeAttribute('zen-right-side');
        document.documentElement.removeAttribute('zen-right-side');
      }

      if (isSidebarExpanded) {
        this.navigatorToolbox.setAttribute('zen-sidebar-expanded', 'true');
        document.documentElement.setAttribute('zen-sidebar-expanded', 'true');
      } else {
        this.navigatorToolbox.removeAttribute('zen-sidebar-expanded');
        document.documentElement.removeAttribute('zen-sidebar-expanded');
      }

      const appContentNavbarContaienr = document.getElementById('zen-appcontent-navbar-container');
      let shouldHide = false;
      if (((!isRightSide && this.isWindowsStyledButtons) || (isRightSide && !this.isWindowsStyledButtons)
        || (
          isCompactMode && isSingleToolbar && this.isWindowsStyledButtons
        )) && isSingleToolbar) {
        appContentNavbarContaienr.setAttribute('should-hide', 'true');
        shouldHide = true;
      } else {
        appContentNavbarContaienr.removeAttribute('should-hide');
      }

      // Check if the sidebar is in hover mode
      if (
        !this.navigatorToolbox.hasAttribute('zen-right-side') &&
        !isCompactMode
      ) {
        this.navigatorToolbox.prepend(topButtons);
      }

      let windowButtons = this.actualWindowButtons;
      let doNotChangeWindowButtons = !isCompactMode && isRightSide && this.isWindowsStyledButtons;
      const navBar = document.getElementById('nav-bar');

      if (isSingleToolbar) {
        this._navbarParent = navBar.parentElement;
        let elements = document.querySelectorAll('#nav-bar-customization-target > :is([cui-areatype="toolbar"], .chromeclass-toolbar-additional):not(#urlbar-container)');
        elements = Array.from(elements).reverse();
        // Add separator if it doesn't exist
        if (!buttonsTarget.contains(this._topButtonsSeparatorElement)) {
          buttonsTarget.append(this._topButtonsSeparatorElement);
        }
        for (const button of elements) {
          this._topButtonsSeparatorElement.after(button);
        }
        buttonsTarget.prepend(document.getElementById('unified-extensions-button'));
        buttonsTarget.prepend(document.getElementById('PanelUI-button'));
        if (this.isWindowsStyledButtons && !doNotChangeWindowButtons) {
          appContentNavbarContaienr.append(windowButtons);
        }
        if (isCompactMode) {
          titlebar.prepend(navBar);
          titlebar.prepend(topButtons);
        } else {
          titlebar.before(topButtons);
          titlebar.before(navBar);
        }
        document.documentElement.setAttribute("zen-single-toolbar", true);
        this._hasSetSingleToolbar = true;
      } else if (this._hasSetSingleToolbar) {
        this._hasSetSingleToolbar = false;
        // Do the opposite
        this._navbarParent.prepend(navBar);
        const elements = document.querySelectorAll('#zen-sidebar-top-buttons-customization-target > :is([cui-areatype="toolbar"], .chromeclass-toolbar-additional)');
        for (const button of elements) {
          document.getElementById('nav-bar-customization-target').append(button);
        }
        this._topButtonsSeparatorElement.remove();
        document.documentElement.removeAttribute("zen-single-toolbar");
        navBar.appendChild(document.getElementById('PanelUI-button'));
        this._toolbarOriginalParent.prepend(navBar);
        if (!dontRebuildAreas) {
          this.rebuildAreas();
        }
      }

      if (isCompactMode) {
        titlebar.prepend(topButtons);
      } else {
        if (isSidebarExpanded) {
          titlebar.before(topButtons);
        } else {
          titlebar.prepend(topButtons);
        }
      }

      // Case: single toolbar, not compact mode, not right side and macos styled buttons
      if (!doNotChangeWindowButtons && isSingleToolbar && !isCompactMode && !isRightSide && !this.isWindowsStyledButtons) {
        topButtons.prepend(windowButtons);
      }
      // Case: single toolbar, compact mode, right side and windows styled buttons
      if (isSingleToolbar && isCompactMode && isRightSide && this.isWindowsStyledButtons) {
        topButtons.prepend(windowButtons);
      }

      if (doNotChangeWindowButtons) {
        if (isRightSide && !isSidebarExpanded) {
          navBar.appendChild(windowButtons);
        } else {
          document.getElementById("zen-sidebar-top-buttons-customization-target").appendChild(windowButtons);
        }
      } else if (!isSingleToolbar && !isCompactMode) {
        if (this.isWindowsStyledButtons) {
          if (isRightSide) {
            appContentNavbarContaienr.append(windowButtons);
          } else {
            navBar.append(windowButtons);
          }
        } else { // not windows styled buttons
          if (isRightSide || !isSidebarExpanded) {
            navBar.prepend(windowButtons);
          } else {
            topButtons.prepend(windowButtons);
          }
        }
      } else if (!isSingleToolbar && isCompactMode) {
        navBar.appendChild(windowButtons);
      } else if (isSingleToolbar && isCompactMode) {
        if (!isRightSide && !this.isWindowsStyledButtons) {
          topButtons.prepend(windowButtons);
        }
      }

      if (shouldHide) {
        appContentNavbarContaienr.append(windowButtons);
      }

      gZenCompactModeManager.updateCompactModeContext(isSingleToolbar);

      // Always move the splitter next to the sidebar
      this.navigatorToolbox.after(document.getElementById('zen-sidebar-splitter'));
    } catch (e) {
      console.error(e);
    }
    this._isUpdating = false;
  },

  rebuildAreas() {
    CustomizableUI.zenInternalCU._rebuildRegisteredAreas(/* zenDontRebuildCollapsed */ true);
  },

  _updateMaxWidth() {
    const maxWidth = Services.prefs.getIntPref('zen.view.sidebar-expanded.max-width');
    const toolbox = document.getElementById('navigator-toolbox');
    if (!this._prefsCompactMode) {
      toolbox.style.maxWidth = `${maxWidth}px`;
    } else {
      toolbox.style.removeProperty('maxWidth');
    }
  },

  get expandButton() {
    if (this._expandButton) {
      return this._expandButton;
    }
    this._expandButton = document.getElementById('zen-expand-sidebar-button');
    return this._expandButton;
  },

  toggleTabsOnRight() {
    const newVal = !Services.prefs.getBoolPref('zen.tabs.vertical.right-side');
    Services.prefs.setBoolPref('zen.tabs.vertical.right-side', newVal);
  },
};
