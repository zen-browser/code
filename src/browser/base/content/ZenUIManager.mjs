var gZenUIManager = {
  _popupTrackingElements: [],
  _hoverPausedForExpand: false,
  _hasLoadedDOM: false,

  init() {
    document.addEventListener('popupshowing', this.onPopupShowing.bind(this));
    document.addEventListener('popuphidden', this.onPopupHidden.bind(this));
    XPCOMUtils.defineLazyPreferenceGetter(this, 'sidebarHeightThrottle', 'zen.view.sidebar-height-throttle', 500);
    XPCOMUtils.defineLazyPreferenceGetter(this, 'contentElementSeparation', 'zen.theme.content-element-separation', 0);

    ChromeUtils.defineLazyGetter(this, 'motion', () => {
      return ChromeUtils.importESModule('chrome://browser/content/zen-vendor/motion.min.mjs', { global: 'current' });
    });

    new ResizeObserver(gZenCommonActions.throttle(this.updateTabsToolbar.bind(this), this.sidebarHeightThrottle)).observe(
      document.getElementById('TabsToolbar')
    );

    new ResizeObserver(
      gZenCommonActions.throttle(
        gZenCompactModeManager.getAndApplySidebarWidth.bind(gZenCompactModeManager),
        this.sidebarHeightThrottle
      )
    ).observe(document.getElementById('navigator-toolbox'));

    SessionStore.promiseAllWindowsRestored.then(() => {
      this._hasLoadedDOM = true;
    });

    window.addEventListener('TabClose', this.onTabClose.bind(this));
    this.tabsWrapper.addEventListener('scroll', this.saveScrollbarState.bind(this));
  },

  updateTabsToolbar() {
    // Set tabs max-height to the "toolbar-items" height
    const tabs = document.getElementById('zen-browser-tabs-wrapper');
    // Remove tabs so we can accurately calculate the height
    // without them affecting the height of the toolbar
    for (const tab of gBrowser.tabs) {
      if (tab.hasAttribute('zen-essential')) {
        continue;
      }
      tab.style.maxHeight = '0px';
    }
    tabs.style.flex = '1';
    tabs.style.removeProperty('max-height');
    const toolbarRect = tabs.getBoundingClientRect();
    let height = toolbarRect.height;
    for (const tab of gBrowser.tabs) {
      if (tab.hasAttribute('zen-essential')) {
        continue;
      }
      tab.style.removeProperty('max-height');
    }
    tabs.style.removeProperty('flex');
    tabs.style.maxHeight = height + 'px';
  },

  get tabsWrapper() {
    if (this._tabsWrapper) {
      return this._tabsWrapper;
    }
    this._tabsWrapper = document.getElementById('zen-browser-tabs-wrapper');
    return this._tabsWrapper;
  },

  saveScrollbarState() {
    this._scrollbarState = this.tabsWrapper.scrollTop;
  },

  restoreScrollbarState() {
    this.tabsWrapper.scrollTop = this._scrollbarState;
  },

  onTabClose(event) {
    this.updateTabsToolbar();
    this.restoreScrollbarState();
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
    return Services.uuid.generateUUID().toString();
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
      if (
        !el.contains(showEvent.explicitOriginalTarget) ||
        (showEvent.explicitOriginalTarget instanceof Element && showEvent.explicitOriginalTarget?.closest('panel'))
      ) {
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

  _prevUrlbarLabel: null,
  _lastSearch: '',

  handleNewTab(werePassedURL, searchClipboard, where) {
    const shouldOpenURLBar =
      Services.prefs.getBoolPref('zen.urlbar.replace-newtab') && !werePassedURL && !searchClipboard && where === 'tab';
    if (shouldOpenURLBar) {
      this._prevUrlbarLabel = gURLBar._untrimmedValue;
      gURLBar._zenHandleUrlbarClose = this.handleUrlbarClose.bind(this);
      gURLBar.setAttribute('zen-newtab', true);
      document.getElementById('Browser:OpenLocation').doCommand();
      gURLBar.search(this._lastSearch);
      return true;
    }
    return false;
  },

  handleUrlbarClose(onSwitch) {
    gURLBar._zenHandleUrlbarClose = null;
    gURLBar.removeAttribute('zen-newtab');
    if (onSwitch) {
      this._prevUrlbarLabel = null;
      this._lastSearch = '';
    } else {
      this._lastSearch = gURLBar._untrimmedValue;
    }
    gURLBar.setURI(this._prevUrlbarLabel, false, false, false, true);
    gURLBar.handleRevert();
    if (gURLBar.focused) {
      gURLBar.view.close({ elementPicked: onSwitch });
      gURLBar.updateTextOverflow();
      if (gBrowser.selectedTab.linkedBrowser && onSwitch) {
        gURLBar.getBrowserState(gBrowser.selectedTab.linkedBrowser).urlbarFocused = false;
      }
    }
  },
};

var gZenVerticalTabsManager = {
  _tabEdited: null,
  init() {
    this._multiWindowFeature = new ZenMultiWindowFeature();
    this._initWaitPromise();

    ChromeUtils.defineLazyGetter(this, 'isWindowsStyledButtons', () => {
      return !(
        window.AppConstants.platform === 'macosx' ||
        window.matchMedia('(-moz-gtk-csd-reversed-placement)').matches ||
        Services.prefs.getBoolPref('zen.view.experimental-force-window-controls-left')
      );
    });

    ChromeUtils.defineLazyGetter(this, 'hidesTabsToolbar', () => {
      return (
        document.documentElement.getAttribute('chromehidden').includes('toolbar') ||
        document.documentElement.getAttribute('chromehidden').includes('menubar')
      );
    });

    var updateEvent = this._updateEvent.bind(this);
    var onPrefChange = this._onPrefChange.bind(this);

    this.initializePreferences(onPrefChange);
    this._toolbarOriginalParent = document.getElementById('nav-bar').parentElement;

    gZenCompactModeManager.addEventListener(updateEvent);
    this.initRightSideOrderContextMenu();

    window.addEventListener('customizationstarting', this._preCustomize.bind(this));
    window.addEventListener('aftercustomization', this._postCustomize.bind(this));

    window.addEventListener('DOMContentLoaded', updateEvent, { once: true });

    const tabs = document.getElementById('tabbrowser-tabs');

    XPCOMUtils.defineLazyPreferenceGetter(this, 'canOpenTabOnMiddleClick', 'zen.tabs.newtab-on-middle-click', true);

    if (!this.isWindowsStyledButtons) {
      document.documentElement.setAttribute('zen-window-buttons-reversed', true);
    }

    if (tabs) {
      tabs.addEventListener('mouseup', this.openNewTabOnTabsMiddleClick.bind(this));
    }

    this._insertDoubleClickListenerPinnedTabs();
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
    this.__topButtonsSeparatorElement = document.getElementById('zen-sidebar-top-buttons-separator');
    return this.__topButtonsSeparatorElement;
  },

  animateTab(aTab) {
    if (!gZenUIManager.motion || !aTab || !gZenUIManager._hasLoadedDOM) {
      return;
    }
    // get next visible tab
    const isLastTab = () => {
      const visibleTabs = gBrowser.visibleTabs;
      return visibleTabs[visibleTabs.length - 1] === aTab;
    };

    const tabSize = aTab.getBoundingClientRect().height;
    const transform = `-${tabSize}px`;
    gZenUIManager.motion
      .animate(
        aTab,
        {
          opacity: [0, 1],
          transform: ['scale(0.95)', 'scale(1)'],
          marginBottom: isLastTab() ? [] : [transform, '0px'],
        },
        {
          duration: 0.2,
          easing: 'ease-out',
        }
      )
      .then(() => {
        aTab.style.removeProperty('margin-bottom');
        aTab.style.removeProperty('transform');
        aTab.style.removeProperty('opacity');
      });
    gZenUIManager.motion
      .animate(aTab.querySelector('.tab-content'), {
        filter: ['blur(1px)', 'blur(0px)'],
      })
      .then(() => {
        aTab.querySelector('.tab-stack').style.removeProperty('filter');
      });
  },

  get actualWindowButtons() {
    // we have multiple ".titlebar-buttonbox-container" in the DOM, because of the titlebar
    if (!this.__actualWindowButtons) {
      this.__actualWindowButtons = !this.isWindowsStyledButtons
        ? document.querySelector('.titlebar-buttonbox-container') // TODO: test if it works 100% of the time
        : document.querySelector('#nav-bar .titlebar-buttonbox-container');
      this.__actualWindowButtons.setAttribute('overflows', 'false');
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
    XPCOMUtils.defineLazyPreferenceGetter(this, '_prefsVerticalTabs', 'zen.tabs.vertical', true, updateEvent);
    XPCOMUtils.defineLazyPreferenceGetter(this, '_prefsRightSide', 'zen.tabs.vertical.right-side', false, updateEvent);
    XPCOMUtils.defineLazyPreferenceGetter(this, '_prefsUseSingleToolbar', 'zen.view.use-single-toolbar', false, updateEvent);
    XPCOMUtils.defineLazyPreferenceGetter(this, '_prefsSidebarExpanded', 'zen.view.sidebar-expanded', false, updateEvent);
    XPCOMUtils.defineLazyPreferenceGetter(
      this,
      '_prefsSidebarExpandedMaxWidth',
      'zen.view.sidebar-expanded.max-width',
      300,
      updateEvent
    );
  },

  _initWaitPromise() {
    this._waitPromise = new Promise((resolve) => {
      this._resolveWaitPromise = resolve;
    });
  },

  async _onPrefChange() {
    this._resolveWaitPromise();

    // only run if we are in the active window
    await this._multiWindowFeature.foreachWindowAsActive(async (browser) => {
      if (browser.gZenVerticalTabsManager._multiWindowFeature.windowIsActive(browser)) {
        return;
      }
      await browser.gZenVerticalTabsManager._waitPromise;
      browser.gZenVerticalTabsManager._updateEvent({ dontRebuildAreas: true });
      browser.gZenVerticalTabsManager._initWaitPromise();
    });

    if (ZenMultiWindowFeature.isActiveWindow) {
      this._updateEvent();
      this._initWaitPromise();
    }
  },

  _updateEvent({ forCustomizableMode = false, dontRebuildAreas = false } = {}) {
    if (this._isUpdating) {
      return;
    }
    this._isUpdating = true;
    try {
      this._updateMaxWidth();

      if (window.docShell) {
        window.docShell.treeOwner.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIAppWindow).rollupAllPopups();
      }

      const topButtons = document.getElementById('zen-sidebar-top-buttons');
      const isCompactMode = gZenCompactModeManager.preference && !forCustomizableMode;
      const isVerticalTabs = this._prefsVerticalTabs || forCustomizableMode;
      const isSidebarExpanded = this._prefsSidebarExpanded || !isVerticalTabs;
      const isRightSide = this._prefsRightSide && isVerticalTabs;
      const isSingleToolbar =
        ((this._prefsUseSingleToolbar && isVerticalTabs && isSidebarExpanded) || !isVerticalTabs) &&
        !forCustomizableMode &&
        !this.hidesTabsToolbar;
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
      if (
        ((!isRightSide && this.isWindowsStyledButtons) ||
          (isRightSide && !this.isWindowsStyledButtons) ||
          (isCompactMode && isSingleToolbar && this.isWindowsStyledButtons)) &&
        isSingleToolbar
      ) {
        appContentNavbarContaienr.setAttribute('should-hide', 'true');
        shouldHide = true;
      } else {
        appContentNavbarContaienr.removeAttribute('should-hide');
      }

      // Check if the sidebar is in hover mode
      if (!this.navigatorToolbox.hasAttribute('zen-right-side') && !isCompactMode) {
        this.navigatorToolbox.prepend(topButtons);
      }

      let windowButtons = this.actualWindowButtons;
      let doNotChangeWindowButtons = !isCompactMode && isRightSide && this.isWindowsStyledButtons;
      const navBar = document.getElementById('nav-bar');

      if (isSingleToolbar) {
        this._navbarParent = navBar.parentElement;
        let elements = document.querySelectorAll(
          '#nav-bar-customization-target > :is([cui-areatype="toolbar"], .chromeclass-toolbar-additional):not(#urlbar-container):not(toolbarspring)'
        );
        elements = Array.from(elements).reverse();
        // Add separator if it doesn't exist
        if (!buttonsTarget.contains(this._topButtonsSeparatorElement)) {
          buttonsTarget.append(this._topButtonsSeparatorElement);
        }
        for (const button of elements) {
          this._topButtonsSeparatorElement.after(button);
        }
        buttonsTarget.prepend(document.getElementById('unified-extensions-button'));
        const panelUIButton = document.getElementById('PanelUI-button');
        buttonsTarget.prepend(panelUIButton);
        panelUIButton.setAttribute('overflows', 'false');
        buttonsTarget.parentElement.append(document.getElementById('nav-bar-overflow-button'));
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
        document.documentElement.setAttribute('zen-single-toolbar', true);
        this._hasSetSingleToolbar = true;
      } else if (this._hasSetSingleToolbar) {
        this._hasSetSingleToolbar = false;
        // Do the opposite
        this._navbarParent.prepend(navBar);
        const elements = document.querySelectorAll(
          '#zen-sidebar-top-buttons-customization-target > :is([cui-areatype="toolbar"], .chromeclass-toolbar-additional)'
        );
        for (const button of elements) {
          document.getElementById('nav-bar-customization-target').append(button);
        }
        this._topButtonsSeparatorElement.remove();
        document.documentElement.removeAttribute('zen-single-toolbar');
        const panelUIButton = document.getElementById('PanelUI-button');
        navBar.appendChild(panelUIButton);
        panelUIButton.removeAttribute('overflows');
        navBar.appendChild(document.getElementById('nav-bar-overflow-button'));
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
          topButtons.appendChild(windowButtons);
        }
      } else if (!isSingleToolbar && !isCompactMode) {
        if (this.isWindowsStyledButtons) {
          if (isRightSide) {
            appContentNavbarContaienr.append(windowButtons);
          } else {
            navBar.append(windowButtons);
          }
        } else {
          // not windows styled buttons
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
      window.dispatchEvent(new Event('resize'));
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

  appendCustomizableItem(target, child, placements) {
    if (
      target.id === 'zen-sidebar-top-buttons-customization-target' &&
      this._hasSetSingleToolbar &&
      placements.includes(child.id)
    ) {
      return this._topButtonsSeparatorElement.before(child);
    }
    target.appendChild(child);
  },

  _insertDoubleClickListenerPinnedTabs() {
    const tabs = gBrowser.tabs;
    for (const tab of tabs) {
      tab.addEventListener('dblclick', this.renameTabStart.bind(this));
    }
  },

  renameTabKeydown(event) {
    if (event.key === 'Enter') {
      let label = this._tabEdited.querySelector('.tab-label-container-editing');
      let input = this._tabEdited.querySelector('#tab-label-input');
      let newName = input.value.trim();

      // Check if name is blank, reset if so
      if (newName) {
        this._tabEdited.label = newName;
        this._tabEdited.setAttribute('zen-has-static-label', 'true');
      } else {
        // If the page is loaded, get the title of the page. Otherwise, keep name as is
        this._tabEdited.label = gBrowser.getBrowserForTab(this._tabEdited).contentTitle || this._tabEdited.label;
        // If the page had a title, reset the zen-has-static-label attribute
        if (gBrowser.getBrowserForTab(this._tabEdited).contentTitle) {
          this._tabEdited.removeAttribute('zen-has-static-label');
        }
      }

      this._tabEdited.querySelector('.tab-editor-container').remove();
      label.style.display = '';
      label.className = label.className.replace(' tab-label-container-editing', '');
      document.removeEventListener('click', this.renameTabHalt.bind(this));

      this._tabEdited = null;
    } else if (event.key === 'Escape') {
      let label = this._tabEdited.querySelector('.tab-label-container-editing');
      this._tabEdited.querySelector('.tab-editor-container').remove();

      label.style.display = '';
      label.className = label.className.replace(' tab-label-container-editing', '');
      document.removeEventListener('click', this.renameTabHalt.bind(this));
      this._tabEdited = null;
    }
  },

  renameTabStart(event) {
    if (this._tabEdited) return;
    this._tabEdited = event.target.closest('.tabbrowser-tab');
    if (!this._tabEdited.pinned) {
      this._tabEdited = null;
      return;
    }
    const label = this._tabEdited.querySelector('.tab-label-container');
    label.style.display = 'none';
    label.className += ' tab-label-container-editing';

    const container = window.MozXULElement.parseXULToFragment(`
      <vbox class="tab-label-container tab-editor-container" flex="1" align="start" pack="center"></vbox>
    `);
    label.after(container);
    const containerHtml = this._tabEdited.querySelector('.tab-editor-container');
    const input = document.createElement('input');
    input.id = 'tab-label-input';
    input.value = this._tabEdited.label;
    input.addEventListener('keydown', this.renameTabKeydown.bind(this));
    input.style['white-space'] = 'nowrap';
    input.style['overflow-x'] = 'scroll';
    input.style['margin'] = '0';

    containerHtml.appendChild(input);
    input.focus();
    input.select();

    document.addEventListener('click', this.renameTabHalt.bind(this));
  },

  renameTabHalt(event) {
    // Ignore click event if it's clicking the input
    if (event.target.closest('#tab-label-input')) {
      return;
    }
    if (!this._tabEdited) {
      return;
    }
    this._tabEdited.querySelector('.tab-editor-container').remove();
    const label = this._tabEdited.querySelector('.tab-label-container-editing');
    label.style.display = '';
    label.className = label.className.replace(' tab-label-container-editing', '');

    document.removeEventListener('click', this.renameTabHalt.bind(this));
    this._tabEdited = null;
  },
};
