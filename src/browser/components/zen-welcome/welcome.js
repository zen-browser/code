// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
const { XPCOMUtils } = ChromeUtils.import('resource://gre/modules/XPCOMUtils.jsm');

XPCOMUtils.defineLazyModuleGetters(this, {
  AddonManager: 'resource://gre/modules/AddonManager.jsm',
  MigrationUtils: 'resource:///modules/MigrationUtils.jsm',
});

ChromeUtils.defineModuleGetter(this, 'ExtensionSettingsStore', 'resource://gre/modules/ExtensionSettingsStore.jsm');

Services.scriptloader.loadSubScript('chrome://browser/content/ZenUIManager.mjs');

const kWelcomeSeenPref = 'zen.welcome-screen.seen';

// =============================================================================
// Util stuff copied from browser/components/preferences/search.js

class EngineStore {
  constructor() {
    this._engines = [];
  }

  async init() {
    const visibleEngines = await Services.search.getVisibleEngines();
    this.initSpecificEngine(visibleEngines);
  }

  getEngine() {
    return this._engines;
  }

  initSpecificEngine(engines) {
    for (const engine of engines) {
      try {
        this._engines.push(this._cloneEngine(engine));
      } catch (e) {
        // Ignore engines that throw an exception when cloning.
        console.error(e);
      }
    }
  }

  getEngineByName(name) {
    return this._engines.find((engine) => engine.name == name);
  }

  _cloneEngine(aEngine) {
    const clonedObj = {};

    for (const i of ['name', 'alias', '_iconURI', 'hidden']) {
      clonedObj[i] = aEngine[i];
    }

    clonedObj.originalEngine = aEngine;

    return clonedObj;
  }

  async getDefaultEngine() {
    let engineName = await Services.search.getDefault();
    return this.getEngineByName(engineName._name);
  }

  async setDefaultEngine(engine) {
    await Services.search.setDefault(engine.originalEngine, Ci.nsISearchService.CHANGE_REASON_USER);
  }
}

// =============================================================================

const sleep = (duration) => new Promise((resolve) => setTimeout(resolve, duration));

class Page {
  /**
   * A basic controller for individual pages
   * @param {string} id The id of the element that represents this page.
   */
  constructor(id) {
    this.element = document.getElementById(id);
  }

  /**
   *
   * @param {Pages} pages The pages wrapper
   */
  setPages(pages) {
    this.pages = pages;
  }

  hide() {
    this.element.setAttribute('hidden', 'true');
  }

  show() {
    this.element.removeAttribute('hidden');
  }
}

class Themes extends Page {
  constructor(id) {
    super(id);

    this.loadThemes();
  }

  async loadThemes() {
    window.addEventListener('DOMContentLoaded', this.setColorBar);
    await sleep(1000);

    const themes = (await AddonManager.getAddonsByTypes(['theme'])).filter((theme) => theme.id !== 'default-theme@mozilla.org');
    const themeList = document.getElementById('themeList');

    const themeElements = ['firefox-compact-light@mozilla.org', 'firefox-compact-dark@mozilla.org'];

    themeElements.forEach((theme, i) => {
      let container = themeList.children[i];
      container.addEventListener(
        'click',
        (() => {
          if (container.hasAttribute('disabled')) {
            return;
          }
          for (const el of themeList.children) {
            el.classList.remove('selected');
          }
          container.classList.add('selected');
          themes.find((t) => t.id === theme).enable();
        }).bind(this, i, container, theme)
      );
      if (themes.find((t) => t.id === theme).isActive) {
        container.classList.add('selected');
      }
    });
  }

  setColorBar() {
    const colorList = document.getElementById('colorListWrapper');
    const colors = ['#aac7ff', '#74d7cb', '#a0d490', '#dec663', '#ffb787', '#ffb1c0', '#ddbfc3', '#f6b0ea', '#d4bbff'];

    colors.forEach((color) => {
      const container = document.createElement('div');
      container.classList.add('color');
      container.style.backgroundColor = color;
      container.setAttribute('data-color', color);
      container.addEventListener(
        'click',
        (() => {
          Services.prefs.setStringPref('zen.theme.accent-color', color);
          colorList.querySelectorAll('.selected').forEach((el) => el.classList.remove('selected'));
          container.classList.add('selected');
        }).bind(this, color, container)
      );

      colorList.appendChild(container);
    });
  }
}

class Layout extends Page {
  constructor(id) {
    super(id);

    this.loadLayouts();
  }

