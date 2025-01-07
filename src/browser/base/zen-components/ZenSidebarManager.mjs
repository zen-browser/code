class ZenBrowserManagerSidebar extends ZenDOMOperatedFeature {
  _sidebarElement = null;
  _currentPanel = null;
  _lastOpenedPanel = null;
  _hasChangedConfig = true;
  _splitterElement = null;
  _hSplitterElement = null;
  _hasRegisteredPinnedClickOutside = false;
  _isDragging = false;
  contextTab = null;
  sidebar = null;
  forwardButton = null;
  backButton = null;
  progressListener = null;
  _tabBrowserSet = new WeakMap();
  tabBox;

  DEFAULT_MOBILE_USER_AGENT = `Mozilla/5.0 (Android 12; Mobile; rv:129.0) Gecko/20100101 Firefox/${AppConstants.ZEN_FIREFOX_VERSION}`;
  MAX_SIDEBAR_PANELS = Services.prefs.getIntPref('zen.sidebar.max-webpanels');

  init() {
    ChromeUtils.defineLazyGetter(this, 'sidebar', () => document.getElementById('zen-sidebar-web-panel'));
    ChromeUtils.defineLazyGetter(this, 'forwardButton', () => document.getElementById('zen-sidebar-web-panel-forward'));
    ChromeUtils.defineLazyGetter(this, 'backButton', () => document.getElementById('zen-sidebar-web-panel-back'));
    ChromeUtils.defineLazyGetter(this, 'tabBox', () => document.getElementById('tabbrowser-tabbox'));

    this.onlySafeWidthAndHeight();

    this.initProgressListener();
    this.update();
    this.close(); // avoid caching
    this.tabBox.prepend(this.sidebarWrapper);
    this.listenForPrefChanges();
    this.insertIntoContextMenu();
    this.addPositioningListeners();
  }

  onlySafeWidthAndHeight() {
    const panel = this.sidebar;
    const width = panel.style.width;
    const height = panel.style.height;
    panel.setAttribute('style', '');
    panel.style.width = width;
    panel.style.height = height;
  }

  initProgressListener() {
    this.progressListener = {
      QueryInterface: ChromeUtils.generateQI(['nsIWebProgressListener', 'nsISupportsWeakReference']),
      onLocationChange: function (aWebProgress, aRequest, aLocation, aFlags) {
        const browser = this._getCurrentBrowser();
        if (!browser) return;
        const forwardDisabled = this.forwardButton.hasAttribute('disabled');
        const backDisabled = this.backButton.hasAttribute('disabled');

        if (browser.canGoForward === forwardDisabled) {
          if (browser.canGoForward) {
            this.forwardButton.removeAttribute('disabled');
          } else {
            this.forwardButton.setAttribute('disabled', true);
          }
        }
        if (browser.canGoBack === backDisabled) {
          if (browser.canGoBack) {
            this.backButton.removeAttribute('disabled');
          } else {
            this.backButton.setAttribute('disabled', true);
          }
        }
      }.bind(gZenBrowserManagerSidebar),
    };
  }

  get sidebarData() {
    let services = Services.prefs.getStringPref('zen.sidebar.data');
    if (services === '') {
      return {};
    }
    return JSON.parse(services);
  }

  get shouldCloseOnBlur() {
    return Services.prefs.getBoolPref('zen.sidebar.close-on-blur');
  }

  listenForPrefChanges() {
    Services.prefs.addObserver('zen.sidebar.data', this.handleEvent.bind(this));
    Services.prefs.addObserver('zen.sidebar.enabled', this.handleEvent.bind(this));

    this.handleEvent();
  }

  addPositioningListeners() {
    this.sidebar
      .querySelectorAll('.zen-sidebar-web-panel-splitter')
      .forEach((s) => s.addEventListener('mousedown', this.handleSplitterMouseDown.bind(this)));
    this.sidebarHeader.addEventListener('mousedown', this.handleDragPanel.bind(this));
    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  handleSplitterMouseDown(mouseDownEvent) {
    if (this._isDragging) return;
    this._isDragging = true;

    const isHorizontal = mouseDownEvent.target.getAttribute('orient') === 'horizontal';
    setCursor(isHorizontal ? 'ns-resize' : 'ew-resize');
    const reverse = ['left', 'top'].includes(mouseDownEvent.target.getAttribute('side'));
    const direction = isHorizontal ? 'height' : 'width';
    const axis = isHorizontal ? 'Y' : 'X';

    const computedStyle = window.getComputedStyle(this.sidebar);
    const maxSize = parseInt(computedStyle.getPropertyValue(`max-${direction}`).match(/(\d+)px/)?.[1]) || Infinity;
    const minSize = parseInt(computedStyle.getPropertyValue(`min-${direction}`).match(/(\d+)px/)?.[1]) || 0;

    const sidebarSizeStart = this.sidebar.getBoundingClientRect()[direction];

    const startPos = mouseDownEvent[`screen${axis}`];

    const toAdjust = isHorizontal ? 'top' : 'left';
    const sidebarPosStart = parseInt(this.sidebar.style[toAdjust].match(/\d+/));

    let mouseMove = function (e) {
      let mouseMoved = e[`screen${axis}`] - startPos;
      if (reverse) {
        mouseMoved *= -1;
      }
      let newSize = sidebarSizeStart + mouseMoved;
      let currentMax = maxSize;
      const wrapperBox = this.sidebarWrapper.getBoundingClientRect();
      let maxWrapperSize = Infinity;
      if (this.isFloating) {
        maxWrapperSize = reverse ? sidebarPosStart + sidebarSizeStart : wrapperBox[direction] - sidebarPosStart;
      }
      newSize = Math.max(minSize, Math.min(currentMax, maxWrapperSize, newSize));

      window.requestAnimationFrame(() => {
        if (reverse) {
          const actualMoved = newSize - sidebarSizeStart;
          this.sidebar.style[toAdjust] = sidebarPosStart - actualMoved + 'px';
        }
        this.sidebar.style[direction] = `${newSize}px`;
      });
    }.bind(this);

    document.addEventListener('mousemove', mouseMove);
    document.addEventListener(
      'mouseup',
      () => {
        document.removeEventListener('mousemove', mouseMove);
        this._isDragging = false;
        setCursor('auto');
      },
      { once: true }
    );
  }

  handleDragPanel(mouseDownEvent) {
    if (this.sidebarHeaderButtons.find((b) => b.contains(mouseDownEvent.target))) {
      return;
    }
    this._isDragging = true;
    const startTop = this.sidebar.style.top?.match(/\d+/)?.[0] || 0;
    const startLeft = this.sidebar.style.left?.match(/\d+/)?.[0] || 0;

    const sidebarBBox = this.sidebar.getBoundingClientRect();
    const sideBarHeight = sidebarBBox.height;
    const sideBarWidth = sidebarBBox.width;

    const topMouseOffset = startTop - mouseDownEvent.screenY;
    const leftMouseOffset = startLeft - mouseDownEvent.screenX;
    const moveListener = (mouseMoveEvent) => {
      window.requestAnimationFrame(() => {
        let top = mouseMoveEvent.screenY + topMouseOffset;
        let left = mouseMoveEvent.screenX + leftMouseOffset;

        const wrapperBounds = this.sidebarWrapper.getBoundingClientRect();
        top = Math.max(0, Math.min(top, wrapperBounds.height - sideBarHeight));
        left = Math.max(0, Math.min(left, wrapperBounds.width - sideBarWidth));

        this.sidebar.style.top = top + 'px';
        this.sidebar.style.left = left + 'px';
      });
    };

    document.addEventListener('mousemove', moveListener);
    document.addEventListener(
      'mouseup',
      () => {
        document.removeEventListener('mousemove', moveListener);
        this._isDragging = false;
      },
      { once: true }
    );
  }

  onWindowResize() {
    if (!this.isFloating) return;
    const top = parseInt(this.sidebar.style.top?.match(/\d+/)?.[0] || 0);
    const left = parseInt(this.sidebar.style.left?.match(/\d+/)?.[0] || 0);
    const wrapperRect = this.sidebarWrapper.getBoundingClientRect();
    const sidebarRect = this.sidebar.getBoundingClientRect();

    if (sidebarRect.height < wrapperRect.height && top + sidebarRect.height > wrapperRect.height) {
      this.sidebar.style.top = wrapperRect.height - sidebarRect.height + 'px';
    }
    if (sidebarRect.width < wrapperRect.width && left + sidebarRect.width > wrapperRect.width) {
      this.sidebar.style.left = wrapperRect.width - sidebarRect.width + 'px';
    }
  }

  get isFloating() {
    return document.getElementById('zen-sidebar-web-panel').hasAttribute('pinned');
  }

  handleEvent() {
    this._hasChangedConfig = true;
    this.update();
    this._hasChangedConfig = false;

    // https://stackoverflow.com/questions/11565471/removing-event-listener-which-was-added-with-bind
    var clickOutsideHandler = this._handleClickOutside.bind(this);
    let isFloating = this.isFloating;
    if (isFloating && !this._hasRegisteredPinnedClickOutside) {
      document.addEventListener('mouseup', clickOutsideHandler);
      this._hasRegisteredPinnedClickOutside = true;
    } else if (!isFloating && this._hasRegisteredPinnedClickOutside) {
      document.removeEventListener('mouseup', clickOutsideHandler);
      this._hasRegisteredPinnedClickOutside = false;
    }

    const button = document.getElementById('zen-sidepanel-button');
    if (!button) return;
    if (Services.prefs.getBoolPref('zen.sidebar.enabled')) {
      button.removeAttribute('hidden');
    } else {
      button.setAttribute('hidden', 'true');
      this._closeSidebarPanel();
      return;
    }
  }

  _handleClickOutside(event) {
    if (!this.sidebar.hasAttribute('pinned') || this._isDragging || !this.shouldCloseOnBlur) {
      return;
    }
    let target = event.target;
    const closestSelector = [
      '#zen-sidebar-web-panel',
      '#zen-sidebar-panels-wrapper',
      '#zenWebPanelContextMenu',
      '#zen-sidebar-web-panel-splitter',
      '#contentAreaContextMenu',
      '#zen-sidepanel-button',
    ].join(', ');
    if (target.closest(closestSelector)) {
      return;
    }
    this.close();
  }

  toggle() {
    if (!this._currentPanel) {
      this._currentPanel = this._lastOpenedPanel;
    }
    if (document.getElementById('zen-sidebar-web-panel').hasAttribute('hidden')) {
      this.open();
      return;
    }
    this.close();
  }

  open() {
    let sidebar = document.getElementById('zen-sidebar-web-panel');
    sidebar.removeAttribute('hidden');
    this.update();
  }

  update() {
    this._updateWebPanels();
    this._updateSidebarButton();
    this._updateWebPanel();
    this._updateButtons();
  }

  _updateSidebarButton() {
    let button = document.getElementById('zen-sidepanel-button');
    if (!button) return;
    if (!document.getElementById('zen-sidebar-web-panel').hasAttribute('hidden')) {
      button.setAttribute('open', 'true');
    } else {
      button.removeAttribute('open');
    }
  }

  _updateWebPanels() {
    if (Services.prefs.getBoolPref('zen.sidebar.enabled')) {
      this.sidebarElement.removeAttribute('hidden');
    } else {
      this.sidebarElement.setAttribute('hidden', 'true');
      this._closeSidebarPanel();
      return;
    }

    // Don't reload content if at least one of the panel tabs was loaded
    if (this._lastOpenedPanel) {
      return;
    }

    let data = this.sidebarData;
    if (!data.data || !data.index) {
      return;
    }
    this.sidebarElement.innerHTML = '';
    for (let site of data.index) {
      let panel = data.data[site];
      if (!panel || !panel.url) {
        continue;
      }
      let button = document.createXULElement('toolbarbutton');
      button.classList.add('zen-sidebar-panel-button', 'toolbarbutton-1', 'chromeclass-toolbar-additional');
      button.setAttribute('flex', '1');
      button.setAttribute('zen-sidebar-id', site);
      button.setAttribute('context', 'zenWebPanelContextMenu');
      this._getWebPanelIcon(panel.url, button);
      button.addEventListener('click', this._handleClick.bind(this));
      button.addEventListener('dragstart', this._handleDragStart.bind(this));
      button.addEventListener('dragover', this._handleDragOver.bind(this));
      button.addEventListener('dragenter', this._handleDragEnter.bind(this));
      button.addEventListener('dragend', this._handleDragEnd.bind(this));
      this.sidebarElement.appendChild(button);
    }
    const addButton = document.getElementById('zen-sidebar-add-panel-button');
    if (data.index.length < this.MAX_SIDEBAR_PANELS) {
      addButton.removeAttribute('hidden');
    } else {
      addButton.setAttribute('hidden', 'true');
    }
  }

  async _openAddPanelDialog() {
    let dialogURL = 'chrome://browser/content/places/zenNewWebPanel.xhtml';
    let features = 'centerscreen,chrome,modal,resizable=no';
    let aParentWindow = Services.wm.getMostRecentWindow('navigator:browser');

    if (aParentWindow?.gDialogBox) {
      await aParentWindow.gDialogBox.open(dialogURL, {});
    } else {
      aParentWindow.openDialog(dialogURL, '', features, {});
    }
  }

  _setPinnedToElements() {
    let sidebar = document.getElementById('zen-sidebar-web-panel');
    sidebar.setAttribute('pinned', 'true');
    document.getElementById('zen-sidebar-web-panel-pinned').setAttribute('pinned', 'true');
  }

  _removePinnedFromElements() {
    let sidebar = document.getElementById('zen-sidebar-web-panel');
    sidebar.removeAttribute('pinned');
    document.getElementById('zen-sidebar-web-panel-pinned').removeAttribute('pinned');
  }

  _closeSidebarPanel() {
    let sidebar = document.getElementById('zen-sidebar-web-panel');
    sidebar.setAttribute('hidden', 'true');
    this._lastOpenedPanel = this._currentPanel;
    this._currentPanel = null;
  }

  _handleClick(event) {
    let target = event.target;
    let panelId = target.getAttribute('zen-sidebar-id');
    if (this._currentPanel === panelId) {
      return;
    }
    this._currentPanel = panelId;
    this._updateWebPanel();
  }

  _handleDragStart(event) {
    this.__dragingElement = event.target;
    this.__dragingIndex = Array.prototype.indexOf.call(event.target.parentNode.children, event.target);
    event.target.style.opacity = '0.7';

    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/html', event.target.innerHTML);
    event.dataTransfer.setData('text/plain', event.target.id);
  }

  _handleDragOver(event) {}

  _handleDragEnter(event) {
    if (typeof this.__dragingElement === 'undefined') {
      return;
    }
    const target = event.target;
    const elIndex = Array.prototype.indexOf.call(target.parentNode.children, target);
    if (elIndex < this.__dragingIndex) {
      target.before(this.__dragingElement);
      this.__dragingIndex = elIndex - 1;
    }
    target.after(this.__dragingElement);
    this.__dragingIndex = elIndex + 1;
  }

  _handleDragEnd(event) {
    event.target.style.opacity = '1';

    let data = this.sidebarData;
    let newPos = [];
    for (let element of this.__dragingElement.parentNode.children) {
      let panelId = element.getAttribute('zen-sidebar-id');
      newPos.push(panelId);
    }
    data.index = newPos;
    Services.prefs.setStringPref('zen.sidebar.data', JSON.stringify(data));
    this._currentPanel = this.__dragingElement.getAttribute('zen-sidebar-id');
    this.open();
    this.__dragingElement = undefined;
  }

  _createNewPanel(url) {
    let data = this.sidebarData;
    let newName = 'p' + new Date().getTime();
    data.index.push(newName);
    data.data[newName] = {
      url: url,
      ua: false,
    };
    Services.prefs.setStringPref('zen.sidebar.data', JSON.stringify(data));
    this._currentPanel = newName;
    this.open();
  }

  _updateButtons() {
    for (let button of this.sidebarElement.querySelectorAll('.zen-sidebar-panel-button')) {
      if (button.getAttribute('zen-sidebar-id') === this._currentPanel) {
        button.setAttribute('selected', 'true');
      } else {
        button.removeAttribute('selected');
      }
    }
  }

  _hideAllWebPanels() {
    let sidebar = document.getElementById('zen-sidebar-web-panel');
    for (let browser of sidebar.querySelectorAll('browser[zen-sidebar-id]')) {
      browser.setAttribute('hidden', 'true');
      browser.docShellIsActive = false;
      browser.zenModeActive = false;
    }
  }

  get introductionPanel() {
    return document.getElementById('zen-sidebar-introduction-panel');
  }

  _updateWebPanel() {
    this._updateButtons();
    // let sidebar = document.getElementById("zen-sidebar-web-panel");
    this._hideAllWebPanels();
    if (!this._currentPanel) {
      this.introductionPanel.removeAttribute('hidden');
      this.forwardButton.setAttribute('disabled', true);
      this.backButton.setAttribute('disabled', true);
      return;
    }
    this.introductionPanel.setAttribute('hidden', 'true');
    let existantWebview = this._getCurrentBrowser();
    if (existantWebview) {
      existantWebview.docShellIsActive = true;
      existantWebview.zenModeActive = true;
      existantWebview.removeAttribute('hidden');
      document.getElementById('zen-sidebar-web-panel-title').textContent = existantWebview.contentTitle;
      return;
    }
    let data = this._getWebPanelData(this._currentPanel);
    let browser = this._createWebPanelBrowser(data);
    let browserContainers = document.getElementById('zen-sidebar-web-panel-browser-containers');
    browserContainers.appendChild(browser);
    browser.addProgressListener(this.progressListener, Ci.nsIWebProgress.NOTIFY_LOCATION);
    if (data.ua) {
      browser.browsingContext.customUserAgent = this.DEFAULT_MOBILE_USER_AGENT;
      browser.reload();
    }
    browser.docShellIsActive = true;
    browser.zenModeActive = true;
  }

  _getWebPanelData(id) {
    let data = this.sidebarData;
    let panel = data.data[id];
    if (!panel || !panel.url) {
      return {};
    }
    return {
      id: id,
      ...panel,
    };
  }

  getTabForBrowser(browser) {
    return this._tabBrowserSet.get(browser);
  }

  setTabForBrowser(browser, tab) {
    this._tabBrowserSet.set(browser, tab);
  }

  removeTabForBrowser(browser) {
    this._tabBrowserSet.delete(browser);
  }

  _createWebPanelBrowser(data) {
    const titleContainer = document.getElementById('zen-sidebar-web-panel-title');
    titleContainer.textContent = 'Loading...';
    let browser = gBrowser.createBrowser({
      userContextId: data.userContextId,
    });
    const tab = this.sidebar.querySelector(`[zen-sidebar-id='${data.id}']`);
    this.setTabForBrowser(browser, tab);
    tab.linkedBrowser = browser;
    tab.permanentKey = browser.permanentKey;
    browser.setAttribute('disablefullscreen', 'true');
    browser.setAttribute('src', data.url);
    browser.setAttribute('zen-sidebar-id', data.id);
    browser.addEventListener(
      'pagetitlechanged',
      function (event) {
        let browser = event.target;
        let title = browser.contentTitle;
        if (!title) {
          return;
        }
        let id = browser.getAttribute('zen-sidebar-id');
        if (id === this._currentPanel) {
          titleContainer.textContent = title;
        }
      }.bind(this)
    );
    return browser;
  }

  _getWebPanelIcon(url, element) {
    let { preferredURI } = Services.uriFixup.getFixupURIInfo(url);
    element.setAttribute('image', `page-icon:${preferredURI.spec}`);
    fetch(`https://s2.googleusercontent.com/s2/favicons?domain_url=${preferredURI.spec}`).then(async (response) => {
      if (response.ok) {
        let blob = await response.blob();
        let reader = new FileReader();
        reader.onload = function () {
          element.setAttribute('image', reader.result);
        };
        reader.readAsDataURL(blob);
      }
    });
  }

  _getBrowserById(id) {
    let sidebar = document.getElementById('zen-sidebar-web-panel');
    return sidebar.querySelector(`browser[zen-sidebar-id="${id}"]`);
  }

  _getCurrentBrowser() {
    return this._getBrowserById(this._currentPanel);
  }

  reload() {
    let browser = this._getCurrentBrowser();
    if (browser) {
      browser.reload();
    }
  }

  forward() {
    let browser = this._getCurrentBrowser();
    if (browser) {
      browser.goForward();
    }
  }

  back() {
    let browser = this._getCurrentBrowser();
    if (browser) {
      browser.goBack();
    }
  }

  home() {
    let browser = this._getCurrentBrowser();
    if (browser) {
      browser.gotoIndex();
    }
  }

  close() {
    this._hideAllWebPanels();
    this._closeSidebarPanel();
    this._updateSidebarButton();
  }

  togglePinned(elem) {
    if (this.sidebar.hasAttribute('pinned')) {
      this._removePinnedFromElements();
    } else {
      this._setPinnedToElements();
    }
    this.update();
  }

  get sidebarElement() {
    if (!this._sidebarElement) {
      this._sidebarElement = document.getElementById('zen-sidebar-panels-sites');
    }
    return this._sidebarElement;
  }

  get splitterElement() {
    if (!this._splitterElement) {
      this._splitterElement = document.getElementById('zen-sidebar-web-panel-splitter');
    }
    return this._splitterElement;
  }

  get hSplitterElement() {
    if (!this._hSplitterElement) {
      this._hSplitterElement = document.getElementById('zen-sidebar-web-panel-hsplitter');
    }
    return this._hSplitterElement;
  }

  get sidebarHeader() {
    if (!this._sidebarHeader) {
      this._sidebarHeader = document.getElementById('zen-sidebar-web-header');
    }
    return this._sidebarHeader;
  }

  get sidebarWrapper() {
    if (!this._sideBarWrapper) {
      this._sideBarWrapper = document.getElementById('zen-sidebar-web-panel-wrapper');
    }
    return this._sideBarWrapper;
  }

  get sidebarHeaderButtons() {
    if (!this._sidebarHeaderButtons) {
      this._sidebarHeaderButtons = [...this.sidebarHeader.querySelectorAll('.toolbarbutton-1')];
    }
    return this._sidebarHeaderButtons;
  }

  // Context menu

  updateContextMenu(aPopupMenu) {
    let panel =
      aPopupMenu.triggerNode && (aPopupMenu.triggerNode || aPopupMenu.triggerNode.closest('toolbarbutton[zen-sidebar-id]'));
    if (!panel) {
      return;
    }
    let id = panel.getAttribute('zen-sidebar-id');
    this.contextTab = id;
    let data = this._getWebPanelData(id);
    let browser = this._getBrowserById(id);
    let isMuted = browser && browser.audioMuted;
    let mutedContextItem = document.getElementById('context_zenToggleMuteWebPanel');
    document.l10n.setAttributes(
      mutedContextItem,
      !isMuted ? 'zen-web-side-panel-context-mute-panel' : 'zen-web-side-panel-context-unmute-panel'
    );
    if (!isMuted) {
      mutedContextItem.setAttribute('muted', 'true');
    } else {
      mutedContextItem.removeAttribute('muted');
    }
    document.l10n.setAttributes(
      document.getElementById('context_zenToogleUAWebPanel'),
      data.ua ? 'zen-web-side-panel-context-disable-ua' : 'zen-web-side-panel-context-enable-ua'
    );
    if (!browser) {
      document.getElementById('context_zenUnloadWebPanel').setAttribute('disabled', 'true');
    } else {
      document.getElementById('context_zenUnloadWebPanel').removeAttribute('disabled');
    }
  }

  createContainerTabMenu(event) {
    let window = event.target.ownerGlobal;
    let data = this.sidebarData;
    let panelData = data.data[this.contextTab];
    return window.createUserContextMenu(event, {
      isContextMenu: true,
      excludeUserContextId: panelData.userContextId,
      showDefaultTab: true,
    });
  }

  contextChangeContainerTab(event) {
    let data = this.sidebarData;
    let userContextId = parseInt(event.target.getAttribute('data-usercontextid'));
    data.data[this.contextTab].userContextId = userContextId;
    Services.prefs.setStringPref('zen.sidebar.data', JSON.stringify(data));
    let browser = this._getBrowserById(this.contextTab);
    if (browser) {
      browser.remove();
      // We need to re-apply a new browser so it takes the new userContextId
      this._updateWebPanel();
    }
  }

  contextOpenNewTab() {
    let browser = this._getBrowserById(this.contextTab);
    let data = this.sidebarData;
    let panel = data.data[this.contextTab];
    let url = browser == null ? panel.url : browser.currentURI.spec;
    gZenUIManager.openAndChangeToTab(url);
    this.close();
  }

  contextToggleMuteAudio() {
    let browser = this._getBrowserById(this.contextTab);
    if (browser.audioMuted) {
      browser.unmute();
    } else {
      browser.mute();
    }
  }

  contextToggleUserAgent() {
    let browser = this._getBrowserById(this.contextTab);
    browser.browsingContext.customUserAgent = browser.browsingContext.customUserAgent ? null : this.DEFAULT_MOBILE_USER_AGENT;
    let data = this.sidebarData;
    data.data[this.contextTab].ua = !data.data[this.contextTab].ua;
    Services.prefs.setStringPref('zen.sidebar.data', JSON.stringify(data));
    browser.reload();
  }

  contextDelete() {
    let data = this.sidebarData;
    delete data.data[this.contextTab];
    data.index = data.index.filter((id) => id !== this.contextTab);
    let browser = this._getBrowserById(this.contextTab);
    if (browser) {
      browser.remove();
      document.getElementById('zen-sidebar-web-panel-title').textContent = '';
    }
    this._currentPanel = null;
    this._lastOpenedPanel = null;
    this.update();
    Services.prefs.setStringPref('zen.sidebar.data', JSON.stringify(data));
  }

  contextUnload() {
    let browser = this._getBrowserById(this.contextTab);
    this.removeTabForBrowser(browser);
    browser.remove();
    document.getElementById('zen-sidebar-web-panel-title').textContent = '';
    this._closeSidebarPanel();
    this.close();
    this._lastOpenedPanel = null;
  }

  insertIntoContextMenu() {
    const sibling = document.getElementById('context-stripOnShareLink');
    const menuitem = document.createXULElement('menuitem');
    menuitem.setAttribute('id', 'context-zenAddToWebPanel');
    menuitem.setAttribute('hidden', 'true');
    menuitem.setAttribute('oncommand', 'gZenBrowserManagerSidebar.addPanelFromContextMenu();');
    menuitem.setAttribute('data-l10n-id', 'zen-web-side-panel-context-add-to-panel');
    sibling.insertAdjacentElement('afterend', menuitem);
  }

  addPanelFromContextMenu() {
    const url = gContextMenu.linkURL || gContextMenu.target.ownerDocument.location.href;
    this._createNewPanel(url);
  }
}

window.gZenBrowserManagerSidebar = new ZenBrowserManagerSidebar();
