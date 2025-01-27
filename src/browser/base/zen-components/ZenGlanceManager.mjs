{
  class ZenGlanceManager extends ZenDOMOperatedFeature {
    #currentBrowser = null;
    #currentTab = null;

    _animating = false;
    _lazyPref = {};

    init() {
      window.addEventListener('keydown', this.onKeyDown.bind(this));
      window.addEventListener('TabClose', this.onTabClose.bind(this));

      XPCOMUtils.defineLazyPreferenceGetter(
        this._lazyPref,
        'SHOULD_OPEN_EXTERNAL_TABS_IN_GLANCE',
        'zen.glance.open-essential-external-links',
        false
      );

      ChromeUtils.defineLazyGetter(this, 'sidebarButtons', () => document.getElementById('zen-glance-sidebar-container'));

      document.getElementById('tabbrowser-tabpanels').addEventListener('click', this.onOverlayClick.bind(this));

      Services.obs.addObserver(this, 'quit-application-requested');
    }

    onKeyDown(event) {
      if (event.key === 'Escape' && this.#currentBrowser) {
        event.preventDefault();
        event.stopPropagation();
        this.closeGlance();
      }
    }

    onOverlayClick(event) {
      if (event.target === this.overlay && event.originalTarget !== this.contentWrapper) {
        this.closeGlance();
      }
    }

    observe(subject, topic) {
      switch (topic) {
        case 'quit-application-requested':
          this.onUnload();
          break;
      }
    }

    onUnload() {
      // clear everything
      if (this.#currentBrowser) {
        gBrowser.removeTab(this.#currentTab);
      }
    }

    getTabPosition(tab) {
      return Math.max(gBrowser._numVisiblePinTabs, tab._tPos) + 1;
    }

    createBrowserElement(url, currentTab, existingTab = null) {
      const newTabOptions = {
        userContextId: currentTab.getAttribute('usercontextid') || '',
        skipBackgroundNotify: true,
        insertTab: true,
        skipLoad: false,
        index: this.getTabPosition(currentTab),
      };
      this.currentParentTab = currentTab;
      const newTab = existingTab ?? gBrowser.addTrustedTab(Services.io.newURI(url).spec, newTabOptions);

      gBrowser.selectedTab = newTab;
      currentTab.querySelector('.tab-content').appendChild(newTab);
      newTab.setAttribute('zen-glance-tab', true);
      this.#currentBrowser = newTab.linkedBrowser;
      this.#currentTab = newTab;
      return this.#currentBrowser;
    }

    openGlance(data, existingTab = null, ownerTab = null) {
      if (this.#currentBrowser) {
        return;
      }

      const initialX = data.x;
      const initialY = data.y;
      const initialWidth = data.width;
      const initialHeight = data.height;

      this.browserWrapper?.removeAttribute('animate');
      this.browserWrapper?.removeAttribute('animate-end');
      this.browserWrapper?.removeAttribute('animate-full');
      this.browserWrapper?.removeAttribute('animate-full-end');
      this.browserWrapper?.removeAttribute('has-finished-animation');
      this.overlay?.removeAttribute('post-fade-out');

      const currentTab = ownerTab ?? gBrowser.selectedTab;

      this.animatingOpen = true;
      this._animating = true;

      const browserElement = this.createBrowserElement(data.url, currentTab, existingTab);

      this.overlay = browserElement.closest('.browserSidebarContainer');
      this.browserWrapper = browserElement.closest('.browserContainer');
      this.contentWrapper = browserElement.closest('.browserStack');

      this.browserWrapper.prepend(this.sidebarButtons);

      this.overlay.classList.add('zen-glance-overlay');

      this.browserWrapper.removeAttribute('animate-end');
      window.requestAnimationFrame(() => {
        this.quickOpenGlance();

        this.overlay.removeAttribute('fade-out');
        this.browserWrapper.setAttribute('animate', true);
        this.browserWrapper.style.top = `${initialY + initialHeight / 2}px`;
        this.browserWrapper.style.left = `${initialX + initialWidth / 2}px`;
        this.browserWrapper.style.width = `${initialWidth}px`;
        this.browserWrapper.style.height = `${initialHeight}px`;
        this.browserWrapper.style.opacity = 0.8;
        this.overlay.style.overflow = 'visible';
        gZenUIManager.motion
          .animate(
            this.browserWrapper,
            {
              top: '50%',
              left: '50%',
              width: '85%',
              height: '100%',
              opacity: 1,
            },
            {
              duration: 0.4,
              type: 'spring',
              bounce: 0.2,
            }
          )
          .then(() => {
            this.overlay.style.removeProperty('overflow');
            this.browserWrapper.removeAttribute('animate');
            this.browserWrapper.setAttribute('animate-end', true);
            this.browserWrapper.setAttribute('has-finished-animation', true);
            this._animating = false;
            this.animatingOpen = false;
          });
      });
    }

    closeGlance({ noAnimation = false, onTabClose = false } = {}) {
      if (this._animating || !this.#currentBrowser || this.animatingOpen || this._duringOpening) {
        return;
      }

      this.browserWrapper.removeAttribute('has-finished-animation');
      if (noAnimation) {
        this.quickCloseGlance({ closeCurrentTab: false });
        this.#currentBrowser = null;
        this.#currentTab = null;
        return;
      }

      this._animating = true;

      gBrowser._insertTabAtIndex(this.#currentTab, {
        index: this.getTabPosition(this.currentParentTab),
      });

      let quikcCloseZen = false;
      if (onTabClose) {
        // Create new tab if no more ex
        if (gBrowser.tabs.length === 1) {
          gBrowser.selectedTab = gZenUIManager.openAndChangeToTab(Services.prefs.getStringPref('browser.startup.homepage'));
          return;
        } else if (gBrowser.selectedTab === this.#currentTab) {
          this._duringOpening = true;
          gBrowser.tabContainer.advanceSelectedTab(1, true); // to skip the current tab
          this._duringOpening = false;
          quikcCloseZen = true;
        }
      }

      // do NOT touch here, I don't know what it does, but it works...
      window.requestAnimationFrame(() => {
        this.#currentTab.style.display = 'none';
        this.browserWrapper.removeAttribute('animate');
        this.browserWrapper.removeAttribute('animate-end');
        this.overlay.setAttribute('fade-out', true);
        window.requestAnimationFrame(() => {
          this.quickCloseGlance({ justAnimateParent: true });
          this.browserWrapper.setAttribute('animate', true);
          setTimeout(() => {
            if (!this.currentParentTab) {
              return;
            }

            if (!onTabClose || quikcCloseZen) {
              this.quickCloseGlance();
            }
            this.overlay.removeAttribute('fade-out');
            this.browserWrapper.removeAttribute('animate');

            this.lastCurrentTab = this.#currentTab;

            this.overlay.classList.remove('zen-glance-overlay');
            gBrowser._getSwitcher().setTabStateNoAction(this.lastCurrentTab, gBrowser.AsyncTabSwitcher.STATE_UNLOADED);

            if (!onTabClose && gBrowser.selectedTab === this.lastCurrentTab) {
              this._duringOpening = true;
              gBrowser.selectedTab = this.currentParentTab;
            }

            // reset everything
            this.currentParentTab = null;
            this.browserWrapper = null;
            this.overlay = null;
            this.contentWrapper = null;

            this.lastCurrentTab.removeAttribute('zen-glance-tab');
            this.lastCurrentTab._closingGlance = true;

            gBrowser.tabContainer._invalidateCachedTabs();
            gBrowser.removeTab(this.lastCurrentTab, { animate: true });

            this.#currentTab = null;
            this.#currentBrowser = null;

            this.lastCurrentTab = null;
            this._duringOpening = false;

            this._animating = false;
          }, 400);
        });
      });
    }

    quickOpenGlance() {
      if (!this.#currentBrowser || this._duringOpening) {
        return;
      }
      this._duringOpening = true;
      try {
        gBrowser.selectedTab = this.#currentTab;
      } catch (e) {}

      this.currentParentTab.linkedBrowser
        .closest('.browserSidebarContainer')
        .classList.add('deck-selected', 'zen-glance-background');
      this.currentParentTab.linkedBrowser.closest('.browserSidebarContainer').classList.remove('zen-glance-overlay');
      this.currentParentTab.linkedBrowser.zenModeActive = true;
      this.#currentBrowser.zenModeActive = true;
      this.currentParentTab.linkedBrowser.docShellIsActive = true;
      this.#currentBrowser.docShellIsActive = true;
      this.#currentBrowser.setAttribute('zen-glance-selected', true);

      this.currentParentTab._visuallySelected = true;
      this.overlay.classList.add('deck-selected');

      this._duringOpening = false;
    }

    quickCloseGlance({ closeCurrentTab = true, closeParentTab = true, justAnimateParent = false } = {}) {
      const parentHasBrowser = !!this.currentParentTab.linkedBrowser;
      if (!justAnimateParent) {
        if (parentHasBrowser) {
          if (closeParentTab) {
            this.currentParentTab.linkedBrowser.closest('.browserSidebarContainer').classList.remove('deck-selected');
          }
          this.currentParentTab.linkedBrowser.zenModeActive = false;
        }
        this.#currentBrowser.zenModeActive = false;
        if (closeParentTab && parentHasBrowser) {
          this.currentParentTab.linkedBrowser.docShellIsActive = false;
        }
        if (closeCurrentTab) {
          this.#currentBrowser.docShellIsActive = false;
          this.overlay.classList.remove('deck-selected');
        }
        if (!this.currentParentTab._visuallySelected && closeParentTab) {
          this.currentParentTab._visuallySelected = false;
        }
        this.#currentBrowser.removeAttribute('zen-glance-selected');
      }
      if (parentHasBrowser) {
        this.currentParentTab.linkedBrowser.closest('.browserSidebarContainer').classList.remove('zen-glance-background');
      }
    }

    onLocationChange(_) {
      if (this._duringOpening) {
        return;
      }
      if (gBrowser.selectedTab === this.#currentTab && !this.animatingOpen && !this._duringOpening && this.#currentBrowser) {
        this.quickOpenGlance();
        return;
      }
      if (gBrowser.selectedTab === this.currentParentTab && this.#currentBrowser) {
        this.quickOpenGlance();
      } else if ((!this.animatingFullOpen || this.animatingOpen) && this.#currentBrowser) {
        this.closeGlance();
      }
    }

    onTabClose(event) {
      if (event.target === this.currentParentTab) {
        this.closeGlance({ onTabClose: true });
      }
    }

    tabDomainsDiffer(tab1, url2) {
      try {
        if (!tab1) {
          return true;
        }
        let url1 = tab1.linkedBrowser.currentURI.spec;
        if (url1.startsWith('about:')) {
          return true;
        }
        return Services.io.newURI(url1).host !== url2.host;
      } catch (e) {
        return true;
      }
    }

    shouldOpenTabInGlance(tab, uri) {
      let owner = tab.owner;
      return (
        owner &&
        owner.getAttribute('zen-essential') === 'true' &&
        this._lazyPref.SHOULD_OPEN_EXTERNAL_TABS_IN_GLANCE &&
        owner.linkedBrowser?.docShellIsActive &&
        owner.linkedBrowser?.browsingContext?.isAppTab &&
        this.tabDomainsDiffer(owner, uri) &&
        Services.prefs.getBoolPref('zen.glance.enabled', true)
      );
    }

    onTabOpen(browser, uri) {
      let tab = gBrowser.getTabForBrowser(browser);
      if (!tab) {
        return;
      }
      try {
        if (this.shouldOpenTabInGlance(tab, uri)) {
          this.openGlance({ url: undefined, x: 0, y: 0, width: 0, height: 0 }, tab, tab.owner);
        }
      } catch (e) {
        console.error(e);
      }
    }

    fullyOpenGlance() {
      gBrowser._insertTabAtIndex(this.#currentTab, {
        index: this.getTabPosition(this.#currentTab),
      });

      this.animatingFullOpen = true;
      this.currentParentTab._visuallySelected = false;

      this.browserWrapper.removeAttribute('style');
      this.browserWrapper.removeAttribute('has-finished-animation');
      this.browserWrapper.setAttribute('animate-full', true);
      this.#currentTab.removeAttribute('zen-glance-tab');
      gBrowser.selectedTab = this.#currentTab;
      this.currentParentTab.linkedBrowser.closest('.browserSidebarContainer').classList.remove('zen-glance-background');
      setTimeout(() => {
        window.requestAnimationFrame(() => {
          this.browserWrapper.setAttribute('animate-full-end', true);
          this.overlay.classList.remove('zen-glance-overlay');
          setTimeout(() => {
            this.animatingFullOpen = false;
            this.closeGlance({ noAnimation: true });
          }, 600);
        });
      }, 300);
    }

    openGlanceForBookmark(event) {
      const activationMethod = Services.prefs.getStringPref('zen.glance.activation-method', 'ctrl');

      if (activationMethod === 'ctrl' && !event.ctrlKey) {
        return;
      } else if (activationMethod === 'alt' && !event.altKey) {
        return;
      } else if (activationMethod === 'shift' && !event.shiftKey) {
        return;
      } else if (activationMethod === 'meta' && !event.metaKey) {
        return;
      } else if (activationMethod === 'mantain' || typeof activationMethod === 'undefined') {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const rect = event.target.getBoundingClientRect();
      const data = {
        url: event.target._placesNode.uri,
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      };

      this.openGlance(data);

      return false;
    }
  }

  window.gZenGlanceManager = new ZenGlanceManager();

  function registerWindowActors() {
    if (Services.prefs.getBoolPref('zen.glance.enabled', true)) {
      gZenActorsManager.addJSWindowActor('ZenGlance', {
        parent: {
          esModuleURI: 'chrome://browser/content/zen-components/actors/ZenGlanceParent.sys.mjs',
        },
        child: {
          esModuleURI: 'chrome://browser/content/zen-components/actors/ZenGlanceChild.sys.mjs',
          events: {
            DOMContentLoaded: {},
          },
        },
      });
    }
  }

  registerWindowActors();
}
