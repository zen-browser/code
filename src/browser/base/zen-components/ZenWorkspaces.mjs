var ZenWorkspaces = new (class extends ZenMultiWindowFeature {
  /**
   * Stores workspace IDs and their last selected tabs.
   */
  _lastSelectedWorkspaceTabs = {};
  _inChangingWorkspace = false;
  draggedElement = null;

  _swipeState = {
    isGestureActive: true,
    cumulativeDelta: 0,
    direction: null,
  };
  _lastScrollTime = 0;
  bookmarkMenus = [
    'PlacesToolbar',
    'bookmarks-menu-button',
    'BMB_bookmarksToolbar',
    'BMB_unsortedBookmarks',
    'BMB_mobileBookmarks',
  ];

  promiseDBInitialized = new Promise((resolve) => {
    this._resolveDBInitialized = resolve;
  });

  promisePinnedInitialized = new Promise((resolve) => {
    this._resolvePinnedInitialized = resolve;
  });

  async waitForPromises() {
    await Promise.all([this.promiseDBInitialized, this.promisePinnedInitialized, SessionStore.promiseAllWindowsRestored]);
  }

  async init() {
    if (!this.shouldHaveWorkspaces) {
      document.getElementById('zen-current-workspace-indicator').setAttribute('hidden', 'true');
      console.warn('ZenWorkspaces: !!! ZenWorkspaces is disabled in hidden windows !!!');
      return; // We are in a hidden window, don't initialize ZenWorkspaces
    }

    this.ownerWindow = window;
    XPCOMUtils.defineLazyPreferenceGetter(this, 'activationMethod', 'zen.workspaces.scroll-modifier-key', 'ctrl');
    XPCOMUtils.defineLazyPreferenceGetter(this, 'naturalScroll', 'zen.workspaces.natural-scroll', true);
    XPCOMUtils.defineLazyPreferenceGetter(this, 'shouldWrapAroundNavigation', 'zen.workspaces.wrap-around-navigation', true);
    XPCOMUtils.defineLazyPreferenceGetter(
      this,
      'shouldShowIconStrip',
      'zen.workspaces.show-icon-strip',
      true,
      this._expandWorkspacesStrip.bind(this)
    );
    XPCOMUtils.defineLazyPreferenceGetter(
      this,
      'shouldForceContainerTabsToWorkspace',
      'zen.workspaces.force-container-workspace',
      true
    );
    XPCOMUtils.defineLazyPreferenceGetter(
      this,
      'shouldOpenNewTabIfLastUnpinnedTabIsClosed',
      'zen.workspaces.open-new-tab-if-last-unpinned-tab-is-closed',
      false
    );
    XPCOMUtils.defineLazyPreferenceGetter(
      this,
      'containerSpecificEssentials',
      'zen.workspaces.container-specific-essentials-enabled',
      false
    );
    ChromeUtils.defineLazyGetter(this, 'tabContainer', () => document.getElementById('tabbrowser-tabs'));
    this._activeWorkspace = Services.prefs.getStringPref('zen.workspaces.active', '');
    this._delayedStartup();
  }

  async _delayedStartup() {
    if (!this.workspaceEnabled) {
      return;
    }
    await this.waitForPromises();
    await this.initializeWorkspaces();
    console.info('ZenWorkspaces: ZenWorkspaces initialized');

    if (Services.prefs.getBoolPref('zen.workspaces.swipe-actions', false) && this.workspaceEnabled) {
      this.initializeGestureHandlers();
      this.initializeWorkspaceNavigation();
    }

    Services.obs.addObserver(this, 'weave:engine:sync:finish');
    Services.obs.addObserver(
      async function observe(subject) {
        this._workspaceBookmarksCache = null;
        await this.workspaceBookmarks();
        this._invalidateBookmarkContainers();
      }.bind(this),
      'workspace-bookmarks-updated'
    );
  }

  initializeWorkspaceNavigation() {
    this._setupAppCommandHandlers();
    this._setupSidebarHandlers();
  }

  _setupAppCommandHandlers() {
    // Remove existing handler temporarily - this is needed so that _handleAppCommand is called before the original
    window.removeEventListener('AppCommand', HandleAppCommandEvent, true);

    // Add our handler first
    window.addEventListener('AppCommand', this._handleAppCommand.bind(this), true);

    // Re-add original handler
    window.addEventListener('AppCommand', HandleAppCommandEvent, true);
  }

  get _hoveringSidebar() {
    return document.getElementById('navigator-toolbox').hasAttribute('zen-has-hover');
  }

  _handleAppCommand(event) {
    if (!this.workspaceEnabled || !this._hoveringSidebar) {
      return;
    }

    const direction = this.naturalScroll ? -1 : 1;
    // event is forward or back
    switch (event.command) {
      case 'Forward':
        this.changeWorkspaceShortcut(1 * direction);
        event.stopImmediatePropagation();
        event.preventDefault();
        break;
      case 'Back':
        this.changeWorkspaceShortcut(-1 * direction);
        event.stopImmediatePropagation();
        event.preventDefault();
        break;
    }
  }

  _setupSidebarHandlers() {
    const toolbox = document.getElementById('navigator-toolbox');

    const scrollCooldown = 200; // Milliseconds to wait before allowing another scroll
    const scrollThreshold = 2; // Minimum scroll delta to trigger workspace change

    toolbox.addEventListener(
      'wheel',
      async (event) => {
        if (!this.workspaceEnabled) return;

        // Only process non-gesture scrolls
        if (event.deltaMode !== 1) return;

        const isVerticalScroll = event.deltaY && !event.deltaX;
        const isHorizontalScroll = event.deltaX && !event.deltaY;

        //if the scroll is vertical this checks that a modifier key is used before proceeding
        if (isVerticalScroll) {
          const activationKeyMap = {
            ctrl: event.ctrlKey,
            alt: event.altKey,
            shift: event.shiftKey,
            meta: event.metaKey,
          };

          if (this.activationMethod in activationKeyMap && !activationKeyMap[this.activationMethod]) {
            return;
          }
        }

        const currentTime = Date.now();
        if (currentTime - this._lastScrollTime < scrollCooldown) return;

        //this decides which delta to use
        const delta = isVerticalScroll ? event.deltaY : event.deltaX;
        if (Math.abs(delta) < scrollThreshold) return;

        // Determine scroll direction
        let rawDirection = delta > 0 ? 1 : -1;

        let direction = this.naturalScroll ? -1 : 1;
        this.changeWorkspaceShortcut(rawDirection * direction);

        this._lastScrollTime = currentTime;
      },
      { passive: true }
    );
  }

  initializeGestureHandlers() {
    const elements = [
      document.getElementById('navigator-toolbox'),
      // event handlers do not work on elements inside shadow DOM so we need to attach them directly
      document.getElementById('tabbrowser-arrowscrollbox').shadowRoot.querySelector('scrollbox'),
    ];

    // Attach gesture handlers to each element
    for (const element of elements) {
      if (!element) continue;

      this.attachGestureHandlers(element);
    }
  }

  attachGestureHandlers(element) {
    element.addEventListener('MozSwipeGestureMayStart', this._handleSwipeMayStart.bind(this), true);
    element.addEventListener('MozSwipeGestureStart', this._handleSwipeStart.bind(this), true);
    element.addEventListener('MozSwipeGestureUpdate', this._handleSwipeUpdate.bind(this), true);
    element.addEventListener('MozSwipeGestureEnd', this._handleSwipeEnd.bind(this), true);
  }

  _handleSwipeMayStart(event) {
    if (!this.workspaceEnabled) return;

    // Only handle horizontal swipes
    if (event.direction === event.DIRECTION_LEFT || event.direction === event.DIRECTION_RIGHT) {
      event.preventDefault();
      event.stopPropagation();

      // Set allowed directions based on available workspaces
      event.allowedDirections |= event.DIRECTION_LEFT | event.DIRECTION_RIGHT;
    }
  }

  _handleSwipeStart(event) {
    if (!this.workspaceEnabled) return;

    event.preventDefault();
    event.stopPropagation();

    this._swipeState = {
      isGestureActive: true,
      cumulativeDelta: 0,
      direction: null,
    };
  }

  _handleSwipeUpdate(event) {
    if (!this.workspaceEnabled || !this._swipeState?.isGestureActive) return;

    event.preventDefault();
    event.stopPropagation();

    // Update cumulative delta
    this._swipeState.cumulativeDelta += event.delta;

    // Determine swipe direction based on cumulative delta
    if (Math.abs(this._swipeState.cumulativeDelta) > 1.5) {
      this._swipeState.direction = this._swipeState.cumulativeDelta > 0 ? 'left' : 'right';
    }

    // Apply a translateX to the tab strip to give the user feedback on the swipe
    const stripWidth = document.getElementById('tabbrowser-tabs').scrollWidth;
    // To make the animation larger, we multiply the delta by 5
    let translateX = this._swipeState.cumulativeDelta * 10;
    if (this._swipeState.direction === 'left') {
      translateX = Math.min(translateX, stripWidth);
    } else {
      translateX = Math.max(translateX, -stripWidth);
    }
    for (const element of this._animateTabsElements) {
      element.style.transform = `translateX(${translateX}px)`;
    }
  }

  async _handleSwipeEnd(event) {
    if (!this.workspaceEnabled || !this._swipeState?.isGestureActive) return;
    event.preventDefault();
    event.stopPropagation();
    const isRTL = document.documentElement.matches(':-moz-locale-dir(rtl)');
    const moveForward = (this._swipeState.direction === 'right') !== isRTL;

    let rawDirection = moveForward ? 1 : -1;
    if (this._swipeState.direction) {
      let direction = this.naturalScroll ? -1 : 1;
      this.changeWorkspaceShortcut(rawDirection * direction);
    } else {
      this._cancelSwipeAnimation();
    }

    // Reset swipe state
    this._swipeState = {
      isGestureActive: false,
      cumulativeDelta: 0,
      direction: null,
    };
  }

  get activeWorkspace() {
    return this._activeWorkspace;
  }

  set activeWorkspace(value) {
    this._activeWorkspace = value;
    Services.prefs.setStringPref('zen.workspaces.active', value);
  }

  async observe(subject, topic, data) {
    if (topic === 'weave:engine:sync:finish' && data === 'workspaces') {
      try {
        const lastChangeTimestamp = await ZenWorkspacesStorage.getLastChangeTimestamp();

        if (
          !this._workspaceCache ||
          !this._workspaceCache.lastChangeTimestamp ||
          lastChangeTimestamp > this._workspaceCache.lastChangeTimestamp
        ) {
          await this._propagateWorkspaceData();

          const currentWorkspace = await this.getActiveWorkspace();
          await gZenThemePicker.onWorkspaceChange(currentWorkspace);
        }
      } catch (error) {
        console.error('Error updating workspaces after sync:', error);
      }
    }
  }

  get shouldHaveWorkspaces() {
    if (typeof this._shouldHaveWorkspaces === 'undefined') {
      let docElement = document.documentElement;
      this._shouldHaveWorkspaces = !(
        docElement.hasAttribute('privatebrowsingmode') ||
        docElement.getAttribute('chromehidden').includes('toolbar') ||
        docElement.getAttribute('chromehidden').includes('menubar')
      );
      return this._shouldHaveWorkspaces;
    }
    return this._shouldHaveWorkspaces;
  }

  get workspaceEnabled() {
    if (typeof this._workspaceEnabled === 'undefined') {
      this._workspaceEnabled =
        !Services.prefs.getBoolPref('zen.workspaces.disabled_for_testing', false) && this.shouldHaveWorkspaces;
      return this._workspaceEnabled;
    }
    return this._workspaceEnabled;
  }

  getActiveWorkspaceFromCache() {
    try {
      return this._workspaceCache.workspaces.find((workspace) => workspace.uuid === this.activeWorkspace);
    } catch (e) {
      return null;
    }
  }

  async _workspaces() {
    if (this._workspaceCache) {
      return this._workspaceCache;
    }

    const [workspaces, lastChangeTimestamp] = await Promise.all([
      ZenWorkspacesStorage.getWorkspaces(),
      ZenWorkspacesStorage.getLastChangeTimestamp(),
    ]);

    this._workspaceCache = { workspaces, lastChangeTimestamp };
    // Get the active workspace ID from preferences
    const activeWorkspaceId = this.activeWorkspace;

    if (activeWorkspaceId) {
      const activeWorkspace = this._workspaceCache.workspaces.find((w) => w.uuid === activeWorkspaceId);
      // Set the active workspace ID to the first one if the one with selected id doesn't exist
      if (!activeWorkspace) {
        this.activeWorkspace = this._workspaceCache.workspaces[0]?.uuid;
      }
    } else {
      // Set the active workspace ID to the first one if active workspace doesn't exist
      this.activeWorkspace = this._workspaceCache.workspaces[0]?.uuid;
    }
    // sort by position
    this._workspaceCache.workspaces.sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity));

    return this._workspaceCache;
  }

  async workspaceBookmarks() {
    if (this._workspaceBookmarksCache) {
      return this._workspaceBookmarksCache;
    }

    const [bookmarks, lastChangeTimestamp] = await Promise.all([
      ZenWorkspaceBookmarksStorage.getBookmarkGuidsByWorkspace(),
      ZenWorkspaceBookmarksStorage.getLastChangeTimestamp(),
    ]);

    this._workspaceBookmarksCache = { bookmarks, lastChangeTimestamp };

    return this._workspaceCache;
  }

  async initializeWorkspaces() {
    await this.initializeWorkspacesButton();
    if (this.workspaceEnabled) {
      this._initializeWorkspaceCreationIcons();
      this._initializeWorkspaceTabContextMenus();
      await this.workspaceBookmarks();
      window.addEventListener('TabBrowserInserted', this.onTabBrowserInserted.bind(this));
      let workspaces = await this._workspaces();
      let activeWorkspace = null;
      if (workspaces.workspaces.length === 0) {
        activeWorkspace = await this.createAndSaveWorkspace('Default Workspace', true, '🏠');
      } else {
        activeWorkspace = await this.getActiveWorkspace();
        if (!activeWorkspace) {
          activeWorkspace = workspaces.workspaces.find((workspace) => workspace.default);
          this.activeWorkspace = activeWorkspace?.uuid;
        }
        if (!activeWorkspace) {
          activeWorkspace = workspaces.workspaces[0];
          this.activeWorkspace = activeWorkspace?.uuid;
        }
      }
      try {
        if (activeWorkspace) {
          window.gZenThemePicker = new ZenThemePicker();
          await this.changeWorkspace(activeWorkspace, { onInit: true });
        }
      } catch (e) {
        console.error('ZenWorkspaces: Error initializing theme picker', e);
      }
    }
    this.initIndicatorContextMenu();
  }

  initIndicatorContextMenu() {
    const indicator = document.getElementById('zen-current-workspace-indicator');
    const th = (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.openWorkspacesDialog(event);
    };
    indicator.addEventListener('contextmenu', th);
    indicator.addEventListener('click', th);
  }

  shouldCloseWindow() {
    return !window.toolbar.visible || Services.prefs.getBoolPref('browser.tabs.closeWindowWithLastTab');
  }

  handleTabBeforeClose(tab) {
    if (!this.workspaceEnabled || this.__contextIsDelete) {
      return null;
    }

    let workspaceID = tab.getAttribute('zen-workspace-id');
    if (!workspaceID) {
      return null;
    }

    let tabs = gBrowser.visibleTabs;
    let tabsPinned = tabs.filter((t) => !this.shouldOpenNewTabIfLastUnpinnedTabIsClosed || !t.pinned);

    const shouldCloseWindow = this.shouldCloseWindow();
    if (tabs.length === 1 && tabs[0] === tab) {
      if (shouldCloseWindow) {
        // We've already called beforeunload on all the relevant tabs if we get here,
        // so avoid calling it again:
        window.skipNextCanClose = true;

        // Closing the tab and replacing it with a blank one is notably slower
        // than closing the window right away. If the caller opts in, take
        // the fast path.
        if (!gBrowser._removingTabs.size) {
          // This call actually closes the window, unless the user
          // cancels the operation.  We are finished here in both cases.
          this._isClosingWindow = true;
          // Inside a setTimeout to avoid reentrancy issues.
          setTimeout(() => {
            document.getElementById('cmd_closeWindow').doCommand();
          }, 100);
          return this._createNewTabForWorkspace({ uuid: workspaceID });
        }
        return null;
      }
    } else if (tabsPinned.length === 1 && tabsPinned[0] === tab) {
      return this._createNewTabForWorkspace({ uuid: workspaceID });
    }

    return null;
  }

  _createNewTabForWorkspace(window) {
    let tab = gZenUIManager.openAndChangeToTab(Services.prefs.getStringPref('browser.startup.homepage'));

    if (window.uuid) {
      tab.setAttribute('zen-workspace-id', window.uuid);
    }
    return tab;
  }

  searchIcons(input, icons) {
    input = input.toLowerCase();

    if (input === ':' || input === '') {
      return icons;
    }
    const emojiScores = [];

    function calculateSearchScore(inputLength, targetLength, weight = 100) {
      return parseInt((inputLength / targetLength) * weight);
    }

    for (let currentEmoji of icons) {
      let alignmentScore = -1;

      let normalizedEmojiName = currentEmoji[1].toLowerCase();
      let keywordList = currentEmoji[2].split(',').map((keyword) => keyword.trim().toLowerCase());
      if (input[0] === ':') {
        let searchTerm = input.slice(1);
        let nameMatchIndex = normalizedEmojiName.indexOf(searchTerm);

        if (nameMatchIndex !== -1 && nameMatchIndex === 0) {
          alignmentScore = calculateSearchScore(searchTerm.length, normalizedEmojiName.length, 100);
        }
      } else {
        if (input === currentEmoji[0]) {
          alignmentScore = 999;
        }
        let nameMatchIndex = normalizedEmojiName.replace(/_/g, ' ').indexOf(input);
        if (nameMatchIndex !== -1) {
          if (nameMatchIndex === 0) {
            alignmentScore = calculateSearchScore(input.length, normalizedEmojiName.length, 150);
          } else if (input[input.length - 1] !== ' ') {
            alignmentScore += calculateSearchScore(input.length, normalizedEmojiName.length, 40);
          }
        }
        for (let keyword of keywordList) {
          let keywordMatchIndex = keyword.indexOf(input);
          if (keywordMatchIndex !== -1) {
            if (keywordMatchIndex === 0) {
              alignmentScore += calculateSearchScore(input.length, keyword.length, 50);
            } else if (input[input.length - 1] !== ' ') {
              alignmentScore += calculateSearchScore(input.length, keyword.length, 5);
            }
          }
        }
      }

      //if match score is not -1, add it
      if (alignmentScore !== -1) {
        emojiScores.push({ emoji: currentEmoji[0], score: alignmentScore });
      }
    }
    // Sort the emojis by their score in descending order
    emojiScores.sort((a, b) => b.score - a.score);

    // Return the emojis in the order of their rank
    let filteredEmojiScores = emojiScores;
    return filteredEmojiScores.map((score) => score.emoji);
  }

  resetWorkspaceIconSearch() {
    let container = document.getElementById('PanelUI-zen-workspaces-icon-picker-wrapper');
    let searchInput = document.getElementById('PanelUI-zen-workspaces-icon-search-input');

    // Clear the search input field
    searchInput.value = '';
    for (let button of container.querySelectorAll('.toolbarbutton-1')) {
      button.style.display = '';
    }
  }

  _initializeWorkspaceCreationIcons() {
    let container = document.getElementById('PanelUI-zen-workspaces-icon-picker-wrapper');
    let searchInput = document.getElementById('PanelUI-zen-workspaces-icon-search-input');
    searchInput.value = '';
    for (let iconData of this.emojis) {
      const icon = iconData[0];
      let button = document.createXULElement('toolbarbutton');
      button.className = 'toolbarbutton-1 workspace-icon-button';
      button.setAttribute('label', icon);
      button.onclick = (event) => {
        const button = event.target;
        let wasSelected = button.hasAttribute('selected');
        for (let button of container.children) {
          button.removeAttribute('selected');
        }
        if (!wasSelected) {
          button.setAttribute('selected', 'true');
        }
        if (this.onIconChangeConnectedCallback) {
          this.onIconChangeConnectedCallback(icon);
        } else {
          this.onWorkspaceIconChangeInner('create', icon);
        }
      };
      container.appendChild(button);
    }
  }

  conductSearch() {
    const container = document.getElementById('PanelUI-zen-workspaces-icon-picker-wrapper');
    const searchInput = document.getElementById('PanelUI-zen-workspaces-icon-search-input');
    const query = searchInput.value.toLowerCase();

    if (query === '') {
      this.resetWorkspaceIconSearch();
      return;
    }

    const buttons = Array.from(container.querySelectorAll('.toolbarbutton-1'));
    buttons.forEach((button) => (button.style.display = 'none'));

    const filteredIcons = this.searchIcons(query, this.emojis);

    filteredIcons.forEach((emoji) => {
      const matchingButton = buttons.find((button) => button.getAttribute('label') === emoji);
      if (matchingButton) {
        matchingButton.style.display = '';
        container.appendChild(matchingButton);
      }
    });
  }

  async saveWorkspace(workspaceData) {
    await ZenWorkspacesStorage.saveWorkspace(workspaceData);
    await this._propagateWorkspaceData();
    await this._updateWorkspacesChangeContextMenu();
  }

  async removeWorkspace(windowID) {
    let workspacesData = await this._workspaces();
    console.info('ZenWorkspaces: Removing workspace', windowID);
    await this.changeWorkspace(workspacesData.workspaces.find((workspace) => workspace.uuid !== windowID));
    this._deleteAllTabsInWorkspace(windowID);
    delete this._lastSelectedWorkspaceTabs[windowID];
    await ZenWorkspacesStorage.removeWorkspace(windowID);
    await this._propagateWorkspaceData();
    await this._updateWorkspacesChangeContextMenu();
  }

  isWorkspaceActive(workspace) {
    return workspace.uuid === this.activeWorkspace;
  }

  async getActiveWorkspace() {
    const workspaces = await this._workspaces();
    return workspaces.workspaces.find((workspace) => workspace.uuid === this.activeWorkspace) ?? workspaces.workspaces[0];
  }
  // Workspaces dialog UI management

  openSaveDialog() {
    let parentPanel = document.getElementById('PanelUI-zen-workspaces-multiview');

    // randomly select an icon
    let icon = this.emojis[Math.floor(Math.random() * (this.emojis.length - 257))][0];
    this._workspaceCreateInput.textContent = '';
    this._workspaceCreateInput.value = '';
    this._workspaceCreateInput.setAttribute('data-initial-value', '');
    document.querySelectorAll('#PanelUI-zen-workspaces-icon-picker-wrapper toolbarbutton').forEach((button) => {
      if (button.label === icon) {
        button.setAttribute('selected', 'true');
      } else {
        button.removeAttribute('selected');
      }
    });
    document.querySelector('.PanelUI-zen-workspaces-icons-container.create').textContent = icon;

    PanelUI.showSubView('PanelUI-zen-workspaces-create', parentPanel);
  }

  async openEditDialog(workspaceUuid) {
    this._workspaceEditDialog.setAttribute('data-workspace-uuid', workspaceUuid);
    document.getElementById('PanelUI-zen-workspaces-edit-save').setAttribute('disabled', 'true');
    let workspaces = (await this._workspaces()).workspaces;
    let workspaceData = workspaces.find((workspace) => workspace.uuid === workspaceUuid);
    this._workspaceEditInput.textContent = workspaceData.name;
    this._workspaceEditInput.value = workspaceData.name;
    this._workspaceEditInput.setAttribute('data-initial-value', workspaceData.name);
    this._workspaceEditIconsContainer.setAttribute('data-initial-value', workspaceData.icon);
    this.onIconChangeConnectedCallback = (...args) => {
      this.onWorkspaceIconChangeInner('edit', ...args);
      this.onWorkspaceEditChange(...args);
    };
    document.querySelectorAll('#PanelUI-zen-workspaces-icon-picker-wrapper toolbarbutton').forEach((button) => {
      if (button.label === workspaceData.icon) {
        button.setAttribute('selected', 'true');
      } else {
        button.removeAttribute('selected');
      }
    });
    document.querySelector('.PanelUI-zen-workspaces-icons-container.edit').textContent = this.getWorkspaceIcon(workspaceData);
    let parentPanel = document.getElementById('PanelUI-zen-workspaces-multiview');
    PanelUI.showSubView('PanelUI-zen-workspaces-edit', parentPanel);
  }

  onWorkspaceIconChangeInner(type = 'create', icon) {
    const container = document.querySelector(`.PanelUI-zen-workspaces-icons-container.${type}`);
    if (container.textContent !== icon) {
      container.textContent = icon;
    }
    this.goToPreviousSubView();
  }

  onWorkspaceIconContainerClick(event) {
    event.preventDefault();
    const parentPanel = document.getElementById('PanelUI-zen-workspaces-edit');
    PanelUI.showSubView('PanelUI-zen-workspaces-icon-picker', parentPanel);

    const container = parentPanel.parentNode.querySelector('.panel-viewcontainer');
    setTimeout(() => {
      if (container) {
        container.style.minHeight = 'unset';
      }
    });
  }

  goToPreviousSubView() {
    const parentPanel = document.getElementById('PanelUI-zen-workspaces-multiview');
    parentPanel.goBack();
  }

  workspaceHasIcon(workspace) {
    return workspace.icon && workspace.icon !== '';
  }

  getWorkspaceIcon(workspace) {
    if (this.workspaceHasIcon(workspace)) {
      return workspace.icon;
    }
    if (typeof Intl.Segmenter !== 'undefined') {
      return new Intl.Segmenter().segment(workspace.name).containing().segment.toUpperCase();
    }
    return Array.from(workspace.name)[0].toUpperCase();
  }

  get shouldShowContainers() {
    return (
      Services.prefs.getBoolPref('privacy.userContext.ui.enabled') && ContextualIdentityService.getPublicIdentities().length > 0
    );
  }

  async _propagateWorkspaceData({ ignoreStrip = false, clearCache = true } = {}) {
    await this.foreachWindowAsActive(async (browser) => {
      // Do not update the window if workspaces are not enabled in it.
      // For example, when the window is in private browsing mode.
      if (!browser.ZenWorkspaces.workspaceEnabled) {
        return;
      }
      await browser.ZenWorkspaces.updateWorkspaceIndicator();
      let workspaceList = browser.document.getElementById('PanelUI-zen-workspaces-list');
      const createWorkspaceElement = (workspace) => {
        let element = browser.document.createXULElement('toolbarbutton');
        element.className = 'subviewbutton zen-workspace-button';
        element.setAttribute('tooltiptext', workspace.name);
        element.setAttribute('zen-workspace-id', workspace.uuid);
        if (this.isWorkspaceActive(workspace)) {
          element.setAttribute('active', 'true');
        }
        if (workspace.default) {
          element.setAttribute('default', 'true');
        }
        let containerGroup = undefined;
        try {
          containerGroup = browser.ContextualIdentityService.getPublicIdentities().find(
            (container) => container.userContextId === workspace.containerTabId
          );
        } catch (e) {
          console.warn('ZenWorkspaces: Error setting container color', e);
        }
        if (containerGroup) {
          element.classList.add('identity-color-' + containerGroup.color);
          element.setAttribute('data-usercontextid', containerGroup.userContextId);
        }
        if (this.isReorderModeOn(browser)) {
          element.setAttribute('draggable', 'true');
        }
        element.addEventListener(
          'dragstart',
          function (event) {
            if (this.isReorderModeOn(browser)) {
              this.draggedElement = element;
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', element.getAttribute('zen-workspace-id'));
              element.classList.add('dragging');
            } else {
              event.preventDefault();
            }
          }.bind(browser.ZenWorkspaces)
        );

        element.addEventListener(
          'dragover',
          function (event) {
            if (this.isReorderModeOn(browser) && this.draggedElement) {
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
            }
          }.bind(browser.ZenWorkspaces)
        );

        element.addEventListener(
          'dragenter',
          function (event) {
            if (this.isReorderModeOn(browser) && this.draggedElement) {
              element.classList.add('dragover');
            }
          }.bind(browser.ZenWorkspaces)
        );

        element.addEventListener(
          'dragleave',
          function (event) {
            element.classList.remove('dragover');
          }.bind(browser.ZenWorkspaces)
        );

        element.addEventListener(
          'drop',
          async function (event) {
            event.preventDefault();
            element.classList.remove('dragover');
            if (this.isReorderModeOn(browser)) {
              const draggedWorkspaceId = event.dataTransfer.getData('text/plain');
              const targetWorkspaceId = element.getAttribute('zen-workspace-id');
              if (draggedWorkspaceId !== targetWorkspaceId) {
                await this.moveWorkspace(draggedWorkspaceId, targetWorkspaceId);
              }
              if (this.draggedElement) {
                this.draggedElement.classList.remove('dragging');
                this.draggedElement = null;
              }
            }
          }.bind(browser.ZenWorkspaces)
        );

        element.addEventListener(
          'dragend',
          function (event) {
            if (this.draggedElement) {
              this.draggedElement.classList.remove('dragging');
              this.draggedElement = null;
            }
            const workspaceElements = browser.document.querySelectorAll('.zen-workspace-button');
            for (const elem of workspaceElements) {
              elem.classList.remove('dragover');
            }
          }.bind(browser.ZenWorkspaces)
        );

        let childs = browser.MozXULElement.parseXULToFragment(`
          <div class="zen-workspace-icon">
          </div>
          <vbox>
            <div class="zen-workspace-name">
            </div>
            <div class="zen-workspace-container" ${containerGroup ? '' : 'hidden="true"'}>
            </div>
          </vbox>
            <image class="toolbarbutton-icon zen-workspace-actions-reorder-icon" ></image>
          <toolbarbutton closemenu="none" class="toolbarbutton-1 zen-workspace-actions">
            <image class="toolbarbutton-icon" id="zen-workspace-actions-menu-icon"></image>
          </toolbarbutton>
        `);

        // use text content instead of innerHTML to avoid XSS
        childs.querySelector('.zen-workspace-icon').textContent = browser.ZenWorkspaces.getWorkspaceIcon(workspace);
        childs.querySelector('.zen-workspace-name').textContent = workspace.name;
        if (containerGroup) {
          childs.querySelector('.zen-workspace-container').textContent = ContextualIdentityService.getUserContextLabel(
            containerGroup.userContextId
          );
        }

        childs.querySelector('.zen-workspace-actions').addEventListener(
          'command',
          ((event) => {
            let button = event.target;
            this._contextMenuId = button.closest('toolbarbutton[zen-workspace-id]').getAttribute('zen-workspace-id');
            const popup = button.ownerDocument.getElementById('zenWorkspaceActionsMenu');
            popup.openPopup(button, 'after_end');
          }).bind(browser.ZenWorkspaces)
        );
        element.appendChild(childs);
        element.onclick = (async () => {
          if (this.isReorderModeOn(browser)) {
            return; // Return early if reorder mode is on
          }
          if (event.target.closest('.zen-workspace-actions')) {
            return; // Ignore clicks on the actions button
          }
          const workspaceId = element.getAttribute('zen-workspace-id');
          const workspaces = await this._workspaces();
          const workspace = workspaces.workspaces.find((w) => w.uuid === workspaceId);
          await this.changeWorkspace(workspace);
          let panel = this.ownerWindow.document.getElementById('PanelUI-zen-workspaces');
          PanelMultiView.hidePopup(panel);
          this.ownerWindow.document.getElementById('zen-workspaces-button').removeAttribute('open');
        }).bind(browser.ZenWorkspaces);
        return element;
      };

      const createLastPositionDropTarget = () => {
        const element = browser.document.createXULElement('div');
        element.className = 'zen-workspace-last-place-drop-target';

        element.addEventListener(
          'dragover',
          function (event) {
            if (this.isReorderModeOn(browser) && this.draggedElement) {
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
            }
          }.bind(browser.ZenWorkspaces)
        );

        element.addEventListener(
          'dragenter',
          function (event) {
            if (this.isReorderModeOn(browser) && this.draggedElement) {
              element.classList.add('dragover');
            }
          }.bind(browser.ZenWorkspaces)
        );

        element.addEventListener(
          'dragleave',
          function (event) {
            element.classList.remove('dragover');
          }.bind(browser.ZenWorkspaces)
        );

        element.addEventListener(
          'drop',
          async function (event) {
            event.preventDefault();
            element.classList.remove('dragover');

            if (this.isReorderModeOn(browser)) {
              const draggedWorkspaceId = event.dataTransfer.getData('text/plain');
              await this.moveWorkspaceToEnd(draggedWorkspaceId);

              if (this.draggedElement) {
                this.draggedElement.classList.remove('dragging');
                this.draggedElement = null;
              }
            }
          }.bind(browser.ZenWorkspaces)
        );

        return element;
      };

      if (clearCache) {
        browser.ZenWorkspaces._workspaceCache = null;
        browser.ZenWorkspaces._workspaceBookmarksCache = null;
      }
      let workspaces = await browser.ZenWorkspaces._workspaces();
      await browser.ZenWorkspaces.workspaceBookmarks();
      workspaceList.innerHTML = '';
      workspaceList.parentNode.style.display = 'flex';
      if (workspaces.workspaces.length <= 0) {
        workspaceList.innerHTML = 'No workspaces available';
        workspaceList.setAttribute('empty', 'true');
      } else {
        workspaceList.removeAttribute('empty');
      }

      for (let workspace of workspaces.workspaces) {
        let workspaceElement = createWorkspaceElement(workspace);
        workspaceList.appendChild(workspaceElement);
      }

      workspaceList.appendChild(createLastPositionDropTarget());

      if (!ignoreStrip) {
        await browser.ZenWorkspaces._expandWorkspacesStrip(browser);
      }
    });
  }

  handlePanelHidden() {
    const workspacesList = document.getElementById('PanelUI-zen-workspaces-list');
    const reorderModeButton = document.getElementById('PanelUI-zen-workspaces-reorder-mode');

    workspacesList?.removeAttribute('reorder-mode');
    reorderModeButton?.removeAttribute('active');
    this.resetWorkspaceIconSearch();
    this.clearEmojis();
  }

  async moveWorkspaceToEnd(draggedWorkspaceId) {
    const workspaces = (await this._workspaces()).workspaces;
    const draggedIndex = workspaces.findIndex((w) => w.uuid === draggedWorkspaceId);
    const draggedWorkspace = workspaces.splice(draggedIndex, 1)[0];
    workspaces.push(draggedWorkspace);

    await ZenWorkspacesStorage.updateWorkspacePositions(workspaces);
    await this._propagateWorkspaceData();
  }

  isReorderModeOn(browser) {
    return browser.document.getElementById('PanelUI-zen-workspaces-list').getAttribute('reorder-mode') === 'true';
  }

  toggleReorderMode() {
    const workspacesList = document.getElementById('PanelUI-zen-workspaces-list');
    const reorderModeButton = document.getElementById('PanelUI-zen-workspaces-reorder-mode');
    const isActive = workspacesList.getAttribute('reorder-mode') === 'true';
    if (isActive) {
      workspacesList.removeAttribute('reorder-mode');
      reorderModeButton.removeAttribute('active');
    } else {
      workspacesList.setAttribute('reorder-mode', 'true');
      reorderModeButton.setAttribute('active', 'true');
    }

    // Update draggable attribute
    const workspaceElements = document.querySelectorAll('.zen-workspace-button');
    workspaceElements.forEach((elem) => {
      if (isActive) {
        elem.removeAttribute('draggable');
      } else {
        elem.setAttribute('draggable', 'true');
      }
    });
  }

  async moveWorkspace(draggedWorkspaceId, targetWorkspaceId) {
    const workspaces = (await this._workspaces()).workspaces;
    const draggedIndex = workspaces.findIndex((w) => w.uuid === draggedWorkspaceId);
    const draggedWorkspace = workspaces.splice(draggedIndex, 1)[0];
    const targetIndex = workspaces.findIndex((w) => w.uuid === targetWorkspaceId);
    workspaces.splice(targetIndex, 0, draggedWorkspace);

    await ZenWorkspacesStorage.updateWorkspacePositions(workspaces);
    await this._propagateWorkspaceData();
  }

  async openWorkspacesDialog(event) {
    if (!this.workspaceEnabled) {
      return;
    }
    let target = event.target.closest('#zen-current-workspace-indicator') || document.getElementById('zen-workspaces-button');
    let panel = document.getElementById('PanelUI-zen-workspaces');
    await this._propagateWorkspaceData({
      ignoreStrip: true,
      clearCache: false,
    });
    PanelMultiView.openPopup(panel, target, {
      position: 'bottomright topright',
      triggerEvent: event,
    }).catch(console.error);
  }

  async initializeWorkspacesButton() {
    if (!this.workspaceEnabled) {
      return;
    } else if (document.getElementById('zen-workspaces-button')) {
      let button = document.getElementById('zen-workspaces-button');
      button.removeAttribute('hidden');
      return;
    }
    await this._expandWorkspacesStrip();
  }

  async _expandWorkspacesStrip(browser = window) {
    if (typeof browser.ZenWorkspaces === 'undefined') {
      browser = window;
    }
    let button = browser.document.getElementById('zen-workspaces-button');

    while (button.firstChild) {
      button.firstChild.remove();
    }

    if (this._workspacesButtonClickListener) {
      button.removeEventListener('click', this._workspacesButtonClickListener);
      this._workspacesButtonClickListener = null;
    }
    if (this._workspaceButtonContextMenuListener) {
      button.removeEventListener('contextmenu', this._workspaceButtonContextMenuListener);
      this._workspaceButtonContextMenuListener = null;
    }

    button.setAttribute('showInPrivateBrowsing', 'false');
    button.setAttribute('tooltiptext', 'Workspaces');
    if (this.shouldShowIconStrip) {
      let workspaces = await this._workspaces();

      for (let workspace of workspaces.workspaces) {
        let workspaceButton = browser.document.createXULElement('toolbarbutton');
        workspaceButton.className = 'subviewbutton';
        workspaceButton.setAttribute('tooltiptext', workspace.name);
        workspaceButton.setAttribute('zen-workspace-id', workspace.uuid);

        if (this.isWorkspaceActive(workspace)) {
          workspaceButton.setAttribute('active', 'true');
        } else {
          workspaceButton.removeAttribute('active');
        }
        if (workspace.default) {
          workspaceButton.setAttribute('default', 'true');
        } else {
          workspaceButton.removeAttribute('default');
        }

        workspaceButton.addEventListener('click', async (event) => {
          if (event.button !== 0) {
            return;
          }
          await this.changeWorkspace(workspace);
        });

        let icon = browser.document.createXULElement('div');
        icon.className = 'zen-workspace-icon';
        icon.textContent = this.getWorkspaceIcon(workspace);
        workspaceButton.appendChild(icon);
        button.appendChild(workspaceButton);
      }

      if (workspaces.workspaces.length <= 1) {
        button.setAttribute('dont-show', true);
      } else {
        button.removeAttribute('dont-show');
      }

      this._workspaceButtonContextMenuListener = (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.openWorkspacesDialog(event);
      };
      button.addEventListener('contextmenu', this._workspaceButtonContextMenuListener.bind(browser.ZenWorkspaces));
    } else {
      let activeWorkspace = await this.getActiveWorkspace();
      if (activeWorkspace) {
        button.setAttribute('as-button', 'true');
        button.classList.add('toolbarbutton-1', 'zen-sidebar-action-button');

        this._workspacesButtonClickListener = browser.ZenWorkspaces.openWorkspacesDialog.bind(browser.ZenWorkspaces);
        button.addEventListener('click', this._workspacesButtonClickListener);

        const wrapper = browser.document.createXULElement('hbox');
        wrapper.className = 'zen-workspace-sidebar-wrapper';

        const icon = browser.document.createXULElement('div');
        icon.className = 'zen-workspace-sidebar-icon';
        icon.textContent = this.getWorkspaceIcon(activeWorkspace);

        const name = browser.document.createXULElement('div');
        name.className = 'zen-workspace-sidebar-name';
        name.textContent = activeWorkspace.name;

        if (!this.workspaceHasIcon(activeWorkspace)) {
          icon.setAttribute('no-icon', 'true');
        }

        wrapper.appendChild(icon);
        wrapper.appendChild(name);

        button.appendChild(wrapper);
      }
    }
  }

  closeWorkspacesSubView() {
    let parentPanel = document.getElementById('PanelUI-zen-workspaces-multiview');
    parentPanel.goBack(parentPanel);
  }

  // Workspaces management

  get _workspaceCreateInput() {
    return document.getElementById('PanelUI-zen-workspaces-create-input');
  }

  get _workspaceEditDialog() {
    return document.getElementById('PanelUI-zen-workspaces-edit');
  }

  get _workspaceEditInput() {
    return document.getElementById('PanelUI-zen-workspaces-edit-input');
  }

  get _workspaceEditIconsContainer() {
    return document.getElementById('PanelUI-zen-workspaces-icon-picker');
  }

  _deleteAllTabsInWorkspace(workspaceID) {
    for (let tab of gBrowser.tabs) {
      if (tab.getAttribute('zen-workspace-id') === workspaceID) {
        gBrowser.removeTab(tab, {
          animate: true,
          skipSessionStore: true,
          closeWindowWithLastTab: false,
        });
      }
    }
  }

  _prepareNewWorkspace(window) {
    document.documentElement.setAttribute('zen-workspace-id', window.uuid);
    let tabCount = 0;
    for (let tab of gBrowser.tabs) {
      const isEssential = tab.getAttribute('zen-essential') === 'true';
      if (!tab.hasAttribute('zen-workspace-id') && !tab.pinned && !isEssential) {
        tab.setAttribute('zen-workspace-id', window.uuid);
        tabCount++;
      }
    }
    if (tabCount === 0) {
      this._createNewTabForWorkspace(window);
    }
  }

  _createNewTabForWorkspace(window) {
    let tab = gZenUIManager.openAndChangeToTab(BROWSER_NEW_TAB_URL);

    if (window.uuid) {
      tab.setAttribute('zen-workspace-id', window.uuid);
    }
  }

  async saveWorkspaceFromCreate() {
    let workspaceName = this._workspaceCreateInput.value;
    if (!workspaceName) {
      return;
    }
    this._workspaceCreateInput.value = '';
    let icon = document.querySelector('#PanelUI-zen-workspaces-icon-picker-wrapper [selected]');
    icon?.removeAttribute('selected');
    await this.createAndSaveWorkspace(workspaceName, false, icon?.label);
    this.goToPreviousSubView();
  }

  async saveWorkspaceFromEdit() {
    let workspaceUuid = this._workspaceEditDialog.getAttribute('data-workspace-uuid');
    let workspaceName = this._workspaceEditInput.value;
    if (!workspaceName) {
      return;
    }
    this._workspaceEditInput.value = '';
    let icon = document.querySelector('#PanelUI-zen-workspaces-icon-picker-wrapper [selected]');
    icon?.removeAttribute('selected');
    let workspaces = (await this._workspaces()).workspaces;
    let workspaceData = workspaces.find((workspace) => workspace.uuid === workspaceUuid);
    workspaceData.name = workspaceName;
    workspaceData.icon = icon?.label;
    await this.saveWorkspace(workspaceData);
    this.goToPreviousSubView();
  }

  onWorkspaceCreationNameChange(event) {
    let button = document.getElementById('PanelUI-zen-workspaces-create-save');
    if (this._workspaceCreateInput.value === '') {
      button.setAttribute('disabled', 'true');
      return;
    }
    button.removeAttribute('disabled');
  }

  onWorkspaceEditChange(icon) {
    let button = document.getElementById('PanelUI-zen-workspaces-edit-save');
    let name = this._workspaceEditInput.value;
    if (
      name === this._workspaceEditInput.getAttribute('data-initial-value') &&
      icon === this._workspaceEditIconsContainer.getAttribute('data-initial-value')
    ) {
      button.setAttribute('disabled', 'true');
      return;
    }
    button.removeAttribute('disabled');
  }

  addChangeListeners(func) {
    if (!this._changeListeners) {
      this._changeListeners = [];
    }
    this._changeListeners.push(func);
  }

  async changeWorkspace(window, ...args) {
    if (!this.workspaceEnabled || this._inChangingWorkspace) {
      return;
    }

    await SessionStore.promiseInitialized;
    this._inChangingWorkspace = true;
    try {
      await this._performWorkspaceChange(window, ...args);
    } finally {
      this._inChangingWorkspace = false;
      this.tabContainer.removeAttribute('dont-animate-tabs');
    }
  }

  _cancelSwipeAnimation() {
    const existingTransform = this._animateTabsElements[0].style.transform;
    const newTransform = 'translateX(0)';
    for (const element of this._animateTabsElements) {
      gZenUIManager.motion.animate(
        element,
        {
          transform: existingTransform ? [existingTransform, newTransform] : newTransform,
        },
        {
          type: 'spring',
          bounce: 0,
          duration: 0.12,
        }
      );
    }
  }

  async _performWorkspaceChange(window, { onInit = false, explicitAnimationDirection = undefined } = {}) {
    const previousWorkspace = await this.getActiveWorkspace();

    if (previousWorkspace && previousWorkspace.uuid === window.uuid && !onInit) {
      this._cancelSwipeAnimation();
      return;
    }

    this.activeWorkspace = window.uuid;
    const containerId = window.containerTabId?.toString();
    const workspaces = await this._workspaces();

    // Refresh tab cache
    this.tabContainer._invalidateCachedTabs();

    let animationDirection;
    if (previousWorkspace && !onInit && !this._animatingChange) {
      animationDirection =
        explicitAnimationDirection ??
        (workspaces.workspaces.findIndex((w) => w.uuid === previousWorkspace.uuid) <
        workspaces.workspaces.findIndex((w) => w.uuid === window.uuid)
          ? 'right'
          : 'left');
    }
    if (animationDirection) {
      // Animate tabs out of view before changing workspace, therefor we
      // need to animate in the opposite direction
      await this._animateTabs(animationDirection === 'left' ? 'right' : 'left', true);
    }

    // First pass: Handle tab visibility and workspace ID assignment
    const visibleTabs = this._processTabVisibility(window.uuid, containerId, workspaces);

    // Second pass: Handle tab selection
    await this._handleTabSelection(window, onInit, visibleTabs, containerId, workspaces);

    // Update UI and state
    await this._updateWorkspaceState(window, onInit);

    if (animationDirection) {
      await this._animateTabs(animationDirection);
    }
  }

  get _animateTabsElements() {
    const selector = `#zen-browser-tabs-wrapper`;
    const extraSelector = `#zen-current-workspace-indicator`;
    return [...this.tabContainer.querySelectorAll(selector), ...this.tabContainer.querySelectorAll(extraSelector)];
  }

  async _animateTabs(direction, out = false) {
    this.tabContainer.removeAttribute('dont-animate-tabs');
    const tabsWidth = this.tabContainer.getBoundingClientRect().width;
    // order by actual position in the children list to animate
    const elements = this._animateTabsElements;
    if (out) {
      const existingTransform = elements[0].style.transform;
      const newTransform = `translateX(${direction === 'left' ? '-' : ''}${tabsWidth}px)`;
      return gZenUIManager.motion.animate(
        elements,
        {
          transform: existingTransform ? [existingTransform, newTransform] : newTransform,
        },
        {
          type: 'spring',
          bounce: 0,
          duration: 0.12,
        }
      );
    }
    return gZenUIManager.motion.animate(
      elements,
      {
        transform: [`translateX(${direction === 'left' ? '-' : ''}${tabsWidth}px)`, 'translateX(0px)'],
      },
      {
        duration: 0.15,
        type: 'spring',
        bounce: 0,
      }
    );
  }

  _processTabVisibility(workspaceUuid, containerId, workspaces) {
    const visibleTabs = new Set();
    const lastSelectedTab = this._lastSelectedWorkspaceTabs[workspaceUuid];

    this.tabContainer.setAttribute('dont-animate-tabs', 'true');
    for (const tab of gBrowser.tabs) {
      const tabWorkspaceId = tab.getAttribute('zen-workspace-id');
      const isEssential = tab.getAttribute('zen-essential') === 'true';

      // Always hide last selected tabs from other workspaces
      if (lastSelectedTab === tab && tabWorkspaceId !== workspaceUuid && !isEssential) {
        gBrowser.hideTab(tab, undefined, true);
        continue;
      }

      if (this._shouldShowTab(tab, workspaceUuid, containerId, workspaces)) {
        gBrowser.showTab(tab);
        visibleTabs.add(tab);

        // Assign workspace ID if needed
        if (!tabWorkspaceId && !isEssential) {
          tab.setAttribute('zen-workspace-id', workspaceUuid);
        }
      } else {
        gBrowser.hideTab(tab, undefined, true);
      }
    }

    return visibleTabs;
  }

  _shouldShowTab(tab, workspaceUuid, containerId, workspaces) {
    const isEssential = tab.getAttribute('zen-essential') === 'true';
    const tabWorkspaceId = tab.getAttribute('zen-workspace-id');
    const tabContextId = tab.getAttribute('usercontextid');

    // Handle essential tabs
    if (isEssential) {
      if (!this.containerSpecificEssentials) {
        return true; // Show all essential tabs when containerSpecificEssentials is false
      }

      if (containerId) {
        // In workspaces with default container: Show essentials that match the container
        return tabContextId === containerId;
      } else {
        // In workspaces without a default container: Show essentials that aren't in container-specific workspaces
        // or have usercontextid="0" or no usercontextid
        return (
          !tabContextId ||
          tabContextId === '0' ||
          !workspaces.workspaces.some((workspace) => workspace.containerTabId === parseInt(tabContextId, 10))
        );
      }
    }

    // For non-essential tabs (both normal and pinned)
    if (!tabWorkspaceId) {
      // Assign workspace ID to tabs without one
      tab.setAttribute('zen-workspace-id', workspaceUuid);
      return true;
    }

    // Show if tab belongs to current workspace
    return tabWorkspaceId === workspaceUuid;
  }

  async _handleTabSelection(window, onInit, visibleTabs, containerId, workspaces) {
    const currentSelectedTab = gBrowser.selectedTab;
    const oldWorkspaceId = currentSelectedTab.getAttribute('zen-workspace-id');
    const lastSelectedTab = this._lastSelectedWorkspaceTabs[window.uuid];

    // Save current tab as last selected for old workspace if it shouldn't be visible in new workspace
    if (oldWorkspaceId && oldWorkspaceId !== window.uuid) {
      this._lastSelectedWorkspaceTabs[oldWorkspaceId] = currentSelectedTab;
    }

    let tabToSelect = null;

    // If current tab is visible in new workspace, keep it
    if (this._shouldShowTab(currentSelectedTab, window.uuid, containerId, workspaces) && visibleTabs.has(currentSelectedTab)) {
      tabToSelect = currentSelectedTab;
    }
    // Try last selected tab if it is visible
    else if (
      lastSelectedTab &&
      this._shouldShowTab(lastSelectedTab, window.uuid, containerId, workspaces) &&
      visibleTabs.has(lastSelectedTab)
    ) {
      tabToSelect = lastSelectedTab;
    }
    // Find first suitable tab
    else {
      tabToSelect = Array.from(visibleTabs).find((tab) => !tab.pinned);
    }

    const previousSelectedTab = gBrowser.selectedTab;

    // If we found a tab to select, select it
    if (tabToSelect) {
      gBrowser.selectedTab = tabToSelect;
      this._lastSelectedWorkspaceTabs[window.uuid] = tabToSelect;
    } else if (!onInit) {
      // Create new tab if needed and no suitable tab was found
      const newTab = this._createNewTabForWorkspace(window);
      gBrowser.selectedTab = newTab;
      this._lastSelectedWorkspaceTabs[window.uuid] = newTab;
    }

    // After selecting the new tab, hide the previous selected tab if it shouldn't be visible in the new workspace
    if (!this._shouldShowTab(previousSelectedTab, window.uuid, containerId, workspaces)) {
      gBrowser.hideTab(previousSelectedTab, undefined, true);
    }
  }

  async _updateWorkspaceState(window, onInit) {
    // Update document state
    document.documentElement.setAttribute('zen-workspace-id', window.uuid);

    // Update workspace UI
    await this._updateWorkspacesChangeContextMenu();
    document.getElementById('tabbrowser-tabs')._positionPinnedTabs();
    gZenUIManager.updateTabsToolbar();
    await this._propagateWorkspaceData({ clearCache: false });

    // Notify listeners
    if (this._changeListeners?.length) {
      for (const listener of this._changeListeners) {
        await listener(window, onInit);
      }
    }

    // Reset bookmarks
    this._invalidateBookmarkContainers();

    // Update workspace indicator
    await this.updateWorkspaceIndicator();
  }

  _invalidateBookmarkContainers() {
    for (let i = 0, len = this.bookmarkMenus.length; i < len; i++) {
      const element = document.getElementById(this.bookmarkMenus[i]);
      if (element && element._placesView) {
        const placesView = element._placesView;
        placesView.invalidateContainer(placesView._resultNode);
      }
    }
  }

  async updateWorkspaceIndicator() {
    // Update current workspace indicator
    const currentWorkspace = await this.getActiveWorkspace();
    if (!currentWorkspace) return;
    const indicatorName = document.getElementById('zen-current-workspace-indicator-name');
    const indicatorIcon = document.getElementById('zen-current-workspace-indicator-icon');

    if (this.workspaceHasIcon(currentWorkspace)) {
      indicatorIcon.removeAttribute('no-icon');
    } else {
      indicatorIcon.setAttribute('no-icon', 'true');
    }
    indicatorIcon.textContent = this.getWorkspaceIcon(currentWorkspace);
    indicatorName.textContent = currentWorkspace.name;
  }

  async _updateWorkspacesChangeContextMenu() {
    const workspaces = await this._workspaces();

    const menuPopup = document.getElementById('context-zen-change-workspace-tab-menu-popup');
    if (!menuPopup) {
      return;
    }
    menuPopup.innerHTML = '';

    const activeWorkspace = await this.getActiveWorkspace();

    for (let workspace of workspaces.workspaces) {
      const menuItem = document.createXULElement('menuitem');
      menuItem.setAttribute('label', workspace.name);
      menuItem.setAttribute('zen-workspace-id', workspace.uuid);

      if (workspace.uuid === activeWorkspace.uuid) {
        menuItem.setAttribute('disabled', 'true');
      }

      menuPopup.appendChild(menuItem);
    }
  }

  _createWorkspaceData(name, isDefault, icon) {
    let window = {
      uuid: gZenUIManager.generateUuidv4(),
      default: isDefault,
      icon: icon,
      name: name,
      theme: ZenThemePicker.getTheme([]),
    };
    this._prepareNewWorkspace(window);
    return window;
  }

  async createAndSaveWorkspace(name = 'New Workspace', isDefault = false, icon = undefined) {
    if (!this.workspaceEnabled) {
      return;
    }
    let workspaceData = this._createWorkspaceData(name, isDefault, icon);
    await this.saveWorkspace(workspaceData);
    await this.changeWorkspace(workspaceData);
    return workspaceData;
  }

  async onTabBrowserInserted(event) {
    let tab = event.originalTarget;
    const isEssential = tab.getAttribute('zen-essential') === 'true';
    if (tab.getAttribute('zen-workspace-id') || !this.workspaceEnabled || isEssential) {
      return;
    }

    let activeWorkspace = await this.getActiveWorkspace();
    if (!activeWorkspace) {
      return;
    }
    tab.setAttribute('zen-workspace-id', activeWorkspace.uuid);
  }

  async onLocationChange(browser) {
    if (!this.workspaceEnabled || this._inChangingWorkspace || this._isClosingWindow) {
      return;
    }

    const parent = browser.ownerGlobal;
    const tab = gBrowser.getTabForBrowser(browser);
    const workspaceID = tab.getAttribute('zen-workspace-id');
    const isEssential = tab.getAttribute('zen-essential') === 'true';
    if (!isEssential) {
      const activeWorkspace = await parent.ZenWorkspaces.getActiveWorkspace();
      if (!activeWorkspace) {
        return;
      }

      // Only update last selected tab for non-essential tabs in their workspace
      if (!isEssential && workspaceID === activeWorkspace.uuid) {
        this._lastSelectedWorkspaceTabs[workspaceID] = tab;
      }

      // Switch workspace if needed
      if (workspaceID && workspaceID !== activeWorkspace.uuid) {
        await parent.ZenWorkspaces.changeWorkspace({ uuid: workspaceID });
      }
    }
  }

  // Context menu management

  _contextMenuId = null;
  async updateContextMenu(_) {
    console.assert(this._contextMenuId, 'No context menu ID set');
    document
      .querySelector(`#PanelUI-zen-workspaces [zen-workspace-id="${this._contextMenuId}"] .zen-workspace-actions`)
      .setAttribute('active', 'true');
    const workspaces = await this._workspaces();
    let deleteMenuItem = document.getElementById('context_zenDeleteWorkspace');
    if (
      workspaces.workspaces.length <= 1 ||
      workspaces.workspaces.find((workspace) => workspace.uuid === this._contextMenuId).default
    ) {
      deleteMenuItem.setAttribute('disabled', 'true');
    } else {
      deleteMenuItem.removeAttribute('disabled');
    }
    let defaultMenuItem = document.getElementById('context_zenSetAsDefaultWorkspace');
    if (workspaces.workspaces.find((workspace) => workspace.uuid === this._contextMenuId).default) {
      defaultMenuItem.setAttribute('disabled', 'true');
    } else {
      defaultMenuItem.removeAttribute('disabled');
    }
    let openMenuItem = document.getElementById('context_zenOpenWorkspace');
    if (
      workspaces.workspaces.find((workspace) => workspace.uuid === this._contextMenuId && this.isWorkspaceActive(workspace))
    ) {
      openMenuItem.setAttribute('disabled', 'true');
    } else {
      openMenuItem.removeAttribute('disabled');
    }
    const openInContainerMenuItem = document.getElementById('context_zenWorkspacesOpenInContainerTab');
    if (this.shouldShowContainers) {
      openInContainerMenuItem.removeAttribute('hidden');
    } else {
      openInContainerMenuItem.setAttribute('hidden', 'true');
    }
  }

  async contextChangeContainerTab(event) {
    let workspaces = await this._workspaces();
    let workspace = workspaces.workspaces.find((workspace) => workspace.uuid === this._contextMenuId);
    let userContextId = parseInt(event.target.getAttribute('data-usercontextid'));
    workspace.containerTabId = userContextId;
    await this.saveWorkspace(workspace);
  }

  onContextMenuClose() {
    let target = document.querySelector(
      `#PanelUI-zen-workspaces [zen-workspace-id="${this._contextMenuId}"] .zen-workspace-actions`
    );
    if (target) {
      target.removeAttribute('active');
    }
    this._contextMenuId = null;
  }

  async setDefaultWorkspace() {
    await ZenWorkspacesStorage.setDefaultWorkspace(this._contextMenuId);
    await this._propagateWorkspaceData();
  }

  async openWorkspace() {
    let workspaces = await this._workspaces();
    let workspace = workspaces.workspaces.find((workspace) => workspace.uuid === this._contextMenuId);
    await this.changeWorkspace(workspace);
  }

  async contextDelete(event) {
    this.__contextIsDelete = true;
    event.stopPropagation();
    await this.removeWorkspace(this._contextMenuId);
    this.__contextIsDelete = false;
  }

  async contextEdit(event) {
    event.stopPropagation();
    await this.openEditDialog(this._contextMenuId);
  }

  get emojis() {
    if (this._emojis) {
      return this._emojis;
    }
    const lazy = {};
    Services.scriptloader.loadSubScript('chrome://browser/content/zen-components/ZenEmojies.mjs', lazy);
    this._emojis = lazy.zenGlobalEmojis();
    return this._emojis;
  }

  clearEmojis() {
    // Unload from memory
    this._emojis = null;
  }

  async changeWorkspaceShortcut(offset = 1) {
    // Cycle through workspaces
    let workspaces = await this._workspaces();
    let activeWorkspace = await this.getActiveWorkspace();
    let workspaceIndex = workspaces.workspaces.indexOf(activeWorkspace);

    // note: offset can be negative
    let targetIndex = workspaceIndex + offset;
    if (this.shouldWrapAroundNavigation) {
      // Add length to handle negative indices and loop
      targetIndex = (targetIndex + workspaces.workspaces.length) % workspaces.workspaces.length;
    } else {
      // Clamp within bounds to disable looping
      targetIndex = Math.max(0, Math.min(workspaces.workspaces.length - 1, targetIndex));
    }

    let nextWorkspace = workspaces.workspaces[targetIndex];
    await this.changeWorkspace(nextWorkspace, { explicitAnimationDirection: offset > 0 ? 'right' : 'left' });
  }

  _initializeWorkspaceTabContextMenus() {
    const menu = document.createXULElement('menu');
    menu.setAttribute('id', 'context-zen-change-workspace-tab');
    menu.setAttribute('data-l10n-id', 'context-zen-change-workspace-tab');

    const menuPopup = document.createXULElement('menupopup');
    menuPopup.setAttribute('id', 'context-zen-change-workspace-tab-menu-popup');
    menuPopup.setAttribute('oncommand', "ZenWorkspaces.changeTabWorkspace(event.target.getAttribute('zen-workspace-id'))");

    menu.appendChild(menuPopup);

    document.getElementById('context_closeDuplicateTabs').after(menu);
  }

  async changeTabWorkspace(workspaceID) {
    const tabs = TabContextMenu.contextTab.multiselected ? gBrowser.selectedTabs : [TabContextMenu.contextTab];
    document.getElementById('tabContextMenu').hidePopup();
    const previousWorkspaceID = document.documentElement.getAttribute('zen-workspace-id');
    for (let tab of tabs) {
      tab.setAttribute('zen-workspace-id', workspaceID);
      if (this._lastSelectedWorkspaceTabs[previousWorkspaceID] === tab) {
        // This tab is no longer the last selected tab in the previous workspace because it's being moved to
        // the current workspace
        delete this._lastSelectedWorkspaceTabs[previousWorkspaceID];
      }
    }
    const workspaces = await this._workspaces();
    await this.changeWorkspace(workspaces.workspaces.find((workspace) => workspace.uuid === workspaceID));
  }

  // Tab browser utilities
  createContainerTabMenu(event) {
    let window = event.target.ownerGlobal;
    const workspace = this._workspaceCache.workspaces.find((workspace) => this._contextMenuId === workspace.uuid);
    let containerTabId = workspace.containerTabId;
    return window.createUserContextMenu(event, {
      isContextMenu: true,
      excludeUserContextId: containerTabId,
      showDefaultTab: true,
    });
  }

  getContextIdIfNeeded(userContextId, fromExternal, allowInheritPrincipal) {
    if (!this.workspaceEnabled) {
      return [userContextId, false, undefined];
    }

    if (this.shouldForceContainerTabsToWorkspace && typeof userContextId !== 'undefined' && this._workspaceCache?.workspaces) {
      // Find all workspaces that match the given userContextId
      const matchingWorkspaces = this._workspaceCache.workspaces.filter(
        (workspace) => workspace.containerTabId === userContextId
      );

      // Check if exactly one workspace matches
      if (matchingWorkspaces.length === 1) {
        const workspace = matchingWorkspaces[0];
        if (workspace.uuid !== this.getActiveWorkspaceFromCache().uuid) {
          this.changeWorkspace(workspace);
          return [userContextId, true, workspace.uuid];
        }
      }
    }

    const activeWorkspace = this.getActiveWorkspaceFromCache();
    const activeWorkspaceUserContextId = activeWorkspace?.containerTabId;

    if ((fromExternal || allowInheritPrincipal === false) && !!activeWorkspaceUserContextId) {
      return [activeWorkspaceUserContextId, true, undefined];
    }

    if (typeof userContextId !== 'undefined' && userContextId !== activeWorkspaceUserContextId) {
      return [userContextId, false, undefined];
    }
    return [activeWorkspaceUserContextId, true, undefined];
  }

  async shortcutSwitchTo(index) {
    const workspaces = await this._workspaces();
    // The index may be out of bounds, if it doesnt exist, don't do anything
    if (index >= workspaces.workspaces.length || index < 0) {
      return;
    }
    const workspaceToSwitch = workspaces.workspaces[index];
    await this.changeWorkspace(workspaceToSwitch);
  }

  isBookmarkInAnotherWorkspace(bookmark) {
    if (!this._workspaceBookmarksCache?.bookmarks) return false;
    const bookmarkGuid = bookmark.bookmarkGuid;
    const activeWorkspaceUuid = this.activeWorkspace;
    let isInActiveWorkspace = false;
    let isInOtherWorkspace = false;

    for (const [workspaceUuid, bookmarkGuids] of Object.entries(this._workspaceBookmarksCache.bookmarks)) {
      if (bookmarkGuids.includes(bookmarkGuid)) {
        if (workspaceUuid === activeWorkspaceUuid) {
          isInActiveWorkspace = true;
        } else {
          isInOtherWorkspace = true;
        }
      }
    }

    // Return true only if the bookmark is in another workspace and not in the active one
    return isInOtherWorkspace && !isInActiveWorkspace;
  }
})();