  loadLayouts() {
    const kExtendedSidebar = 'zen.view.sidebar-expanded';
    const kSingleToolbar = 'zen.view.use-single-toolbar';

    for (const layout of document.getElementById('layoutList').children) {
      layout.addEventListener('click', () => {
        if (layout.hasAttribute('disabled')) {
          return;
        }

        for (const el of document.getElementById('layoutList').children) {
          el.classList.remove('selected');
        }

        layout.classList.add('selected');

        Services.prefs.setBoolPref(kExtendedSidebar, layout.getAttribute('layout') != 'collapsed');
        Services.prefs.setBoolPref(kSingleToolbar, layout.getAttribute('layout') == 'single');
      });
    }
  }
}

class Thanks extends Page {
  constructor(id) {
    super(id);

    // Thanks :)
  }
}

class Search extends Page {
  constructor(id) {
    super(id);

    this.store = new EngineStore();
    this.searchList = [];

    this.loadSearch();
  }

  async loadSearch() {
    await sleep(1100);
    await this.store.init();

    const defaultEngine = await Services.search.getDefault();

    const searchElements = document.getElementById('searchList');

    this.store.getEngine().forEach(async (search) => {
      const container = await this.loadSpecificSearch(search, defaultEngine);

      searchElements.appendChild(container);
      this.searchList.push(container);
    });
  }

  /**
   * @returns {HTMLDivElement}
   */
  async loadSpecificSearch(search, defaultSearch) {
    const container = document.createElement('div');
    container.classList.add('card');
    container.classList.add('card-no-hover');

    if (search.name == defaultSearch._name) {
      container.classList.add('selected');
    }

    container.addEventListener('click', () => {
      this.searchList.forEach((el) => el.classList.remove('selected'));
      container.classList.add('selected');
      this.store.setDefaultEngine(search);
    });

    const img = document.createElement('img');
    img.src = await search.originalEngine.getIconURL();

    const name = document.createElement('h3');
    name.textContent = search.name;

    container.appendChild(img);
    container.appendChild(name);

    return container;
  }
}

class Import extends Page {
  constructor(id) {
    super(id);

    const importButton = document.getElementById('importBrowser');
    importButton.addEventListener('click', async () => {
      MigrationUtils.showMigrationWizard(window, {
        zenBlocking: true,
      });
    });
  }
}

class Pages {
  /**
   * A wrapper around all pages
   * @param {Page[]} pages The pages
   */
  constructor(pages) {
    this.pages = pages;
    this.currentPage = 0;

    this.pages.forEach((page) => page.setPages(this));

    this._displayCurrentPage();

    this.nextEl = document.getElementById(`next`);
    this.prevEl = document.getElementById(`back`);

    this.nextEl.addEventListener('click', () => {
      this.next();
      this.prevEl.removeAttribute('disabled');
    });

    this.prevEl.addEventListener('click', () => {
      this.currentPage--;
      this._displayCurrentPage();
      if (this.pages.currentPage === 1) {
        this.prevEl.setAttribute('disabled', 'true');
      }

      for (const button of document.getElementById('buttons-footer').children) {
        button.style.display = 'none';
        // Re-animate the buttons
        setTimeout(() => {
          button.style.removeProperty('display');
        });
      }
    });
  }

  next() {
    this.currentPage++;
    document.getElementById('main-view').setAttribute('data-page', this.currentPage);

    if (this.currentPage >= this.pages.length) {
      // We can use internal js apis to close the window. We also want to set
      // the settings api for welcome seen to false to stop it showing again

      Services.prefs.setBoolPref(kWelcomeSeenPref, true);

      close();
      return;
    }

    for (const button of document.getElementById('buttons-footer').children) {
      button.style.display = 'none';
      // Re-animate the buttons
      setTimeout(() => {
        button.style.removeProperty('display');
      });
    }

    this._displayCurrentPage();
  }

  _displayCurrentPage() {
    let progress = document.getElementById('circular-progress');
    progress.style.setProperty('--progress', ((this.currentPage + 1) / this.pages.length) * 100);
    for (const page of this.pages) {
      page.hide();
    }
    if (this.currentPage >= 1) {
      document.body.classList.remove('gradient-background');
    } else {
      document.body.classList.add('gradient-background');
    }
    this.pages[this.currentPage].show();
  }
}

const pages = new Pages([
  new Page('welcome'),
  new Themes('theme'),
  new Layout('layout'),
  new Import('import'),
  new Search('search'),
  new Thanks('thanks'),
]);
