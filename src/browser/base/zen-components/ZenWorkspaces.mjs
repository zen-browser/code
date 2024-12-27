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
    direction: null
  };
  _hoveringSidebar = false;
  _lastScrollTime = 0;
  bookmarkMenus = [
    "PlacesToolbar",
    "bookmarks-menu-button",
    "BMB_bookmarksToolbar",
    "BMB_unsortedBookmarks",
    "BMB_mobileBookmarks"
  ];

  async init() {
    if (!this.shouldHaveWorkspaces) {
      document.getElementById('zen-current-workspace-indicator').setAttribute('hidden', 'true');
      console.warn('ZenWorkspaces: !!! ZenWorkspaces is disabled in hidden windows !!!');
      return; // We are in a hidden window, don't initialize ZenWorkspaces
    }
    this.ownerWindow = window;
    XPCOMUtils.defineLazyPreferenceGetter(
      this,
      'activationMethod',
      'zen.workspaces.scroll-modifier-key',
      'ctrl',
    );
    XPCOMUtils.defineLazyPreferenceGetter(
      this,
      'naturalScroll',
      'zen.workspaces.natural-scroll',
      true
    );
    XPCOMUtils.defineLazyPreferenceGetter(
      this,
      'shouldWrapAroundNavigation',
      'zen.workspaces.wrap-around-navigation',
      true
    );
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
    await this.initializeWorkspaces();
    console.info('ZenWorkspaces: ZenWorkspaces initialized');

    if (Services.prefs.getBoolPref('zen.workspaces.swipe-actions', false) && this.workspaceEnabled) {
      this.initializeGestureHandlers();
      this.initializeWorkspaceNavigation();
    }

    Services.obs.addObserver(this, 'weave:engine:sync:finish');
    Services.obs.addObserver(async function observe(subject) {
      this._workspaceBookmarksCache = null;
      await this.workspaceBookmarks();
      this._invalidateBookmarkContainers();
    }.bind(this), "workspace-bookmarks-updated");
  }

  initializeWorkspaceNavigation() {
    this._setupAppCommandHandlers();
    this._setupSidebarHandlers();
  }

  _setupAppCommandHandlers() {
    // Remove existing handler temporarily - this is needed so that _handleAppCommand is called before the original
    window.removeEventListener("AppCommand", HandleAppCommandEvent, true);

    // Add our handler first
    window.addEventListener("AppCommand", this._handleAppCommand.bind(this), true);

    // Re-add original handler
    window.addEventListener("AppCommand", HandleAppCommandEvent, true);
  }

  _handleAppCommand(event) {
    if (!this.workspaceEnabled || !this._hoveringSidebar) {
      return;
    }

    switch (event.command) {
      case "Forward":
        this.changeWorkspaceShortcut(1);
        event.stopImmediatePropagation();
        event.preventDefault();
        break;
      case "Back":
        this.changeWorkspaceShortcut(-1);
        event.stopImmediatePropagation();
        event.preventDefault();
        break;
    }
  }

  _setupSidebarHandlers() {
    const toolbox = document.getElementById('navigator-toolbox');

    toolbox.addEventListener('mouseenter', () => {
      this._hoveringSidebar = true;
    });

    toolbox.addEventListener('mouseleave', () => {
      this._hoveringSidebar = false;
    });

    const scrollCooldown = 200; // Milliseconds to wait before allowing another scroll
    const scrollThreshold = 2;  // Minimum scroll delta to trigger workspace change

    toolbox.addEventListener('wheel', async (event) => {
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
      let direction = delta > 0 ? 1 : -1;
      if (this.naturalScroll) {
        direction = delta > 0 ? -1 : 1;
      }

      // Workspace logic
      const workspaces = (await this._workspaces()).workspaces;
      const currentIndex = workspaces.findIndex(w => w.uuid === this.activeWorkspace);
      if (currentIndex === -1) return; // No valid current workspace

      let targetIndex = currentIndex + direction;

      if (this.shouldWrapAroundNavigation) {
        // Add length to handle negative indices and loop
        targetIndex = (targetIndex + workspaces.length) % workspaces.length;
      } else {
        // Clamp within bounds to disable looping
        targetIndex = Math.max(0, Math.min(workspaces.length - 1, targetIndex));
      }

      if (targetIndex !== currentIndex) {
        await this.changeWorkspace(workspaces[targetIndex]);
      }

      this._lastScrollTime = currentTime;
    }, { passive: true });
  }

  initializeGestureHandlers() {
    const elements = [
      document.getElementById('navigator-toolbox'),
      // event handlers do not work on elements inside shadow DOM so we need to attach them directly
      document.getElementById("tabbrowser-arrowscrollbox").shadowRoot.querySelector("scrollbox"),
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
      direction: null
    };
  }

  _handleSwipeUpdate(event) {
    if (!this.workspaceEnabled || !this._swipeState?.isGestureActive) return;

    event.preventDefault();
    event.stopPropagation();

    // Update cumulative delta
    this._swipeState.cumulativeDelta += event.delta;

    // Determine swipe direction based on cumulative delta
    if (Math.abs(this._swipeState.cumulativeDelta) > 0.25) {
      this._swipeState.direction = this._swipeState.cumulativeDelta > 0 ? 'left' : 'right';
      if (this.naturalScroll){
        this._swipeState.direction = this._swipeState.cumulativeDelta > 0 ? 'right' : 'left';
      }
    }

  }

  async _handleSwipeEnd(event) {
    if (!this.workspaceEnabled || !this._swipeState?.isGestureActive) return;
    event.preventDefault();
    event.stopPropagation();

    if (this._swipeState.direction) {
      const workspaces = (await this._workspaces()).workspaces;
      const currentIndex = workspaces.findIndex(w => w.uuid === this.activeWorkspace);

      if (currentIndex !== -1) {
        const isRTL = document.documentElement.matches(':-moz-locale-dir(rtl)');
        const moveForward = (this._swipeState.direction === 'right') !== isRTL;

        let targetIndex = moveForward
          ? currentIndex + 1
          : currentIndex - 1;

        if (this.shouldWrapAroundNavigation) {
          // Add length to handle negative indices and clamp within bounds
          targetIndex = (targetIndex + workspaces.length) % workspaces.length;
        } else {
          // Clamp within bounds for to remove looping
          targetIndex = Math.max(0, Math.min(workspaces.length - 1, targetIndex));
        }

        if (targetIndex !== currentIndex) {
          await this.changeWorkspace(workspaces[targetIndex]);
        }
      }
    }

    // Reset swipe state
    this._swipeState = {
      isGestureActive: false,
      cumulativeDelta: 0,
      direction: null
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
      this._workspaceEnabled = Services.prefs.getBoolPref('zen.workspaces.enabled', false) && this.shouldHaveWorkspaces;
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

  async onWorkspacesEnabledChanged() {
    if (this.workspaceEnabled) {
      throw Error("Shoud've had reloaded the window");
    } else {
      this._workspaceCache = null;
      document.getElementById('zen-workspaces-button')?.remove();
      for (let tab of gBrowser.tabs) {
        gBrowser.showTab(tab);
      }
    }
  }

  async initializeWorkspaces() {
    Services.prefs.addObserver('zen.workspaces.enabled', this.onWorkspacesEnabledChanged.bind(this));

    await this.initializeWorkspacesButton();
    if (this.workspaceEnabled) {
      this._initializeWorkspaceCreationIcons();
      this._initializeWorkspaceTabContextMenus();
      await this.workspaceBookmarks();
      window.addEventListener('TabBrowserInserted', this.onTabBrowserInserted.bind(this));
      await SessionStore.promiseInitialized;
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
        await this.changeWorkspace(activeWorkspace, true);
      }
      try {
        if (activeWorkspace) {
          window.gZenThemePicker = new ZenThemePicker();
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

  handleTabBeforeClose(tab) {
    if (!this.workspaceEnabled || this.__contextIsDelete) {
      return null;
    }

    let workspaceID = tab.getAttribute('zen-workspace-id');
    if (!workspaceID) {
      return null;
    }

    const shouldOpenNewTabIfLastUnpinnedTabIsClosed = this.shouldOpenNewTabIfLastUnpinnedTabIsClosed;

    let tabs = gBrowser.tabs.filter(t =>
        t.getAttribute('zen-workspace-id') === workspaceID &&
        (!shouldOpenNewTabIfLastUnpinnedTabIsClosed ||!t.pinned || t.getAttribute("pending") !== "true")
    );

    if (tabs.length === 1 && tabs[0] === tab) {
      let newTab = this._createNewTabForWorkspace({ uuid: workspaceID });
      return newTab;
    }

    return null;
  }

  _createNewTabForWorkspace(window) {
    let tab = gZenUIManager.openAndChangeToTab(Services.prefs.getStringPref('browser.startup.homepage'));

    if(window.uuid){
      tab.setAttribute('zen-workspace-id', window.uuid);
    }
    return tab;
  }

  _kIcons = JSON.parse(Services.prefs.getStringPref('zen.workspaces.icons')).map((icon) =>
    typeof Intl.Segmenter !== 'undefined' ? new Intl.Segmenter().segment(icon).containing().segment : Array.from(icon)[0]
  );

  searchIcons(input, icons) {
    input = input.toLowerCase();

    if ((input === ':') || (input === '')) {
      return icons;
    }
    const emojiScores = [];
  
    function calculateSearchScore(inputLength, targetLength, weight = 100) {
      return parseInt((inputLength / targetLength) * weight);
    }
    
    for (let currentEmoji of icons) {
      let alignmentScore = -1;
      let normalizedEmojiName = currentEmoji.name.toLowerCase();
      let keywordList = currentEmoji.description.split(',').map(keyword => keyword.trim().toLowerCase());
    
      if (input[0] === ":") {
        let searchTerm = input.slice(1);
        let nameMatchIndex = normalizedEmojiName.indexOf(searchTerm);
    
        if (nameMatchIndex !== -1 && nameMatchIndex === 0) {
          alignmentScore = calculateSearchScore(searchTerm.length, normalizedEmojiName.length, 100);
        }
      } else {
        if (input === currentEmoji.emoji) {
          alignmentScore = 999;
        }
        let nameMatchIndex = normalizedEmojiName.replace(/_/g, ' ').indexOf(input);
        if (nameMatchIndex !== -1) {
          if (nameMatchIndex === 0) {
            alignmentScore = calculateSearchScore(input.length, normalizedEmojiName.length, 150); 
          } else if (input[input.length - 1] !== " ") {
            alignmentScore += calculateSearchScore(input.length, normalizedEmojiName.length, 40);
          }
        }
        for (let keyword of keywordList) {
          let keywordMatchIndex = keyword.indexOf(input);
          if (keywordMatchIndex !== -1) {
            if (keywordMatchIndex === 0) {
              alignmentScore += calculateSearchScore(input.length, keyword.length, 50);
            } else if (input[input.length - 1] !== " ") {
              alignmentScore += calculateSearchScore(input.length, keyword.length, 5);
            }
          }
        }
      }
      
      //if match score is not -1, add it 
      if (alignmentScore !== -1) {
        emojiScores.push({ "emoji": currentEmoji.emoji, "score": alignmentScore });
      }
    }
  
    // Sort the emojis by their score in descending order
    emojiScores.sort((a, b) => b.Score - a.Score);
  
    // Filter out emojis with a score lower than 10
    let filteredEmojiScores = emojiScores;
    if (emojiScores.length > 30) {
      filteredEmojiScores = emojiScores.filter(score => score.Score >= 10);
    }
  
    // Return the emojis in the order of their rank
    return filteredEmojiScores.map(score => score.emoji);
  }

  resetWorkspaceIconSearch(){
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
    for (let icon of this._kIcons) {
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
    const emojies = [{"emoji":"⌚","description":"watch, clock, time, wristwatch","name":"watch"},{"emoji":"⌛","description":"hourglass done, time, sand, clock","name":"hourglass"},{"emoji":"⏪","description":"arrow, blue, rewind, fast reverse button, left, back","name":"rewind"},{"emoji":"⏫","description":"increase, arrow, fast up button, blue, up","name":"arrow_double_up"},{"emoji":"⏬","description":"decrease, down, arrow, blue, fast down button","name":"arrow_double_down"},{"emoji":"⏰","description":"alarm clock, clock, alarm, time, red","name":"alarm_clock"},{"emoji":"⏳","description":"hourglass not done, time, sand, clock","name":"hourglass_flowing_sand"},{"emoji":"⚽","description":"sports, football, soccer ball, ball, soccer, soccer ball,","name":"soccer"},{"emoji":"⚾","description":"ball, baseball, sports","name":"baseball"},{"emoji":"⛄","description":"snowman, snowman without snow, christmas, holidays, snow","name":"snowman"},{"emoji":"⛅","description":"sun, sun behind cloud, cloudy, sunny, weather","name":"partly_sunny"},{"emoji":"⛎","description":"zodiac, horoscope, Ophiuchus,  purple","name":"ophiuchus"},{"emoji":"⛔","description":"sign, red, stop, no entry","name":"no_entry"},{"emoji":"⛪","description":"church, building, religion, worship, faith, holy","name":"church"},{"emoji":"⛲","description":"fountain, water, garden","name":"fountain"},{"emoji":"⛳","description":"sports, golf, flag in hole, flag","name":"golf"},{"emoji":"⛵","description":"vessel, vacation, sailing, sea, ship, sailboat, water, boat, travel, ocean","name":"sailboat"},{"emoji":"⛺","description":"camp, camping, outdoor, tent, camping, shelter, nature, vacation","name":"tent"},{"emoji":"⛽","description":"oil, petrol, fuel pump, gas, red, gas station, fuel","name":"fuelpump"},{"emoji":"✅","description":"approve, check, check mark, tick, check mark button, accept, yes, success, task","name":"white_check_mark"},{"emoji":"✊","description":"justice, raised fist, solidarity, empowerment, fist, strength","name":"fist"},{"emoji":"✋","description":"hand, stop, halt, raised hand","name":"raised_hand"},{"emoji":"✨","description":"sparkles, stars, shine, AI, magic, beauty, creativity","name":"sparkles"},{"emoji":"❌","description":"cross mark, cross, wrong, no, red","name":"x"},{"emoji":"❎","description":"cross, no, green,, cross mark button","name":"negative_squared_cross_mark"},{"emoji":"❓","description":"curiosity, question mark, question, punctuation, red","name":"question"},{"emoji":"⭐","description":"star, five, achievement, favorite, yellow, gold, space, universe","name":"star"},{"emoji":"⭕","description":"hoop, hollow red circle, o, circle, red, round","name":"o"},{"emoji":"🀄","description":"mahjong red dragon, china, game","name":"mahjong"},{"emoji":"🃏","description":"card, joker, game, deck, gamble","name":"black_joker"},{"emoji":"🆎","description":"red,, AB button (blood type)","name":"ab"},{"emoji":"🆑","description":"CL button, red","name":"cl"},{"emoji":"🆒","description":"cool, blue, COOL button","name":"cool"},{"emoji":"🆓","description":"free, blue, FREE button","name":"free"},{"emoji":"🆔","description":"authentication, security, purple, identification, id, verification, ID button","name":"id"},{"emoji":"🆕","description":"new, blue, NEW button","name":"new"},{"emoji":"🆖","description":"blue, ana ng, NG button, ng","name":"ng"},{"emoji":"🆗","description":"blue, okay, ok, OK button","name":"ok"},{"emoji":"🆘","description":"SOS button, emergency, danger, red, help, sos","name":"sos"},{"emoji":"🆙","description":"UP! button, up, blue","name":"up"},{"emoji":"🆚","description":"versus, duel, orange, contest, challenge, vs, battle, competition, VS button","name":"vs"},{"emoji":"🈁","description":"here, blue, japanese, Japanese here button","name":"koko"},{"emoji":"🈚","description":"Japanese free of charge button, orange, japanese","name":"u7121"},{"emoji":"🈯","description":"Japanese reserved button, japanese, green","name":"u6307"},{"emoji":"🈲","description":"Japanese prohibited button, red, japanese","name":"u7981"},{"emoji":"🈳","description":"blue, Japanese vacancy button, japanese","name":"u7a7a"},{"emoji":"🈴","description":"Japanese passing grade button, red, japanese","name":"u5408"},{"emoji":"🈵","description":"Japanese no vacancy button, red, japanese","name":"u6e80"},{"emoji":"🈶","description":"Japanese not free of charge button, orange, japanese","name":"u6709"},{"emoji":"🈸","description":"Japanese application button, orange, japanese","name":"u7533"},{"emoji":"🈹","description":"Japanese discount button, red, japanese","name":"u5272"},{"emoji":"🈺","description":"Japanese open for business button, orange, japanese","name":"u55b6"},{"emoji":"🉐","description":"Japanese bargain button, red, japanese","name":"ideograph_advantage"},{"emoji":"🉑","description":"Japanese acceptable button, orange, japanese","name":"accept"},{"emoji":"🌀","description":"cyclone, spiral, Zen, purple, swirl, storm","name":"cyclone"},{"emoji":"🌁","description":"foggy, bridge, cloudy","name":"foggy"},{"emoji":"🌂","description":", umbrella, purple, rain, closed umbrella, weather","name":"closed_umbrella"},{"emoji":"🌃","description":"night, city, night with stars, scenery","name":"night_with_stars"},{"emoji":"🌄","description":"sunrise, sunrise over mountains, sun, sunset, nature, scenery","name":"sunrise_over_mountains"},{"emoji":"🌅","description":"sun, sunset, sunrise, scenery, nature","name":"sunrise"},{"emoji":"🌆","description":"cityscape at dusk, city,, scenery","name":"city_dusk"},{"emoji":"🌇","description":"city, evening, sunset, scenery","name":"city_sunset"},{"emoji":"🌈","description":"rainbow, pride, gay","name":"rainbow"},{"emoji":"🌉","description":"night, bridge, bridge at night","name":"bridge_at_night"},{"emoji":"🌊","description":"water wave, tsunami, water, blue, ocean, art, sea, wave","name":"ocean"},{"emoji":"🌋","description":"volcano, eruption, lava, fire, geological","name":"volcano"},{"emoji":"🌌","description":"science, milky way, galaxy, cosmos, stars, blue, nebula","name":"milky_way"},{"emoji":"🌍","description":"africa, blue, planet, school, map, world, earth, globe, globe showing Europe-Africa, geography","name":"earth_africa"},{"emoji":"🌎","description":"blue, planet, america, school, map, globe showing Americas, world, earth, globe, geography","name":"earth_americas"},{"emoji":"🌏","description":"globe showing Asia-Australia, blue, asia, planet, school, map, world, earth, globe, australia, geography","name":"earth_asia"},{"emoji":"🌐","description":"globe with meridians, blue, tech, internet, www, world, network, technology, web","name":"globe_with_meridians"},{"emoji":"🌑","description":"moon, lunar, purple, night, new moon, space, astronomy","name":"new_moon"},{"emoji":"🌒","description":"night, waxing crescent moon, astronomy, space, moon","name":"waxing_crescent_moon"},{"emoji":"🌓","description":"night, first quarter moon, astronomy, space, moon","name":"first_quarter_moon"},{"emoji":"🌔","description":"night, waxing gibbous moon, astronomy, space, moon","name":"waxing_gibbous_moon"},{"emoji":"🌕","description":"night, astronomy, full moon, space, yellow, moon","name":"full_moon"},{"emoji":"🌖","description":"night, astronomy, waning gibbous moon, space, moon","name":"waning_gibbous_moon"},{"emoji":"🌗","description":"night, astronomy, last quarter moon, space, moon","name":"last_quarter_moon"},{"emoji":"🌘","description":"night, astronomy, waning crescent moon, space, moon","name":"waning_crescent_moon"},{"emoji":"🌙","description":"night, astronomy, crescent moon, space, moon","name":"crescent_moon"},{"emoji":"🌚","description":"night, face, new moon face, astronomy, purple, space, moon","name":"new_moon_with_face"},{"emoji":"🌛","description":"night, face, astronomy, first quarter moon face, smile, space, yellow, moon","name":"first_quarter_moon_with_face"},{"emoji":"🌜","description":"night, face, astronomy, smile, last quarter moon face, space, yellow, moon","name":"last_quarter_moon_with_face"},{"emoji":"🌝","description":"night, face, full moon face, astronomy, smile, space, yellow, moon","name":"full_moon_with_face"},{"emoji":"🌞","description":"sun with face, night, face, astronomy, smile, space, yellow, moon","name":"sun_with_face"},{"emoji":"🌟","description":"sparkle, night, star, glowing star, yellow","name":"star2"},{"emoji":"🌠","description":"night, falling, star, cosmos, shooting star","name":"stars"},{"emoji":"🌭","description":"hotdog, hot dog, food","name":"hotdog"},{"emoji":"🌮","description":"taco, food","name":"taco"},{"emoji":"🌯","description":"food, wrap, shawarma, burrito","name":"burrito"},{"emoji":"🌰","description":"food, chestnut, onion","name":"chestnut"},{"emoji":"🌱","description":", green, plant, growth, seedling","name":"seedling"},{"emoji":"🌲","description":"holidays, christmas, green, evergreen tree, spruce, tree","name":"evergreen_tree"},{"emoji":"🌳","description":"oak, deciduous tree, environment, plant, nature, forest, tree, green","name":"deciduous_tree"},{"emoji":"🌴","description":"palm tree, vacation, palm, island, tree, beach","name":"palm_tree"},{"emoji":"🌵","description":"cactus, desert, green, nature, plant","name":"cactus"},{"emoji":"🌷","description":"flower, tulip, pink, nature, plant","name":"tulip"},{"emoji":"🌸","description":"pink, bloom, plant, nature, flower, sakura, cherry blossom","name":"cherry_blossom"},{"emoji":"🌹","description":"flower, rose, red, nature, plant","name":"rose"},{"emoji":"🌺","description":"hibiscus, pink, plant, nature, flower","name":"hibiscus"},{"emoji":"🌻","description":"sunflower, nature, plant, flower, yellow","name":"sunflower"},{"emoji":"🌼","description":"blossom, plant, nature, flower, white","name":"blossom"},{"emoji":"🌽","description":"food, corn, ear of corn","name":"corn"},{"emoji":"🌾","description":"food, sheaf of rice, wheat","name":"ear_of_rice"},{"emoji":"🌿","description":"herb, plant","name":"herb"},{"emoji":"🍀","description":"lucky, four leaf clover, fortune, clover, green, plant","name":"four_leaf_clover"},{"emoji":"🍁","description":"maple leaf, autumn, plant, nature, leaf, fall, red, canada","name":"maple_leaf"},{"emoji":"🍂","description":"brown, leaf, autumn, plant, nature, fall, dead leaves, fallen leaf","name":"fallen_leaf"},{"emoji":"🍃","description":"nature, green, leaf, leaf fluttering in wind, plant","name":"leaves"},{"emoji":"🍄","description":"mushroom, nature, plant, fungi, toadstool","name":"mushroom"},{"emoji":"🍅","description":"tomato, food, vegetable, red","name":"tomato"},{"emoji":"🍆","description":"eggplant, food, vegetable, purple","name":"eggplant"},{"emoji":"🍇","description":"food, fruit, grapes, grape, purple","name":"grapes"},{"emoji":"🍈","description":"melon, fruit, food","name":"melon"},{"emoji":"🍉","description":"watermelon, fruit, food, red","name":"watermelon"},{"emoji":"🍊","description":"food, fruit, tangerine, orange","name":"tangerine"},{"emoji":"🍋","description":"lemon, food, fruit, yellow","name":"lemon"},{"emoji":"🍌","description":"banana, food, fruit, berry, yellow","name":"banana"},{"emoji":"🍍","description":"pineapple, food, fruit","name":"pineapple"},{"emoji":"🍎","description":"food, red apple, fruit, apple, school,, red","name":"apple"},{"emoji":"🍏","description":"food, fruit, green, apple, green apple","name":"green_apple"},{"emoji":"🍐","description":"pear, food, fruit, green","name":"pear"},{"emoji":"🍑","description":"peach, food, fruit","name":"peach"},{"emoji":"🍒","description":"food, fruit, cherries, cherry, red","name":"cherries"},{"emoji":"🍓","description":"strawberry, berry, fruit, food, red","name":"strawberry"},{"emoji":"🍔","description":"hamburger, america, food","name":"hamburger"},{"emoji":"🍕","description":"pizza, food","name":"pizza"},{"emoji":"🍖","description":"food, meat on bone, ham","name":"meat_on_bone"},{"emoji":"🍗","description":"chicken, poultry leg, food","name":"poultry_leg"},{"emoji":"🍘","description":"rice cracker, rice","name":"rice_cracker"},{"emoji":"🍙","description":"onigiri, rice, rice ball, food","name":"rice_ball"},{"emoji":"🍚","description":"food, rice, cooked rice","name":"rice"},{"emoji":"🍛","description":"food, rice, curry, curry rice","name":"curry"},{"emoji":"🍜","description":"food, steaming bowl, ramen, noodles","name":"ramen"},{"emoji":"🍝","description":"food, pasta, spaghetti","name":"spaghetti"},{"emoji":"🍞","description":"bread, food","name":"bread"},{"emoji":"🍟","description":"fries, french fries, french, food","name":"fries"},{"emoji":"🍠","description":"food, roasted, roasted sweet potato, sweet, potato","name":"sweet_potato"},{"emoji":"🍡","description":"dango, food","name":"dango"},{"emoji":"🍢","description":"oden, food","name":"oden"},{"emoji":"🍣","description":"sushi, salmon, food","name":"sushi"},{"emoji":"🍤","description":"food, prawn, fried shrimp","name":"fried_shrimp"},{"emoji":"🍥","description":", fish cake with swirl","name":"fish_cake"},{"emoji":"🍦","description":"desert, icecrean, soft ice cream, food","name":"icecream"},{"emoji":"🍧","description":"desert, icecrean, shaved ice, food","name":"shaved_ice"},{"emoji":"🍨","description":"desert, ice cream, icecrean, food","name":"ice_cream"},{"emoji":"🍩","description":"desert, donut, doughnut, food","name":"doughnut"},{"emoji":"🍪","description":"cookie, desert, food","name":"cookie"},{"emoji":"🍫","description":"desert, chocolate, chocolate bar, food","name":"chocolate_bar"},{"emoji":"🍬","description":"candy, desert, food","name":"candy"},{"emoji":"🍭","description":"desert, candy, lollipop, food","name":"lollipop"},{"emoji":"🍮","description":"custard, food, dessert","name":"custard"},{"emoji":"🍯","description":"food, honey, honey pot","name":"honey_pot"},{"emoji":"🍰","description":"food, shortcake, cakedesert","name":"cake"},{"emoji":"🍱","description":"bento, rice, bento box, food","name":"bento"},{"emoji":"🍲","description":"food, soup, pot of food","name":"stew"},{"emoji":"🍳","description":"food, cooking, omelette, egg","name":"cooking"},{"emoji":"🍴","description":"cutlery, food, fork and knife, fork, knife","name":"fork_and_knife"},{"emoji":"🍵","description":"chai, food, drink, tea, teacup without handle","name":"tea"},{"emoji":"🍶","description":"sake, drink","name":"sake"},{"emoji":"🍷","description":"food, wine glass, wine, drink","name":"wine_glass"},{"emoji":"🍸","description":"food, glass, cocktail glass, drink, cocktail, martini","name":"cocktail"},{"emoji":"🍹","description":"drink, tropical drink, long island, food","name":"tropical_drink"},{"emoji":"🍺","description":"food, beer mug, drink, beer","name":"beer"},{"emoji":"🍻","description":"food, clinking beer mugs, drink, beer","name":"beers"},{"emoji":"🍼","description":"food, baby bottle, drink, baby, milk","name":"baby_bottle"},{"emoji":"🍾","description":"drink, bottle with popping cork, champagne, food","name":"champagne"},{"emoji":"🍿","description":"popcorn, food","name":"popcorn"},{"emoji":"🎀","description":"decoration, present, bow, ribbon, cute","name":"ribbon"},{"emoji":"🎁","description":"wrapped gift, present, christmas","name":"gift"},{"emoji":"🎂","description":"birthday, birthday cake, cake","name":"birthday"},{"emoji":"🎃","description":"scary, pumpkin, spooky, fall, orange, halloween, jack-o-lantern","name":"jack_o_lantern"},{"emoji":"🎄","description":"Christmas tree, tree, christmas, holidays","name":"christmas_tree"},{"emoji":"🎅","description":"santa, Santa Claus, christmas, holidays","name":"santa"},{"emoji":"🎆","description":"fireworks, party","name":"fireworks"},{"emoji":"🎇","description":"fireworks, sparkler, party","name":"sparkler"},{"emoji":"🎈","description":"baloon, red, balloon","name":"balloon"},{"emoji":"🎉","description":"confetti, party, party popper, celebration","name":"tada"},{"emoji":"🎊","description":"confetti, party, confetti ball, celebration","name":"confetti_ball"},{"emoji":"🎋","description":"tanabata, tree, tanabata tree","name":"tanabata_tree"},{"emoji":"🎌","description":", crossed flags","name":"crossed_flags"},{"emoji":"🎍","description":"bamboo, pine decoration","name":"bamboo"},{"emoji":"🎎","description":", Japanese dolls","name":"dolls"},{"emoji":"🎏","description":", carp streamer","name":"flags"},{"emoji":"🎐","description":", wind chime","name":"wind_chime"},{"emoji":"🎑","description":", moon viewing ceremony","name":"rice_scene"},{"emoji":"🎒","description":"school, backpack, bag","name":"school_satchel"},{"emoji":"🎓","description":"graduation, graduate, education, school, graduation cap, university","name":"mortar_board"},{"emoji":"🎠","description":"park, carousel, carousel horse, pony","name":"carousel_horse"},{"emoji":"🎡","description":"park, ferris, ferris wheel, wheel","name":"ferris_wheel"},{"emoji":"🎢","description":"park, roller coaster, rollercoaster","name":"roller_coaster"},{"emoji":"🎣","description":"fishing, fishing pole, fish, rod","name":"fishing_pole_and_fish"},{"emoji":"🎤","description":"microphone, speech, talk, singing","name":"microphone"},{"emoji":"🎥","description":"recording, movie camera, cinema, film, video, camera, content creation","name":"movie_camera"},{"emoji":"🎦","description":"camera, blue, recording, video, film, cinema","name":"cinema"},{"emoji":"🎧","description":"music, headphone, headphones, audio","name":"headphones"},{"emoji":"🎨","description":"colors, artist palette, creativity, design, painting, art, inspiration","name":"art"},{"emoji":"🎩","description":"hat, top hat, magic","name":"tophat"},{"emoji":"🎪","description":"circus, circus tent","name":"circus_tent"},{"emoji":"🎫","description":"ticket","name":"ticket"},{"emoji":"🎬","description":"video editing, media, video, clapper board, audiovisual","name":"clapper"},{"emoji":"🎭","description":"theater, performing arts, drama, masks","name":"performing_arts"},{"emoji":"🎮","description":"xbox, ps4, gaming, video game, playstation","name":"video_game"},{"emoji":"🎯","description":"direct hit, goal, target, task","name":"dart"},{"emoji":"🎰","description":"slot, casino, slot machine, games, gambling","name":"slot_machine"},{"emoji":"🎱","description":"billiard, games, ball, 8, eight, pool 8 ball","name":"8ball"},{"emoji":"🎲","description":"dice, luck, games, one, 1, game die","name":"game_die"},{"emoji":"🎳","description":"bowling, games, games","name":"bowling"},{"emoji":"🎴","description":"play, card, flower playing cards","name":"flower_playing_cards"},{"emoji":"🎵","description":"note, musical note, song, music","name":"musical_note"},{"emoji":"🎶","description":"note, song, music, musical notes","name":"notes"},{"emoji":"🎷","description":"instrument, song, music, sax, saxophone","name":"saxophone"},{"emoji":"🎸","description":"music, guitar, instrument, electric, song","name":"guitar"},{"emoji":"🎹","description":"instrument, song, music, piano, musical keyboard","name":"musical_keyboard"},{"emoji":"🎺","description":"music, trumpet, instrument, song","name":"trumpet"},{"emoji":"🎻","description":"music, instrument, violin, sound","name":"violin"},{"emoji":"🎼","description":"musical score, sound, music","name":"musical_score"},{"emoji":"🎽","description":"clothes, running shirt, vest","name":"running_shirt_with_sash"},{"emoji":"🎾","description":"tennis, sport","name":"tennis"},{"emoji":"🎿","description":"scating, sport, skis","name":"ski"},{"emoji":"🏀","description":"basketball, sport, orange","name":"basketball"},{"emoji":"🏁","description":"finish, sport, chequered flag, race","name":"checkered_flag"},{"emoji":"🏂","description":"snowboarder, snowboard, sport, snow","name":"snowboarder"},{"emoji":"🏃","description":"person running, sport, running","name":"person_running"},{"emoji":"🏄","description":"person surfing, surfing, sport","name":"person_surfing"},{"emoji":"🏅","description":"gold, win, medal, sports medal","name":"medal"},{"emoji":"🏆","description":"trophy, win, gold","name":"trophy"},{"emoji":"🏇","description":"horse racing, horse, sport, racing","name":"horse_racing"},{"emoji":"🏈","description":"american football, brown, football, sport","name":"football"},{"emoji":"🏉","description":"rugby football, football, sport","name":"rugby_football"},{"emoji":"🏊","description":"sport, swimming, person swimming","name":"person_swimming"},{"emoji":"🏏","description":"baseball, sport, cricket, cricket game","name":"cricket_game"},{"emoji":"🏐","description":"white, football, volleyball, sport","name":"volleyball"},{"emoji":"🏑","description":"hockey, field hockey, sport, field","name":"field_hockey"},{"emoji":"🏒","description":"hockey, ice hockey, sport","name":"hockey"},{"emoji":"🏓","description":"ping pong, tennis, sport","name":"ping_pong"},{"emoji":"🏠","description":"home, house, building","name":"house"},{"emoji":"🏡","description":"building, house with garden, home, house","name":"house_with_garden"},{"emoji":"🏢","description":"office building, work, building, office","name":"office"},{"emoji":"🏣","description":"building, post, office, Japanese post office","name":"post_office"},{"emoji":"🏤","description":"post office, building, post, office","name":"european_post_office"},{"emoji":"🏥","description":"hospital, building, health","name":"hospital"},{"emoji":"🏦","description":"bank, money, building","name":"bank"},{"emoji":"🏧","description":"atm, ATM sign, blue","name":"atm"},{"emoji":"🏨","description":"hotel, building","name":"hotel"},{"emoji":"🏩","description":"love, building, hotel, love hotel","name":"love_hotel"},{"emoji":"🏪","description":"store, building, shop, groceries, convenience store, convenience","name":"convenience_store"},{"emoji":"🏫","description":"school, building","name":"school"},{"emoji":"🏬","description":"store, building, department store","name":"department_store"},{"emoji":"🏭","description":"factory, work, building","name":"factory"},{"emoji":"🏮","description":"lamp, red paper lantern, light","name":"izakaya_lantern"},{"emoji":"🏯","description":"building, Japanese castle, temple, castle, fortress","name":"japanese_castle"},{"emoji":"🏰","description":"temple, castle, fortress, building","name":"european_castle"},{"emoji":"🏴","description":"black flag, flag, black","name":"flag_black"},{"emoji":"🏸","description":"badminton, racket, sport","name":"badminton"},{"emoji":"🏹","description":"archery, bow and arrow, sport","name":"bow_and_arrow"},{"emoji":"🏺","description":"amphora, vase","name":"amphora"},{"emoji":"🐀","description":"animal, rat","name":"rat"},{"emoji":"🐁","description":"animal, mouse","name":"mouse2"},{"emoji":"🐂","description":"animal, ox","name":"ox"},{"emoji":"🐃","description":", water buffalo","name":"water_buffalo"},{"emoji":"🐄","description":"animal, cow","name":"cow2"},{"emoji":"🐅","description":"animal, tiger","name":"tiger2"},{"emoji":"🐆","description":"animal, leopard","name":"leopard"},{"emoji":"🐇","description":"animal, rabbit, bunny, hair","name":"rabbit2"},{"emoji":"🐈","description":"animal, cat","name":"cat2"},{"emoji":"🐉","description":"animal, dragon","name":"dragon"},{"emoji":"🐊","description":"alagator, animal, crocodile, green","name":"crocodile"},{"emoji":"🐋","description":"animal, whale, blue","name":"whale2"},{"emoji":"🐌","description":"animal, snail","name":"snail"},{"emoji":"🐍","description":"animal, snake","name":"snake"},{"emoji":"🐎","description":"animal, horse","name":"racehorse"},{"emoji":"🐏","description":"animal, ram","name":"ram"},{"emoji":"🐐","description":"animal, goat","name":"goat"},{"emoji":"🐑","description":"animal, ewe","name":"sheep"},{"emoji":"🐒","description":"animal, monkey","name":"monkey"},{"emoji":"🐓","description":"animal, rooster","name":"rooster"},{"emoji":"🐔","description":"chicken, animal","name":"chicken"},{"emoji":"🐕","description":"animal, dog","name":"dog2"},{"emoji":"🐖","description":"animal, pig","name":"pig2"},{"emoji":"🐗","description":"animal, boar","name":"boar"},{"emoji":"🐘","description":"animal, elephant","name":"elephant"},{"emoji":"🐙","description":"animal, octopus","name":"octopus"},{"emoji":"🐚","description":"spiral shell, seashell, sea, beach, ocean","name":"shell"},{"emoji":"🐛","description":"animal, insect, bug","name":"bug"},{"emoji":"🐜","description":"animal, insect, ant, bug","name":"ant"},{"emoji":"🐝","description":"animal, insect, bug, honeybee","name":"bee"},{"emoji":"🐞","description":"animal, insect, bug, lady beetle","name":"beetle"},{"emoji":"🐟","description":"animal, fish","name":"fish"},{"emoji":"🐠","description":"tropical fish, animal","name":"tropical_fish"},{"emoji":"🐡","description":"animal, blowfish","name":"blowfish"},{"emoji":"🐢","description":"animal, turtle, green","name":"turtle"},{"emoji":"🐣","description":"hatching chick, animal","name":"hatching_chick"},{"emoji":"🐤","description":"animal, baby chick","name":"baby_chick"},{"emoji":"🐥","description":"animal, front-facing baby chick","name":"hatched_chick"},{"emoji":"🐦","description":"animal, bird","name":"bird"},{"emoji":"🐧","description":"linux, animal, penguin","name":"penguin"},{"emoji":"🐨","description":"animal, koala","name":"koala"},{"emoji":"🐩","description":"animal, poodle","name":"poodle"},{"emoji":"🐪","description":"animal, camel","name":"dromedary_camel"},{"emoji":"🐫","description":"animal, two-hump camel","name":"camel"},{"emoji":"🐬","description":"animal, dolphin","name":"dolphin"},{"emoji":"🐭","description":"animal, mouse face, face","name":"mouse"},{"emoji":"🐮","description":"animal, face, cow face","name":"cow"},{"emoji":"🐯","description":"tiger face, animal, face","name":"tiger"},{"emoji":"🐰","description":"animal, cute, rabbit face","name":"rabbit"},{"emoji":"🐱","description":"animal, cat face, face, cute","name":"cat"},{"emoji":"🐲","description":"animal, dragon face","name":"dragon_face"},{"emoji":"🐳","description":"animal, spouting whale","name":"whale"},{"emoji":"🐴","description":"animal, face, horse face","name":"horse"},{"emoji":"🐵","description":"monkey face, animal, face","name":"monkey_face"},{"emoji":"🐶","description":"animal, face, dog face","name":"dog"},{"emoji":"🐷","description":"animal, face, pig face","name":"pig"},{"emoji":"🐸","description":"frog, animal, face","name":"frog"},{"emoji":"🐹","description":"animal, face, hamster","name":"hamster"},{"emoji":"🐺","description":"animal, face, wolf","name":"wolf"},{"emoji":"🐻","description":"animal, face, bear","name":"bear"},{"emoji":"🐼","description":"animal, panda","name":"panda_face"},{"emoji":"🐽","description":"animal, pig nose, nose","name":"pig_nose"},{"emoji":"🐾","description":"animal, tracks, paw prints","name":"feet"},{"emoji":"👀","description":"looking, eyes","name":"eyes"},{"emoji":"👂","description":"listen, sound, ear","name":"ear"},{"emoji":"👃","description":"nose, smell","name":"nose"},{"emoji":"👄","description":"mouth","name":"lips"},{"emoji":"👅","description":"tongue, silly, mouth","name":"tongue"},{"emoji":"👆","description":", backhand index pointing up","name":"point_up_2"},{"emoji":"👇","description":", backhand index pointing down","name":"point_down"},{"emoji":"👈","description":", backhand index pointing left","name":"point_left"},{"emoji":"👉","description":", backhand index pointing right","name":"point_right"},{"emoji":"👊","description":", oncoming fist","name":"punch"},{"emoji":"👋","description":", waving hand","name":"wave"},{"emoji":"👌","description":", OK hand","name":"ok_hand"},{"emoji":"👍","description":", thumbs up","name":"thumbsup"},{"emoji":"👎","description":", thumbs down","name":"thumbsdown"},{"emoji":"👏","description":", clapping hands","name":"clap"},{"emoji":"👐","description":", open hands","name":"open_hands"},{"emoji":"👑","description":", crown","name":"crown"},{"emoji":"👒","description":", woman’s hat","name":"womans_hat"},{"emoji":"👓","description":", glasses","name":"eyeglasses"},{"emoji":"👔","description":", necktie","name":"necktie"},{"emoji":"👕","description":", t-shirt","name":"shirt"},{"emoji":"👖","description":", jeans","name":"jeans"},{"emoji":"👗","description":", dress","name":"dress"},{"emoji":"👘","description":", kimono","name":"kimono"},{"emoji":"👙","description":", bikini","name":"bikini"},{"emoji":"👚","description":", woman’s clothes","name":"womans_clothes"},{"emoji":"👛","description":", purse","name":"purse"},{"emoji":"👜","description":", handbag","name":"handbag"},{"emoji":"👝","description":", clutch bag","name":"pouch"},{"emoji":"👞","description":", man’s shoe","name":"mans_shoe"},{"emoji":"👟","description":", running shoe","name":"athletic_shoe"},{"emoji":"👠","description":", high-heeled shoe","name":"high_heel"},{"emoji":"👡","description":", woman’s sandal","name":"sandal"},{"emoji":"👢","description":", woman’s boot","name":"boot"},{"emoji":"👣","description":", footprints","name":"footprints"},{"emoji":"👤","description":", bust in silhouette","name":"bust_in_silhouette"},{"emoji":"👥","description":", busts in silhouette","name":"busts_in_silhouette"},{"emoji":"👦","description":", boy","name":"boy"},{"emoji":"👧","description":", girl","name":"girl"},{"emoji":"👨","description":", man","name":"man"},{"emoji":"👩","description":", woman","name":"woman"},{"emoji":"👪","description":", family","name":"family"},{"emoji":"👫","description":", woman and man holding hands","name":"couple"},{"emoji":"👬","description":", men holding hands","name":"two_men_holding_hands"},{"emoji":"👭","description":", women holding hands","name":"two_women_holding_hands"},{"emoji":"👮","description":", police officer","name":"police_officer"},{"emoji":"👯","description":", people with bunny ears","name":"people_with_bunny_ears_partying"},{"emoji":"👰","description":", bride with veil","name":"bride_with_veil"},{"emoji":"👱","description":", person: blond hair","name":"blond_haired_person"},{"emoji":"👲","description":", man with skullcap","name":"man_with_chinese_cap"},{"emoji":"👳","description":", person wearing turban","name":"person_wearing_turban"},{"emoji":"👴","description":", old man","name":"older_man"},{"emoji":"👵","description":", old woman","name":"older_woman"},{"emoji":"👶","description":", baby","name":"baby"},{"emoji":"👷","description":", construction worker","name":"construction_worker"},{"emoji":"👸","description":", princess","name":"princess"},{"emoji":"👹","description":", ogre","name":"japanese_ogre"},{"emoji":"👺","description":", goblin","name":"japanese_goblin"},{"emoji":"👻","description":"ghost, halloween","name":"ghost"},{"emoji":"👼","description":", baby angel","name":"angel"},{"emoji":"👽","description":", alien","name":"alien"},{"emoji":"👾","description":", alien monster","name":"space_invader"},{"emoji":"👿","description":", angry face with horns","name":"imp"},{"emoji":"💀","description":"spooky, skull, horror, bones","name":"skull"},{"emoji":"💁","description":"person tipping hand, questions","name":"person_tipping_hand"},{"emoji":"💂","description":", guard","name":"guard"},{"emoji":"💃","description":", woman dancing","name":"dancer"},{"emoji":"💄","description":"makeup, lipstick","name":"lipstick"},{"emoji":"💅","description":"beauty, nail polish, makeup","name":"nail_care"},{"emoji":"💆","description":", person getting massage","name":"person_getting_massage"},{"emoji":"💇","description":", person getting haircut","name":"person_getting_haircut"},{"emoji":"💈","description":", barber pole","name":"barber"},{"emoji":"💉","description":", syringe","name":"syringe"},{"emoji":"💊","description":", pill","name":"pill"},{"emoji":"💋","description":", kiss mark","name":"kiss"},{"emoji":"💌","description":", love letter","name":"love_letter"},{"emoji":"💍","description":", ring","name":"ring"},{"emoji":"💎","description":", gem stone","name":"gem"},{"emoji":"💏","description":", kiss","name":"couplekiss"},{"emoji":"💐","description":", bouquet","name":"bouquet"},{"emoji":"💑","description":", couple with heart","name":"couple_with_heart"},{"emoji":"💒","description":", wedding","name":"wedding"},{"emoji":"💓","description":", beating heart","name":"heartbeat"},{"emoji":"💔","description":", broken heart","name":"broken_heart"},{"emoji":"💕","description":", two hearts","name":"two_hearts"},{"emoji":"💖","description":", sparkling heart","name":"sparkling_heart"},{"emoji":"💗","description":", growing heart","name":"heartpulse"},{"emoji":"💘","description":", heart with arrow","name":"cupid"},{"emoji":"💙","description":", blue heart","name":"blue_heart"},{"emoji":"💚","description":", green heart","name":"green_heart"},{"emoji":"💛","description":", yellow heart","name":"yellow_heart"},{"emoji":"💜","description":", purple heart","name":"purple_heart"},{"emoji":"💝","description":", heart with ribbon","name":"gift_heart"},{"emoji":"💞","description":", revolving hearts","name":"revolving_hearts"},{"emoji":"💟","description":", heart decoration","name":"heart_decoration"},{"emoji":"💠","description":", diamond with a dot","name":"diamond_shape_with_a_dot_inside"},{"emoji":"💡","description":", light bulb","name":"bulb"},{"emoji":"💢","description":", anger symbol","name":"anger"},{"emoji":"💣","description":", bomb","name":"bomb"},{"emoji":"💤","description":", zzz","name":"zzz"},{"emoji":"💥","description":", collision","name":"boom"},{"emoji":"💦","description":", sweat droplets","name":"sweat_drops"},{"emoji":"💧","description":", droplet","name":"droplet"},{"emoji":"💨","description":", dashing away","name":"dash"},{"emoji":"💩","description":", pile of poo","name":"poop"},{"emoji":"💪","description":", flexed biceps","name":"muscle"},{"emoji":"💫","description":", dizzy","name":"dizzy"},{"emoji":"💬","description":", speech balloon","name":"speech_balloon"},{"emoji":"💭","description":", thought balloon","name":"thought_balloon"},{"emoji":"💮","description":", white flower","name":"white_flower"},{"emoji":"💯","description":", hundred points","name":"100"},{"emoji":"💰","description":", money bag","name":"moneybag"},{"emoji":"💱","description":", currency exchange","name":"currency_exchange"},{"emoji":"💲","description":", heavy dollar sign","name":"heavy_dollar_sign"},{"emoji":"💳","description":", credit card","name":"credit_card"},{"emoji":"💴","description":", yen banknote","name":"yen"},{"emoji":"💵","description":", dollar banknote","name":"dollar"},{"emoji":"💶","description":", euro banknote","name":"euro"},{"emoji":"💷","description":", pound banknote","name":"pound"},{"emoji":"💸","description":", money with wings","name":"money_with_wings"},{"emoji":"💹","description":", chart increasing with yen","name":"chart"},{"emoji":"💺","description":", seat","name":"seat"},{"emoji":"💻","description":", laptop","name":"computer"},{"emoji":"💼","description":", briefcase","name":"briefcase"},{"emoji":"💽","description":", computer disk","name":"minidisc"},{"emoji":"💾","description":", floppy disk","name":"floppy_disk"},{"emoji":"💿","description":", optical disk","name":"cd"},{"emoji":"📀","description":", dvd","name":"dvd"},{"emoji":"📁","description":", file folder","name":"file_folder"},{"emoji":"📂","description":", open file folder","name":"open_file_folder"},{"emoji":"📃","description":", page with curl","name":"page_with_curl"},{"emoji":"📄","description":", page facing up","name":"page_facing_up"},{"emoji":"📅","description":", calendar","name":"date"},{"emoji":"📆","description":", tear-off calendar","name":"calendar"},{"emoji":"📇","description":", card index","name":"card_index"},{"emoji":"📈","description":", chart increasing","name":"chart_with_upwards_trend"},{"emoji":"📉","description":", chart decreasing","name":"chart_with_downwards_trend"},{"emoji":"📊","description":", bar chart","name":"bar_chart"},{"emoji":"📋","description":", clipboard","name":"clipboard"},{"emoji":"📌","description":", pushpin","name":"pushpin"},{"emoji":"📍","description":", round pushpin","name":"round_pushpin"},{"emoji":"📎","description":", paperclip","name":"paperclip"},{"emoji":"📏","description":", straight ruler","name":"straight_ruler"},{"emoji":"📐","description":", triangular ruler","name":"triangular_ruler"},{"emoji":"📑","description":", bookmark tabs","name":"bookmark_tabs"},{"emoji":"📒","description":", ledger","name":"ledger"},{"emoji":"📓","description":", notebook","name":"notebook"},{"emoji":"📔","description":", notebook with decorative cover","name":"notebook_with_decorative_cover"},{"emoji":"📕","description":", closed book","name":"closed_book"},{"emoji":"📖","description":", open book","name":"book"},{"emoji":"📗","description":", green book","name":"green_book"},{"emoji":"📘","description":", blue book","name":"blue_book"},{"emoji":"📙","description":", orange book","name":"orange_book"},{"emoji":"📚","description":"books, study, school","name":"books"},{"emoji":"📛","description":", name badge","name":"name_badge"},{"emoji":"📜","description":", scroll","name":"scroll"},{"emoji":"📝","description":"pencil, memo, note, school, study","name":"pencil"},{"emoji":"📞","description":"call, telephone receiver, phone","name":"telephone_receiver"},{"emoji":"📟","description":", pager","name":"pager"},{"emoji":"📠","description":", fax machine","name":"fax"},{"emoji":"📡","description":", satellite antenna","name":"satellite"},{"emoji":"📢","description":", loudspeaker","name":"loudspeaker"},{"emoji":"📣","description":", megaphone","name":"mega"},{"emoji":"📤","description":", outbox tray","name":"outbox_tray"},{"emoji":"📥","description":", inbox tray","name":"inbox_tray"},{"emoji":"📦","description":", package","name":"package"},{"emoji":"📧","description":"mail, e-mail","name":"e-mail"},{"emoji":"📨","description":"mail, incoming envelope","name":"incoming_envelope"},{"emoji":"📩","description":"mail, envelope with arrow","name":"envelope_with_arrow"},{"emoji":"📪","description":"closed mailbox with lowered flag, mail","name":"mailbox_closed"},{"emoji":"📫","description":"mail, closed mailbox with raised flag","name":"mailbox"},{"emoji":"📬","description":"mail, open mailbox with raised flag","name":"mailbox_with_mail"},{"emoji":"📭","description":"mail, open mailbox with lowered flag","name":"mailbox_with_no_mail"},{"emoji":"📮","description":", postbox","name":"postbox"},{"emoji":"📯","description":", postal horn","name":"postal_horn"},{"emoji":"📰","description":", newspaper","name":"newspaper"},{"emoji":"📱","description":", mobile phone","name":"iphone"},{"emoji":"📲","description":", mobile phone with arrow","name":"calling"},{"emoji":"📳","description":", vibration mode","name":"vibration_mode"},{"emoji":"📴","description":", mobile phone off","name":"mobile_phone_off"},{"emoji":"📵","description":", no mobile phones","name":"no_mobile_phones"},{"emoji":"📶","description":", antenna bars","name":"signal_strength"},{"emoji":"📷","description":"photo, photography, camera","name":"camera"},{"emoji":"📸","description":"camera with flash, photo, photography","name":"camera_with_flash"},{"emoji":"📹","description":", video camera","name":"video_camera"},{"emoji":"📺","description":", television","name":"tv"},{"emoji":"📻","description":", radio","name":"radio"},{"emoji":"📼","description":", videocassette","name":"vhs"},{"emoji":"📿","description":", prayer beads","name":"prayer_beads"},{"emoji":"🔀","description":", shuffle tracks button","name":"twisted_rightwards_arrows"},{"emoji":"🔁","description":", repeat button","name":"repeat"},{"emoji":"🔂","description":", repeat single button","name":"repeat_one"},{"emoji":"🔃","description":", clockwise vertical arrows","name":"arrows_clockwise"},{"emoji":"🔄","description":", counterclockwise arrows button","name":"arrows_counterclockwise"},{"emoji":"🔅","description":", dim button","name":"low_brightness"},{"emoji":"🔆","description":", bright button","name":"high_brightness"},{"emoji":"🔇","description":", muted speaker","name":"mute"},{"emoji":"🔈","description":", speaker low volume","name":"speaker"},{"emoji":"🔉","description":", speaker medium volume","name":"sound"},{"emoji":"🔊","description":", speaker high volume","name":"loud_sound"},{"emoji":"🔋","description":", battery","name":"battery"},{"emoji":"🔌","description":", electric plug","name":"electric_plug"},{"emoji":"🔍","description":"magnifying glass tilted left, search","name":"mag"},{"emoji":"🔎","description":"search, magnifying glass tilted right","name":"mag_right"},{"emoji":"🔏","description":", locked with pen","name":"lock_with_ink_pen"},{"emoji":"🔐","description":", locked with key","name":"closed_lock_with_key"},{"emoji":"🔑","description":", key","name":"key"},{"emoji":"🔒","description":", locked","name":"lock"},{"emoji":"🔓","description":", unlocked","name":"unlock"},{"emoji":"🔔","description":", bell","name":"bell"},{"emoji":"🔕","description":", bell with slash","name":"no_bell"},{"emoji":"🔖","description":", bookmark","name":"bookmark"},{"emoji":"🔗","description":", link","name":"link"},{"emoji":"🔘","description":", radio button","name":"radio_button"},{"emoji":"🔙","description":", BACK arrow","name":"back"},{"emoji":"🔚","description":", END arrow","name":"end"},{"emoji":"🔛","description":", ON! arrow","name":"on"},{"emoji":"🔜","description":", SOON arrow","name":"soon"},{"emoji":"🔝","description":", TOP arrow","name":"top"},{"emoji":"🔞","description":", no one under eighteen","name":"underage"},{"emoji":"🔟","description":", keycap: 10","name":"keycap_ten"},{"emoji":"🔠","description":", input latin uppercase","name":"capital_abcd"},{"emoji":"🔡","description":", input latin lowercase","name":"abcd"},{"emoji":"🔢","description":", input numbers","name":"1234"},{"emoji":"🔣","description":", input symbols","name":"symbols"},{"emoji":"🔤","description":", input latin letters","name":"abc"},{"emoji":"🔥","description":", fire","name":"fire"},{"emoji":"🔦","description":", flashlight","name":"flashlight"},{"emoji":"🔧","description":", wrench","name":"wrench"},{"emoji":"🔨","description":", hammer","name":"hammer"},{"emoji":"🔩","description":", nut and bolt","name":"nut_and_bolt"},{"emoji":"🔪","description":", kitchen knife","name":"knife"},{"emoji":"🔫","description":", pistol","name":"gun"},{"emoji":"🔬","description":", microscope","name":"microscope"},{"emoji":"🔭","description":", telescope","name":"telescope"},{"emoji":"🔮","description":", crystal ball","name":"crystal_ball"},{"emoji":"🔯","description":", dotted six-pointed star","name":"six_pointed_star"},{"emoji":"🔰","description":", Japanese symbol for beginner","name":"beginner"},{"emoji":"🔱","description":", trident emblem","name":"trident"},{"emoji":"🔲","description":", black square button","name":"black_square_button"},{"emoji":"🔳","description":", white square button","name":"white_square_button"},{"emoji":"🔴","description":", red circle","name":"red_circle"},{"emoji":"🔵","description":", blue circle","name":"blue_circle"},{"emoji":"🔶","description":", large orange diamond","name":"large_orange_diamond"},{"emoji":"🔷","description":", large blue diamond","name":"large_blue_diamond"},{"emoji":"🔸","description":", small orange diamond","name":"small_orange_diamond"},{"emoji":"🔹","description":", small blue diamond","name":"small_blue_diamond"},{"emoji":"🔺","description":", red triangle pointed up","name":"small_red_triangle"},{"emoji":"🔻","description":", red triangle pointed down","name":"small_red_triangle_down"},{"emoji":"🔼","description":", upwards button","name":"arrow_up_small"},{"emoji":"🔽","description":", downwards button","name":"arrow_down_small"},{"emoji":"🕋","description":", kaaba","name":"kaaba"},{"emoji":"🕌","description":", mosque","name":"mosque"},{"emoji":"🕍","description":", synagogue","name":"synagogue"},{"emoji":"🕎","description":", menorah","name":"menorah"},{"emoji":"🕐","description":", one o’clock","name":"clock1"},{"emoji":"🕑","description":", two o’clock","name":"clock2"},{"emoji":"🕒","description":", three o’clock","name":"clock3"},{"emoji":"🕓","description":", four o’clock","name":"clock4"},{"emoji":"🕔","description":", five o’clock","name":"clock5"},{"emoji":"🕕","description":", six o’clock","name":"clock6"},{"emoji":"🕖","description":", seven o’clock","name":"clock7"},{"emoji":"🕗","description":", eight o’clock","name":"clock8"},{"emoji":"🕘","description":", nine o’clock","name":"clock9"},{"emoji":"🕙","description":", ten o’clock","name":"clock10"},{"emoji":"🕚","description":", eleven o’clock","name":"clock11"},{"emoji":"🕛","description":", twelve o’clock","name":"clock12"},{"emoji":"🕜","description":", one-thirty","name":"clock130"},{"emoji":"🕝","description":", two-thirty","name":"clock230"},{"emoji":"🕞","description":", three-thirty","name":"clock330"},{"emoji":"🕟","description":", four-thirty","name":"clock430"},{"emoji":"🕠","description":", five-thirty","name":"clock530"},{"emoji":"🕡","description":", six-thirty","name":"clock630"},{"emoji":"🕢","description":", seven-thirty","name":"clock730"},{"emoji":"🕣","description":", eight-thirty","name":"clock830"},{"emoji":"🕤","description":", nine-thirty","name":"clock930"},{"emoji":"🕥","description":", ten-thirty","name":"clock1030"},{"emoji":"🕦","description":", eleven-thirty","name":"clock1130"},{"emoji":"🕧","description":", twelve-thirty","name":"clock1230"},{"emoji":"🖕","description":", middle finger","name":"middle_finger"},{"emoji":"🖖","description":", vulcan salute","name":"vulcan"},{"emoji":"🗻","description":", mount fuji","name":"mount_fuji"},{"emoji":"🗼","description":", Tokyo tower","name":"tokyo_tower"},{"emoji":"🗽","description":", Statue of Liberty","name":"statue_of_liberty"},{"emoji":"🗾","description":", map of Japan","name":"japan"},{"emoji":"🗿","description":", moai","name":"moyai"},{"emoji":"😀","description":", grinning face","name":"grinning"},{"emoji":"😁","description":", beaming face with smiling eyes","name":"grin"},{"emoji":"😂","description":", face with tears of joy","name":"joy"},{"emoji":"😃","description":", grinning face with big eyes","name":"smiley"},{"emoji":"😄","description":", grinning face with smiling eyes","name":"smile"},{"emoji":"😅","description":", grinning face with sweat","name":"sweat_smile"},{"emoji":"😆","description":", grinning squinting face","name":"laughing"},{"emoji":"😇","description":", smiling face with halo","name":"innocent"},{"emoji":"😈","description":", smiling face with horns","name":"smiling_imp"},{"emoji":"😉","description":", winking face","name":"wink"},{"emoji":"😊","description":", smiling face with smiling eyes","name":"blush"},{"emoji":"😋","description":", face savoring food","name":"yum"},{"emoji":"😌","description":", relieved face","name":"relieved"},{"emoji":"😍","description":", smiling face with heart-eyes","name":"heart_eyes"},{"emoji":"😎","description":", smiling face with sunglasses","name":"sunglasses"},{"emoji":"😏","description":", smirking face","name":"smirk"},{"emoji":"😐","description":", neutral face","name":"neutral_face"},{"emoji":"😑","description":", expressionless face","name":"expressionless"},{"emoji":"😒","description":", unamused face","name":"unamused"},{"emoji":"😓","description":", downcast face with sweat","name":"sweat"},{"emoji":"😔","description":", pensive face","name":"pensive"},{"emoji":"😕","description":", confused face","name":"confused"},{"emoji":"😖","description":", confounded face","name":"confounded"},{"emoji":"😗","description":", kissing face","name":"kissing"},{"emoji":"😘","description":", face blowing a kiss","name":"kissing_heart"},{"emoji":"😙","description":", kissing face with smiling eyes","name":"kissing_smiling_eyes"},{"emoji":"😚","description":", kissing face with closed eyes","name":"kissing_closed_eyes"},{"emoji":"😛","description":", face with tongue","name":"stuck_out_tongue"},{"emoji":"😜","description":", winking face with tongue","name":"stuck_out_tongue_winking_eye"},{"emoji":"😝","description":", squinting face with tongue","name":"stuck_out_tongue_closed_eyes"},{"emoji":"😞","description":", disappointed face","name":"disappointed"},{"emoji":"😟","description":", worried face","name":"worried"},{"emoji":"😠","description":", angry face","name":"angry"},{"emoji":"😡","description":", pouting face","name":"rage"},{"emoji":"😢","description":", crying face","name":"cry"},{"emoji":"😣","description":", persevering face","name":"persevere"},{"emoji":"😤","description":", face with steam from nose","name":"triumph"},{"emoji":"😥","description":", sad but relieved face","name":"disappointed_relieved"},{"emoji":"😦","description":", frowning face with open mouth","name":"frowning"},{"emoji":"😧","description":", anguished face","name":"anguished"},{"emoji":"😨","description":", fearful face","name":"fearful"},{"emoji":"😩","description":", weary face","name":"weary"},{"emoji":"😪","description":", sleepy face","name":"sleepy"},{"emoji":"😫","description":", tired face","name":"tired_face"},{"emoji":"😬","description":", grimacing face","name":"grimacing"},{"emoji":"😭","description":", loudly crying face","name":"sob"},{"emoji":"😮","description":", face with open mouth","name":"open_mouth"},{"emoji":"😯","description":", hushed face","name":"hushed"},{"emoji":"😰","description":", anxious face with sweat","name":"cold_sweat"},{"emoji":"😱","description":", face screaming in fear","name":"scream"},{"emoji":"😲","description":", astonished face","name":"astonished"},{"emoji":"😳","description":", flushed face","name":"flushed"},{"emoji":"😴","description":", sleeping face","name":"sleeping"},{"emoji":"😵","description":", dizzy face","name":"dizzy_face"},{"emoji":"😶","description":", face without mouth","name":"no_mouth"},{"emoji":"😷","description":", face with medical mask","name":"mask"},{"emoji":"😸","description":", grinning cat with smiling eyes","name":"smile_cat"},{"emoji":"😹","description":", cat with tears of joy","name":"joy_cat"},{"emoji":"😺","description":"grinning cat, kitty","name":"smiley_cat"},{"emoji":"😻","description":", smiling cat with heart-eyes","name":"heart_eyes_cat"},{"emoji":"😼","description":", cat with wry smile","name":"smirk_cat"},{"emoji":"😽","description":", kissing cat","name":"kissing_cat"},{"emoji":"😾","description":", pouting cat","name":"pouting_cat"},{"emoji":"😿","description":", crying cat","name":"crying_cat_face"},{"emoji":"🙀","description":", weary cat","name":"scream_cat"},{"emoji":"🙁","description":", slightly frowning face","name":"slight_frown"},{"emoji":"🙂","description":", slightly smiling face","name":"slight_smile"},{"emoji":"🙃","description":", upside-down face","name":"upside_down"},{"emoji":"🙄","description":", face with rolling eyes","name":"rolling_eyes"},{"emoji":"🙅","description":", person gesturing NO","name":"person_gesturing_no"},{"emoji":"🙆","description":", person gesturing OK","name":"person_gesturing_ok"},{"emoji":"🙇","description":", person bowing","name":"person_bowing"},{"emoji":"🙈","description":", see-no-evil monkey","name":"see_no_evil"},{"emoji":"🙉","description":", hear-no-evil monkey","name":"hear_no_evil"},{"emoji":"🙊","description":", speak-no-evil monkey","name":"speak_no_evil"},{"emoji":"🙋","description":", person raising hand","name":"person_raising_hand"},{"emoji":"🙌","description":", raising hands","name":"raised_hands"},{"emoji":"🙍","description":", person frowning","name":"person_frowning"},{"emoji":"🙎","description":", person pouting","name":"person_pouting"},{"emoji":"🙏","description":", folded hands","name":"pray"},{"emoji":"🚀","description":", rocket","name":"rocket"},{"emoji":"🚁","description":", helicopter","name":"helicopter"},{"emoji":"🚂","description":", locomotive","name":"steam_locomotive"},{"emoji":"🚃","description":", railway car","name":"railway_car"},{"emoji":"🚄","description":", high-speed train","name":"bullettrain_side"},{"emoji":"🚅","description":", bullet train","name":"bullettrain_front"},{"emoji":"🚆","description":", train","name":"train2"},{"emoji":"🚇","description":", metro","name":"metro"},{"emoji":"🚈","description":", light rail","name":"light_rail"},{"emoji":"🚉","description":", station","name":"station"},{"emoji":"🚊","description":", tram","name":"tram"},{"emoji":"🚋","description":", tram car","name":"train"},{"emoji":"🚌","description":", bus","name":"bus"},{"emoji":"🚍","description":", oncoming bus","name":"oncoming_bus"},{"emoji":"🚎","description":", trolleybus","name":"trolleybus"},{"emoji":"🚏","description":", bus stop","name":"busstop"},{"emoji":"🚐","description":", minibus","name":"minibus"},{"emoji":"🚑","description":", ambulance","name":"ambulance"},{"emoji":"🚒","description":", fire engine","name":"fire_engine"},{"emoji":"🚓","description":", police car","name":"police_car"},{"emoji":"🚔","description":", oncoming police car","name":"oncoming_police_car"},{"emoji":"🚕","description":", taxi","name":"taxi"},{"emoji":"🚖","description":", oncoming taxi","name":"oncoming_taxi"},{"emoji":"🚗","description":", automobile","name":"red_car"},{"emoji":"🚘","description":", oncoming automobile","name":"oncoming_automobile"},{"emoji":"🚙","description":", sport utility vehicle","name":"blue_car"},{"emoji":"🚚","description":", delivery truck","name":"truck"},{"emoji":"🚛","description":", articulated lorry","name":"articulated_lorry"},{"emoji":"🚜","description":", tractor","name":"tractor"},{"emoji":"🚝","description":", monorail","name":"monorail"},{"emoji":"🚞","description":", mountain railway","name":"mountain_railway"},{"emoji":"🚟","description":", suspension railway","name":"suspension_railway"},{"emoji":"🚠","description":", mountain cableway","name":"mountain_cableway"},{"emoji":"🚡","description":", aerial tramway","name":"aerial_tramway"},{"emoji":"🚢","description":", ship","name":"ship"},{"emoji":"🚣","description":", person rowing boat","name":"person_rowing_boat"},{"emoji":"🚤","description":", speedboat","name":"speedboat"},{"emoji":"🚥","description":", horizontal traffic light","name":"traffic_light"},{"emoji":"🚦","description":", vertical traffic light","name":"vertical_traffic_light"},{"emoji":"🚧","description":", construction","name":"construction"},{"emoji":"🚨","description":", police car light","name":"rotating_light"},{"emoji":"🚩","description":", triangular flag","name":"triangular_flag_on_post"},{"emoji":"🚪","description":", door","name":"door"},{"emoji":"🚫","description":", prohibited","name":"no_entry_sign"},{"emoji":"🚬","description":", cigarette","name":"smoking"},{"emoji":"🚭","description":", no smoking","name":"no_smoking"},{"emoji":"🚮","description":", litter in bin sign","name":"put_litter_in_its_place"},{"emoji":"🚯","description":", no littering","name":"do_not_litter"},{"emoji":"🚰","description":", potable water","name":"potable_water"},{"emoji":"🚱","description":", non-potable water","name":"non-potable_water"},{"emoji":"🚲","description":", bicycle","name":"bike"},{"emoji":"🚳","description":", no bicycles","name":"no_bicycles"},{"emoji":"🚴","description":", person biking","name":"person_biking"},{"emoji":"🚵","description":", person mountain biking","name":"person_mountain_biking"},{"emoji":"🚶","description":", person walking","name":"person_walking"},{"emoji":"🚷","description":", no pedestrians","name":"no_pedestrians"},{"emoji":"🚸","description":", children crossing","name":"children_crossing"},{"emoji":"🚹","description":", men’s room","name":"mens"},{"emoji":"🚺","description":", women’s room","name":"womens"},{"emoji":"🚻","description":", restroom","name":"restroom"},{"emoji":"🚼","description":", baby symbol","name":"baby_symbol"},{"emoji":"🚽","description":", toilet","name":"toilet"},{"emoji":"🚾","description":", water closet","name":"wc"},{"emoji":"🚿","description":", shower","name":"shower"},{"emoji":"🛀","description":", person taking bath","name":"bath"},{"emoji":"🛁","description":", bathtub","name":"bathtub"},{"emoji":"🛂","description":", passport control","name":"passport_control"},{"emoji":"🛃","description":", customs","name":"customs"},{"emoji":"🛄","description":", baggage claim","name":"baggage_claim"},{"emoji":"🛅","description":", left luggage","name":"left_luggage"},{"emoji":"🛌","description":", person in bed","name":"sleeping_accommodation"},{"emoji":"🛐","description":", place of worship","name":"place_of_worship"},{"emoji":"🛫","description":", airplane departure","name":"airplane_departure"},{"emoji":"🛬","description":", airplane arrival","name":"airplane_arriving"},{"emoji":"🤐","description":", zipper-mouth face","name":"zipper_mouth"},{"emoji":"🤑","description":", money-mouth face","name":"money_mouth"},{"emoji":"🤒","description":", face with thermometer","name":"thermometer_face"},{"emoji":"🤓","description":", nerd face","name":"nerd"},{"emoji":"🤔","description":", thinking face","name":"thinking"},{"emoji":"🤕","description":", face with head-bandage","name":"head_bandage"},{"emoji":"🤖","description":"robot, electronics, AI, artificial intelligence, tech, technology","name":"robot"},{"emoji":"🤗","description":"hugging face, AI, artificial intelligence","name":"hugging"},{"emoji":"🤘","description":"hand, rock, sign of the horns","name":"metal"},{"emoji":"🦀","description":"sea creature, crab, animal, sea, seafood","name":"crab"},{"emoji":"🦁","description":"animal, lion","name":"lion_face"},{"emoji":"🦂","description":"animal, scorpion","name":"scorpion"},{"emoji":"🦃","description":"turkey, bird,, thanksgiving","name":"turkey"},{"emoji":"🦄","description":"magic, fantasy, rainbow, unicorn","name":"unicorn"},{"emoji":"🧀","description":"food, mouse, cheese wedge","name":"cheese"},{"emoji":"🇦🇨","description":"flags, flag: Ascension Island, flag","name":"flag_ac"},{"emoji":"🇦🇩","description":"flag: Andorra, flags, flag","name":"flag_ad"},{"emoji":"🇦🇪","description":"flags, flag: United Arab Emirates, flag","name":"flag_ae"},{"emoji":"🇦🇫","description":"flags, flag, flag: Afghanistan","name":"flag_af"},{"emoji":"🇦🇬","description":"flag: Antigua & Barbuda, flags, flag","name":"flag_ag"},{"emoji":"🇦🇮","description":"flags, flag, flag: Anguilla","name":"flag_ai"},{"emoji":"🇦🇱","description":"flag: Albania, flags, flag","name":"flag_al"},{"emoji":"🇦🇲","description":"flags, flag: Armenia, flag","name":"flag_am"},{"emoji":"🇦🇴","description":"flags, flag, flag: Angola","name":"flag_ao"},{"emoji":"🇦🇶","description":"flag: Antarctica, flags, flag","name":"flag_aq"},{"emoji":"🇦🇷","description":"flags, flag: Argentina, flag","name":"flag_ar"},{"emoji":"🇦🇸","description":"flags, flag: American Samoa, flag","name":"flag_as"},{"emoji":"🇦🇹","description":"flags, flag, flag: Austria","name":"flag_at"},{"emoji":"🇦🇺","description":"flags, flag, flag: Australia","name":"flag_au"},{"emoji":"🇦🇼","description":"flag: Aruba, flags, flag","name":"flag_aw"},{"emoji":"🇦🇽","description":"flag: Åland Islands, flags, flag","name":"flag_ax"},{"emoji":"🇦🇿","description":"flags, flag, flag: Azerbaijan","name":"flag_az"},{"emoji":"🇧🇦","description":"flag: Bosnia & Herzegovina, flags, flag","name":"flag_ba"},{"emoji":"🇧🇧","description":"flag: Barbados, flags, flag","name":"flag_bb"},{"emoji":"🇧🇩","description":"flags, flag, flag: Bangladesh","name":"flag_bd"},{"emoji":"🇧🇪","description":"flags, flag, flag: Belgium","name":"flag_be"},{"emoji":"🇧🇫","description":"flags, flag: Burkina Faso, flag","name":"flag_bf"},{"emoji":"🇧🇬","description":"flag: Bulgaria, flags, flag","name":"flag_bg"},{"emoji":"🇧🇭","description":"flags, flag: Bahrain, flag","name":"flag_bh"},{"emoji":"🇧🇮","description":"flag: Burundi, flags, flag","name":"flag_bi"},{"emoji":"🇧🇯","description":"flag: Benin, flags, flag","name":"flag_bj"},{"emoji":"🇧🇱","description":"flags, flag: St. Barthélemy, flag","name":"flag_bl"},{"emoji":"🇧🇲","description":"flags, flag: Bermuda, flag","name":"flag_bm"},{"emoji":"🇧🇳","description":"flags, flag: Brunei, flag","name":"flag_bn"},{"emoji":"🇧🇴","description":"flag: Bolivia, flags, flag","name":"flag_bo"},{"emoji":"🇧🇶","description":"flags, flag: Caribbean Netherlands, flag","name":"flag_bq"},{"emoji":"🇧🇷","description":"flag: Brazil, flags, flag","name":"flag_br"},{"emoji":"🇧🇸","description":"flag: Bahamas, flags, flag","name":"flag_bs"},{"emoji":"🇧🇹","description":"flags, flag: Bhutan, flag","name":"flag_bt"},{"emoji":"🇧🇻","description":"flag: Bouvet Island, flags, flag","name":"flag_bv"},{"emoji":"🇧🇼","description":"flags, flag, flag: Botswana","name":"flag_bw"},{"emoji":"🇧🇾","description":"flags, flag, flag: Belarus","name":"flag_by"},{"emoji":"🇧🇿","description":"flag: Belize, flags, flag","name":"flag_bz"},{"emoji":"🇨🇦","description":"flag: Canada, flags, flag","name":"flag_ca"},{"emoji":"🇨🇨","description":"flags, flag: Cocos (Keeling) Islands, flag","name":"flag_cc"},{"emoji":"🇨🇩","description":"flag: Congo - Kinshasa, flags, flag","name":"flag_cd"},{"emoji":"🇨🇫","description":"flag: Central African Republic, flags, flag","name":"flag_cf"},{"emoji":"🇨🇬","description":"flags, flag: Congo - Brazzaville, flag","name":"flag_cg"},{"emoji":"🇨🇭","description":"flags, flag: Switzerland, flag","name":"flag_ch"},{"emoji":"🇨🇮","description":"flags, flag: Côte d’Ivoire, flag","name":"flag_ci"},{"emoji":"🇨🇰","description":"flag: Cook Islands, flags, flag","name":"flag_ck"},{"emoji":"🇨🇱","description":"flag: Chile, flags, flag","name":"flag_cl"},{"emoji":"🇨🇲","description":"flag: Cameroon, flags, flag","name":"flag_cm"},{"emoji":"🇨🇳","description":"flags, flag, flag: China","name":"flag_cn"},{"emoji":"🇨🇴","description":"flags, flag: Colombia, flag","name":"flag_co"},{"emoji":"🇨🇵","description":"flags, flag, flag: Clipperton Island","name":"flag_cp"},{"emoji":"🇨🇷","description":"flag: Costa Rica, flags, flag","name":"flag_cr"},{"emoji":"🇨🇺","description":"flag: Cuba, flags, flag","name":"flag_cu"},{"emoji":"🇨🇻","description":"flags, flag: Cape Verde, flag","name":"flag_cv"},{"emoji":"🇨🇼","description":"flag: Curaçao, flags, flag","name":"flag_cw"},{"emoji":"🇨🇽","description":"flags, flag: Christmas Island, flag","name":"flag_cx"},{"emoji":"🇨🇾","description":"flags, flag: Cyprus, flag","name":"flag_cy"},{"emoji":"🇨🇿","description":"flags, flag, flag: Czechia","name":"flag_cz"},{"emoji":"🇩🇪","description":"flags, flag, flag: Germany","name":"flag_de"},{"emoji":"🇩🇬","description":"flag: Diego Garcia, flags, flag","name":"flag_dg"},{"emoji":"🇩🇯","description":"flag: Djibouti, flags, flag","name":"flag_dj"},{"emoji":"🇩🇰","description":"flags, flag, flag: Denmark","name":"flag_dk"},{"emoji":"🇩🇲","description":"flags, flag: Dominica, flag","name":"flag_dm"},{"emoji":"🇩🇴","description":"flags, flag: Dominican Republic, flag","name":"flag_do"},{"emoji":"🇩🇿","description":"flag: Algeria, flags, flag","name":"flag_dz"},{"emoji":"🇪🇦","description":"flags, flag: Ceuta & Melilla, flag","name":"flag_ea"},{"emoji":"🇪🇨","description":"flag: Ecuador, flags, flag","name":"flag_ec"},{"emoji":"🇪🇪","description":"flags, flag, flag: Estonia","name":"flag_ee"},{"emoji":"🇪🇬","description":"flag: Egypt, flags, flag","name":"flag_eg"},{"emoji":"🇪🇭","description":"flags, flag: Western Sahara, flag","name":"flag_eh"},{"emoji":"🇪🇷","description":"flags, flag, flag: Eritrea","name":"flag_er"},{"emoji":"🇪🇸","description":"flags, flag: Spain, flag","name":"flag_es"},{"emoji":"🇪🇹","description":"flags, flag: Ethiopia, flag","name":"flag_et"},{"emoji":"🇪🇺","description":"flags, flag: European Union, flag","name":"flag_eu"},{"emoji":"🇫🇮","description":"flag: Finland, flags, flag","name":"flag_fi"},{"emoji":"🇫🇯","description":"flags, flag, flag: Fiji","name":"flag_fj"},{"emoji":"🇫🇰","description":"flags, flag: Falkland Islands, flag","name":"flag_fk"},{"emoji":"🇫🇲","description":"flags, flag: Micronesia, flag","name":"flag_fm"},{"emoji":"🇫🇴","description":"flags, flag: Faroe Islands, flag","name":"flag_fo"},{"emoji":"🇫🇷","description":"flag: France, flags, flag","name":"flag_fr"},{"emoji":"🇬🇦","description":"flags, flag: Gabon, flag","name":"flag_ga"},{"emoji":"🇬🇧","description":"flag: United Kingdom, flags, flag","name":"flag_gb"},{"emoji":"🇬🇩","description":"flag: Grenada, flags, flag","name":"flag_gd"},{"emoji":"🇬🇪","description":"flags, flag, flag: Georgia","name":"flag_ge"},{"emoji":"🇬🇫","description":"flags, flag, flag: French Guiana","name":"flag_gf"},{"emoji":"🇬🇬","description":"flag: Guernsey, flags, flag","name":"flag_gg"},{"emoji":"🇬🇭","description":"flag: Ghana, flags, flag","name":"flag_gh"},{"emoji":"🇬🇮","description":"flags, flag, flag: Gibraltar","name":"flag_gi"},{"emoji":"🇬🇱","description":"flags, flag: Greenland, flag","name":"flag_gl"},{"emoji":"🇬🇲","description":"flag: Gambia, flags, flag","name":"flag_gm"},{"emoji":"🇬🇳","description":"flags, flag: Guinea, flag","name":"flag_gn"},{"emoji":"🇬🇵","description":"flags, flag: Guadeloupe, flag","name":"flag_gp"},{"emoji":"🇬🇶","description":"flags, flag, flag: Equatorial Guinea","name":"flag_gq"},{"emoji":"🇬🇷","description":"flag: Greece, flags, flag","name":"flag_gr"},{"emoji":"🇬🇸","description":"flag: South Georgia & South Sandwich Islands, flags, flag","name":"flag_gs"},{"emoji":"🇬🇹","description":"flags, flag: Guatemala, flag","name":"flag_gt"},{"emoji":"🇬🇺","description":"flag: Guam, flags, flag","name":"flag_gu"},{"emoji":"🇬🇼","description":"flag: Guinea-Bissau, flags, flag","name":"flag_gw"},{"emoji":"🇬🇾","description":"flag: Guyana, flags, flag","name":"flag_gy"},{"emoji":"🇭🇰","description":"flag: Hong Kong SAR China, flags, flag","name":"flag_hk"},{"emoji":"🇭🇲","description":"flags, flag, flag: Heard & McDonald Islands","name":"flag_hm"},{"emoji":"🇭🇳","description":"flags, flag, flag: Honduras","name":"flag_hn"},{"emoji":"🇭🇷","description":"flags, flag: Croatia, flag","name":"flag_hr"},{"emoji":"🇭🇹","description":"flags, flag: Haiti, flag","name":"flag_ht"},{"emoji":"🇭🇺","description":"flags, flag: Hungary, flag","name":"flag_hu"},{"emoji":"🇮🇨","description":"flags, flag, flag: Canary Islands","name":"flag_ic"},{"emoji":"🇮🇩","description":"flags, flag: Indonesia, flag","name":"flag_id"},{"emoji":"🇮🇪","description":"flags, flag: Ireland, flag","name":"flag_ie"},{"emoji":"🇮🇱","description":"flags, flag: Israel, flag","name":"flag_il"},{"emoji":"🇮🇲","description":"flag: Isle of Man, flags, flag","name":"flag_im"},{"emoji":"🇮🇳","description":"flags, flag, flag: India","name":"flag_in"},{"emoji":"🇮🇴","description":"flags, flag: British Indian Ocean Territory, flag","name":"flag_io"},{"emoji":"🇮🇶","description":"flag: Iraq, flags, flag","name":"flag_iq"},{"emoji":"🇮🇷","description":"flags, flag, flag: Iran","name":"flag_ir"},{"emoji":"🇮🇸","description":"flags, flag: Iceland, flag","name":"flag_is"},{"emoji":"🇮🇹","description":"flags, flag: Italy, flag","name":"flag_it"},{"emoji":"🇯🇪","description":"flags, flag, flag: Jersey","name":"flag_je"},{"emoji":"🇯🇲","description":"flags, flag, flag: Jamaica","name":"flag_jm"},{"emoji":"🇯🇴","description":"flag: Jordan, flags, flag","name":"flag_jo"},{"emoji":"🇯🇵","description":"flags, flag: Japan, flag","name":"flag_jp"},{"emoji":"🇰🇪","description":"flag: Kenya, flags, flag","name":"flag_ke"},{"emoji":"🇰🇬","description":"flag: Kyrgyzstan, flags, flag","name":"flag_kg"},{"emoji":"🇰🇭","description":"flag: Cambodia, flags, flag","name":"flag_kh"},{"emoji":"🇰🇮","description":"flag: Kiribati, flags, flag","name":"flag_ki"},{"emoji":"🇰🇲","description":"flags, flag, flag: Comoros","name":"flag_km"},{"emoji":"🇰🇳","description":"flags, flag: St. Kitts & Nevis, flag","name":"flag_kn"},{"emoji":"🇰🇵","description":"flag: North Korea, flags, flag","name":"flag_kp"},{"emoji":"🇰🇷","description":"flags, flag: South Korea, flag","name":"flag_kr"},{"emoji":"🇰🇼","description":"flags, flag, flag: Kuwait","name":"flag_kw"},{"emoji":"🇰🇾","description":"flags, flag: Cayman Islands, flag","name":"flag_ky"},{"emoji":"🇰🇿","description":"flags, flag: Kazakhstan, flag","name":"flag_kz"},{"emoji":"🇱🇦","description":"flags, flag, flag: Laos","name":"flag_la"},{"emoji":"🇱🇧","description":"flags, flag, flag: Lebanon","name":"flag_lb"},{"emoji":"🇱🇨","description":"flag: St. Lucia, flags, flag","name":"flag_lc"},{"emoji":"🇱🇮","description":"flags, flag, flag: Liechtenstein","name":"flag_li"},{"emoji":"🇱🇰","description":"flags, flag, flag: Sri Lanka","name":"flag_lk"},{"emoji":"🇱🇷","description":"flag: Liberia, flags, flag","name":"flag_lr"},{"emoji":"🇱🇸","description":"flag: Lesotho, flags, flag","name":"flag_ls"},{"emoji":"🇱🇹","description":"flags, flag: Lithuania, flag","name":"flag_lt"},{"emoji":"🇱🇺","description":"flags, flag, flag: Luxembourg","name":"flag_lu"},{"emoji":"🇱🇻","description":"flag: Latvia, flags, flag","name":"flag_lv"},{"emoji":"🇱🇾","description":"flags, flag: Libya, flag","name":"flag_ly"},{"emoji":"🇲🇦","description":"flags, flag, flag: Morocco","name":"flag_ma"},{"emoji":"🇲🇨","description":"flags, flag, flag: Monaco","name":"flag_mc"},{"emoji":"🇲🇩","description":"flag: Moldova, flags, flag","name":"flag_md"},{"emoji":"🇲🇪","description":"flag: Montenegro, flags, flag","name":"flag_me"},{"emoji":"🇲🇫","description":"flags, flag, flag: St. Martin","name":"flag_mf"},{"emoji":"🇲🇬","description":"flags, flag, flag: Madagascar","name":"flag_mg"},{"emoji":"🇲🇭","description":"flags, flag: Marshall Islands, flag","name":"flag_mh"},{"emoji":"🇲🇰","description":"flags, flag, flag: North Macedonia","name":"flag_mk"},{"emoji":"🇲🇱","description":"flag: Mali, flags, flag","name":"flag_ml"},{"emoji":"🇲🇲","description":"flags, flag: Myanmar (Burma), flag","name":"flag_mm"},{"emoji":"🇲🇳","description":"flag: Mongolia, flags, flag","name":"flag_mn"},{"emoji":"🇲🇴","description":"flags, flag: Macao SAR China, flag","name":"flag_mo"},{"emoji":"🇲🇵","description":"flags, flag: Northern Mariana Islands, flag","name":"flag_mp"},{"emoji":"🇲🇶","description":"flags, flag: Martinique, flag","name":"flag_mq"},{"emoji":"🇲🇷","description":"flag: Mauritania, flags, flag","name":"flag_mr"},{"emoji":"🇲🇸","description":"flags, flag, flag: Montserrat","name":"flag_ms"},{"emoji":"🇲🇹","description":"flags, flag: Malta, flag","name":"flag_mt"},{"emoji":"🇲🇺","description":"flags, flag, flag: Mauritius","name":"flag_mu"},{"emoji":"🇲🇻","description":"flag: Maldives, flags, flag","name":"flag_mv"},{"emoji":"🇲🇼","description":"flags, flag: Malawi, flag","name":"flag_mw"},{"emoji":"🇲🇽","description":"flag: Mexico, flags, flag","name":"flag_mx"},{"emoji":"🇲🇾","description":"flags, flag: Malaysia, flag","name":"flag_my"},{"emoji":"🇲🇿","description":"flags, flag: Mozambique, flag","name":"flag_mz"},{"emoji":"🇳🇦","description":"flags, flag, flag: Namibia","name":"flag_na"},{"emoji":"🇳🇨","description":"flags, flag, flag: New Caledonia","name":"flag_nc"},{"emoji":"🇳🇪","description":"flags, flag: Niger, flag","name":"flag_ne"},{"emoji":"🇳🇫","description":"flags, flag, flag: Norfolk Island","name":"flag_nf"},{"emoji":"🇳🇬","description":"flags, flag: Nigeria, flag","name":"flag_ng"},{"emoji":"🇳🇮","description":"flags, flag: Nicaragua, flag","name":"flag_ni"},{"emoji":"🇳🇱","description":"flags, flag, flag: Netherlands","name":"flag_nl"},{"emoji":"🇳🇴","description":"flag: Norway, flags, flag","name":"flag_no"},{"emoji":"🇳🇵","description":"flags, flag, flag: Nepal","name":"flag_np"},{"emoji":"🇳🇷","description":"flags, flag: Nauru, flag","name":"flag_nr"},{"emoji":"🇳🇺","description":"flag: Niue, flags, flag","name":"flag_nu"},{"emoji":"🇳🇿","description":"flag: New Zealand, flags, flag","name":"flag_nz"},{"emoji":"🇴🇲","description":"flags, flag: Oman, flag","name":"flag_om"},{"emoji":"🇵🇦","description":"flags, flag, flag: Panama","name":"flag_pa"},{"emoji":"🇵🇪","description":"flag: Peru, flags, flag","name":"flag_pe"},{"emoji":"🇵🇫","description":"flag: French Polynesia, flags, flag","name":"flag_pf"},{"emoji":"🇵🇬","description":"flags, flag: Papua New Guinea, flag","name":"flag_pg"},{"emoji":"🇵🇭","description":"flags, flag, flag: Philippines","name":"flag_ph"},{"emoji":"🇵🇰","description":"flag: Pakistan, flags, flag","name":"flag_pk"},{"emoji":"🇵🇱","description":"flags, flag: Poland, flag","name":"flag_pl"},{"emoji":"🇵🇲","description":"flags, flag, flag: St. Pierre & Miquelon","name":"flag_pm"},{"emoji":"🇵🇳","description":"flags, flag, flag: Pitcairn Islands","name":"flag_pn"},{"emoji":"🇵🇷","description":"flag: Puerto Rico, flags, flag","name":"flag_pr"},{"emoji":"🇵🇸","description":"flags, flag: Palestinian Territories, flag","name":"flag_ps"},{"emoji":"🇵🇹","description":"flag: Portugal, flags, flag","name":"flag_pt"},{"emoji":"🇵🇼","description":"flag: Palau, flags, flag","name":"flag_pw"},{"emoji":"🇵🇾","description":"flag: Paraguay, flags, flag","name":"flag_py"},{"emoji":"🇶🇦","description":"flag: Qatar, flags, flag","name":"flag_qa"},{"emoji":"🇷🇪","description":"flags, flag, flag: Réunion","name":"flag_re"},{"emoji":"🇷🇴","description":"flags, flag, flag: Romania","name":"flag_ro"},{"emoji":"🇷🇸","description":"flags, flag: Serbia, flag","name":"flag_rs"},{"emoji":"🇷🇺","description":"flags, flag, flag: Russia","name":"flag_ru"},{"emoji":"🇷🇼","description":"flags, flag, flag: Rwanda","name":"flag_rw"},{"emoji":"🇸🇦","description":"flags, flag, flag: Saudi Arabia","name":"flag_sa"},{"emoji":"🇸🇧","description":"flag: Solomon Islands, flags, flag","name":"flag_sb"},{"emoji":"🇸🇨","description":"flags, flag: Seychelles, flag","name":"flag_sc"},{"emoji":"🇸🇩","description":"flags, flag, flag: Sudan","name":"flag_sd"},{"emoji":"🇸🇪","description":"flag: Sweden, flags, flag","name":"flag_se"},{"emoji":"🇸🇬","description":"flags, flag, flag: Singapore","name":"flag_sg"},{"emoji":"🇸🇭","description":"flags, flag, flag: St. Helena","name":"flag_sh"},{"emoji":"🇸🇮","description":"flags, flag: Slovenia, flag","name":"flag_si"},{"emoji":"🇸🇯","description":"flag: Svalbard & Jan Mayen, flags, flag","name":"flag_sj"},{"emoji":"🇸🇰","description":"flags, flag, flag: Slovakia","name":"flag_sk"},{"emoji":"🇸🇱","description":"flag: Sierra Leone, flags, flag","name":"flag_sl"},{"emoji":"🇸🇲","description":"flags, flag: San Marino, flag","name":"flag_sm"},{"emoji":"🇸🇳","description":"flags, flag: Senegal, flag","name":"flag_sn"},{"emoji":"🇸🇴","description":"flags, flag, flag: Somalia","name":"flag_so"},{"emoji":"🇸🇷","description":"flag: Suriname, flags, flag","name":"flag_sr"},{"emoji":"🇸🇸","description":"flags, flag: South Sudan, flag","name":"flag_ss"},{"emoji":"🇸🇹","description":"flags, flag: São Tomé & Príncipe, flag","name":"flag_st"},{"emoji":"🇸🇻","description":"flags, flag: El Salvador, flag","name":"flag_sv"},{"emoji":"🇸🇽","description":"flags, flag, flag: Sint Maarten","name":"flag_sx"},{"emoji":"🇸🇾","description":"flags, flag: Syria, flag","name":"flag_sy"},{"emoji":"🇸🇿","description":"flags, flag: Eswatini, flag","name":"flag_sz"},{"emoji":"🇹🇦","description":"flags, flag: Tristan da Cunha, flag","name":"flag_ta"},{"emoji":"🇹🇨","description":"flags, flag, flag: Turks & Caicos Islands","name":"flag_tc"},{"emoji":"🇹🇩","description":"flags, flag: Chad, flag","name":"flag_td"},{"emoji":"🇹🇫","description":"flag: French Southern Territories, flags, flag","name":"flag_tf"},{"emoji":"🇹🇬","description":"flags, flag, flag: Togo","name":"flag_tg"},{"emoji":"🇹🇭","description":"flag: Thailand, flags, flag","name":"flag_th"},{"emoji":"🇹🇯","description":"flag: Tajikistan, flags, flag","name":"flag_tj"},{"emoji":"🇹🇰","description":"flags, flag: Tokelau, flag","name":"flag_tk"},{"emoji":"🇹🇱","description":"flags, flag: Timor-Leste, flag","name":"flag_tl"},{"emoji":"🇹🇲","description":"flags, flag, flag: Turkmenistan","name":"flag_tm"},{"emoji":"🇹🇳","description":"flag: Tunisia, flags, flag","name":"flag_tn"},{"emoji":"🇹🇴","description":"flags, flag, flag: Tonga","name":"flag_to"},{"emoji":"🇹🇷","description":"flags, flag: Turkey, flag","name":"flag_tr"},{"emoji":"🇹🇹","description":"flags, flag, flag: Trinidad & Tobago","name":"flag_tt"},{"emoji":"🇹🇻","description":"flag: Tuvalu, flags, flag","name":"flag_tv"},{"emoji":"🇹🇼","description":"flag: Taiwan, flags, flag","name":"flag_tw"},{"emoji":"🇹🇿","description":"flag: Tanzania, flags, flag","name":"flag_tz"},{"emoji":"🇺🇦","description":"flags, flag, flag: Ukraine","name":"flag_ua"},{"emoji":"🇺🇬","description":"flags, flag: Uganda, flag","name":"flag_ug"},{"emoji":"🇺🇲","description":"flags, flag, flag: U.S. Outlying Islands","name":"flag_um"},{"emoji":"🇺🇸","description":"flags, flag, flag: United States","name":"flag_us"},{"emoji":"🇺🇾","description":"flags, flag, flag: Uruguay","name":"flag_uy"},{"emoji":"🇺🇿","description":"flags, flag, flag: Uzbekistan","name":"flag_uz"},{"emoji":"🇻🇦","description":"flags, flag: Vatican City, flag","name":"flag_va"},{"emoji":"🇻🇨","description":"flag: St. Vincent & Grenadines, flags, flag","name":"flag_vc"},{"emoji":"🇻🇪","description":"flags, flag, flag: Venezuela","name":"flag_ve"},{"emoji":"🇻🇬","description":"flag: British Virgin Islands, flags, flag","name":"flag_vg"},{"emoji":"🇻🇮","description":"flag: U.S. Virgin Islands, flags, flag","name":"flag_vi"},{"emoji":"🇻🇳","description":"flags, flag: Vietnam, flag","name":"flag_vn"},{"emoji":"🇻🇺","description":"flags, flag: Vanuatu, flag","name":"flag_vu"},{"emoji":"🇼🇫","description":"flag: Wallis & Futuna, flags, flag","name":"flag_wf"},{"emoji":"🇼🇸","description":"flag: Samoa, flags, flag","name":"flag_ws"},{"emoji":"🇽🇰","description":"flags, flag, flag: Kosovo","name":"flag_xk"},{"emoji":"🇾🇪","description":"flags, flag, flag: Yemen","name":"flag_ye"},{"emoji":"🇾🇹","description":"flags, flag, flag: Mayotte","name":"flag_yt"},{"emoji":"🇿🇦","description":"flags, flag: South Africa, flag","name":"flag_za"},{"emoji":"🇿🇲","description":"flags, flag: Zambia, flag","name":"flag_zm"},{"emoji":"🇿🇼","description":"flags, flag: Zimbabwe, flag","name":"flag_zw"},{"emoji":"🏳️‍🌈","description":"flag, rainbow flag, pride, gay, flags","name":"rainbow_flag"},{"emoji":"🏳️‍⚧️","description":"trans, pride, flag, flags","name":"transgender_flag"}];
    
    const query = searchInput.value.toLowerCase();
    
    if (query === '') {
      this.resetWorkspaceIconSearch();
      return;
    }
  
    const buttons = Array.from(container.querySelectorAll('.toolbarbutton-1'));
    buttons.forEach(button => button.style.display = 'none');
  
    const filteredIcons = this.searchIcons(query, emojies);
  
    filteredIcons.forEach(emoji => {
      const matchingButton = buttons.find(button => 
        button.getAttribute('label') === emoji
      );
      if (matchingButton) {
        matchingButton.style.display = '';
        container.appendChild(matchingButton);
      }
    });
  }

  onWorkspaceIconContainerClick(event) {
    event.preventDefault();
    this.resetWorkspaceIconSearch();
    const parentPanel = document.getElementById('PanelUI-zen-workspaces-edit');
    PanelUI.showSubView('PanelUI-zen-workspaces-icon-picker', parentPanel);
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
    let icon = this._kIcons[Math.floor(Math.random() * this._kIcons.length)];
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

      if(clearCache) {
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
    let target = event.target.closest("#zen-current-workspace-indicator") || document.getElementById('zen-workspaces-button');
    let panel = document.getElementById('PanelUI-zen-workspaces');
    await this._propagateWorkspaceData({
      ignoreStrip: true,
      clearCache: false
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

    if (!button) {
      button = browser.document.createXULElement('toolbarbutton');
      button.id = 'zen-workspaces-button';
      let navbar = browser.document.getElementById('nav-bar');
      navbar.appendChild(button);
    }

    while (button.firstChild) {
      button.firstChild.remove();
    }

    for (let attr of [...button.attributes]) {
      if (attr.name !== 'id') {
        button.removeAttribute(attr.name);
      }
    }

    button.className = '';

    if (this._workspacesButtonClickListener) {
      button.removeEventListener('click', this._workspacesButtonClickListener);
      this._workspacesButtonClickListener = null;
    }
    if (this._workspaceButtonContextMenuListener) {
      button.removeEventListener('contextmenu', this._workspaceButtonContextMenuListener);
      this._workspaceButtonContextMenuListener = null;
    }

    button.setAttribute('removable', 'true');
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
      const isEssential = tab.getAttribute("zen-essential") === "true";
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
    let tab = gZenUIManager.openAndChangeToTab(Services.prefs.getStringPref('browser.startup.homepage'));

    if(window.uuid){
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

  async changeWorkspace(window, onInit = false) {
    if (!this.workspaceEnabled || this._inChangingWorkspace) {
      return;
    }

    this._inChangingWorkspace = true;
    try {
      await this._performWorkspaceChange(window, onInit);
    } finally {
      this._inChangingWorkspace = false;
    }
  }

  async _performWorkspaceChange(window, onInit) {
    const previousWorkspace = await this.getActiveWorkspace();

    this.activeWorkspace = window.uuid;
    const containerId = window.containerTabId?.toString();
    const workspaces = await this._workspaces();

    // Refresh tab cache
    this.tabContainer._invalidateCachedTabs();

    // First pass: Handle tab visibility and workspace ID assignment
    const visibleTabs = this._processTabVisibility(window.uuid, containerId, workspaces);

    // Second pass: Handle tab selection
    await this._handleTabSelection(window, onInit, visibleTabs, containerId, workspaces);

    // Update UI and state
    await this._updateWorkspaceState(window, onInit);

    // Animate acordingly
    if (previousWorkspace && !this._animatingChange) {
      // we want to know if we are moving forward or backward in sense of animation
      let isNextWorkspace = onInit ||
        (workspaces.workspaces.findIndex((w) => w.uuid === previousWorkspace.uuid)
          < workspaces.workspaces.findIndex((w) => w.uuid === window.uuid));
      gBrowser.tabContainer.setAttribute('zen-workspace-animation', isNextWorkspace ? 'next' : 'previous');
      this._animatingChange = true;
      setTimeout(() => {
        this._animatingChange = false;
        gBrowser.tabContainer.removeAttribute('zen-workspace-animation');
      }, 300);
    }
  }


  _processTabVisibility(workspaceUuid, containerId, workspaces) {
    const visibleTabs = new Set();
    const lastSelectedTab = this._lastSelectedWorkspaceTabs[workspaceUuid];

    for (const tab of gBrowser.tabs) {
      const tabWorkspaceId = tab.getAttribute('zen-workspace-id');
      const isEssential = tab.getAttribute("zen-essential") === "true";
      const tabContextId = tab.getAttribute("usercontextid");

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
    const isEssential = tab.getAttribute("zen-essential") === "true";
    const tabWorkspaceId = tab.getAttribute('zen-workspace-id');
    const tabContextId = tab.getAttribute("usercontextid");

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
        return !tabContextId || tabContextId === "0" || !workspaces.workspaces.some(
            workspace => workspace.containerTabId === parseInt(tabContextId, 10)
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
    else if (lastSelectedTab && this._shouldShowTab(lastSelectedTab, window.uuid, containerId, workspaces) && visibleTabs.has(lastSelectedTab)) {
      tabToSelect = lastSelectedTab;
    }
    // Find first suitable tab
    else {
      tabToSelect = Array.from(visibleTabs)
          .find(tab => !tab.pinned);
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
    const isEssential = tab.getAttribute("zen-essential") === "true";
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
    if (!this.workspaceEnabled || this._inChangingWorkspace) {
      return;
    }

    const parent = browser.ownerGlobal;
    const tab = gBrowser.getTabForBrowser(browser);
    const workspaceID = tab.getAttribute('zen-workspace-id');
    const isEssential = tab.getAttribute("zen-essential") === "true";
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

  async changeWorkspaceShortcut(offset = 1) {
    // Cycle through workspaces
    let workspaces = await this._workspaces();
    let activeWorkspace = await this.getActiveWorkspace();
    let workspaceIndex = workspaces.workspaces.indexOf(activeWorkspace);
    // note: offset can be negative
    let nextWorkspace =
      workspaces.workspaces[(workspaceIndex + offset + workspaces.workspaces.length) % workspaces.workspaces.length];
    await this.changeWorkspace(nextWorkspace);
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
      const matchingWorkspaces = this._workspaceCache.workspaces.filter((workspace) => workspace.containerTabId === userContextId);

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
