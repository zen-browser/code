// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const kZenColors = [
  '#aac7ff',
  '#74d7cb',
  '#a0d490',
  '#dec663',
  '#ffb787',
  '#dec1b1',
  '#ffb1c0',
  '#ddbfc3',
  '#f6b0ea',
  '#d4bbff',
];

const kZenOSToSmallName = {
  WINNT: 'windows',
  Darwin: 'macos',
  Linux: 'linux',
};

var gZenMarketplaceManager = {
  init() {
    const checkForUpdates = document.getElementById('zenThemeMarketplaceCheckForUpdates');
    if (!checkForUpdates) return; // We havent entered the settings page yet.
    if (this.__hasInitializedEvents) return;
    this._buildThemesList();
    this.__hasInitializedEvents = true;
    Services.prefs.addObserver(this.updatePref, this);
    checkForUpdates.addEventListener('click', (event) => {
      if (event.target === checkForUpdates) {
        event.preventDefault();
        this._checkForThemeUpdates(event);
      }
    });
    document.addEventListener('ZenThemeMarketplace:CheckForUpdatesFinished', (event) => {
      checkForUpdates.disabled = false;
      const updates = event.detail.updates;
      const success = document.getElementById('zenThemeMarketplaceUpdatesSuccess');
      const error = document.getElementById('zenThemeMarketplaceUpdatesFailure');
      if (updates) {
        success.hidden = false;
        error.hidden = true;
      } else {
        success.hidden = true;
        error.hidden = false;
      }
    });
    window.addEventListener('unload', this.uninit.bind(this));
  },

  uninit() {
    Services.prefs.removeObserver(this.updatePref, this);
  },

  async observe() {
    this._themes = null;
    await this._buildThemesList();
  },

  _checkForThemeUpdates(event) {
    // Send a message to the child to check for theme updates.
    event.target.disabled = true;
    // send an event that will be listened by the child process.
    document.dispatchEvent(new CustomEvent('ZenCheckForThemeUpdates'));
  },

  get updatePref() {
    return 'zen.themes.updated-value-observer';
  },

  triggerThemeUpdate() {
    Services.prefs.setBoolPref(this.updatePref, !Services.prefs.getBoolPref(this.updatePref));
  },

  get themesList() {
    return document.getElementById('zenThemeMarketplaceList');
  },

  get themesDataFile() {
    return PathUtils.join(PathUtils.profileDir, 'zen-themes.json');
  },

  get themesRootPath() {
    return PathUtils.join(PathUtils.profileDir, 'chrome', 'zen-themes');
  },

  async removeTheme(themeId) {
    const themePath = PathUtils.join(this.themesRootPath, themeId);
    console.info('ZenThemeMarketplaceParent(settings): Removing theme ', themePath);
    await IOUtils.remove(themePath, { recursive: true, ignoreAbsent: true });

    let themes = await this._getThemes();
    delete themes[themeId];
    await IOUtils.writeJSON(this.themesDataFile, themes);

    this.triggerThemeUpdate();
  },

  async _getThemes() {
    if (!this._themes) {
      if (!(await IOUtils.exists(this.themesDataFile))) {
        await IOUtils.writeJSON(this.themesDataFile, {});
      }
      this._themes = await IOUtils.readJSON(this.themesDataFile);
    }
    return this._themes;
  },

  get currentOperatingSystem() {
    let os = Services.appinfo.OS;
    return kZenOSToSmallName[os];
  },

  _getValidPreferences(preferences) {
    for (let key in preferences) {
      // [!][os:]key
      let restOfPreferences = key;
      let isNegation = false;
      if (key.startsWith('!')) {
        isNegation = true;
        restOfPreferences = key.slice(1);
      }
      let os = '';
      if (restOfPreferences.includes(':')) {
        [os, restOfPreferences] = restOfPreferences.split(':');
      }
      if (isNegation && os === this.currentOperatingSystem) {
        delete preferences[key];
      } else if (os && os !== this.currentOperatingSystem && !isNegation) {
        delete preferences[key];
      } else {
        // Change the key to contain only the rest of the preferences.
        preferences[restOfPreferences] = preferences[key];
        if (key !== restOfPreferences) {
          delete preferences[key];
        }
      }
    }
    return preferences;
  },

  async _getThemePreferences(theme) {
    const themePath = PathUtils.join(this.themesRootPath, theme.id, 'preferences.json');
    if (!(await IOUtils.exists(themePath)) || !theme.preferences) {
      return {};
    }
    return this._getValidPreferences(await IOUtils.readJSON(themePath));
  },

  async _buildThemesList() {
    if (!this.themesList) return;
    console.log('ZenThemeMarketplaceParent(settings): Building themes list');
    let themes = await this._getThemes();
    this.themesList.innerHTML = '';
    for (let theme of Object.values(themes)) {
      const fragment = window.MozXULElement.parseXULToFragment(`
        <vbox class="zenThemeMarketplaceItem" align="center">
          <vbox class="zenThemeMarketplaceItemContent" flex="1">
            <label><h3 class="zenThemeMarketplaceItemTitle"></h3></label>
            <description class="description-deemphasized zenThemeMarketplaceItemDescription"></description>
          </vbox>
          <hbox class="zenThemeMarketplaceItemActions">
            <button class="zenThemeMarketplaceItemConfigureButton" hidden="true"></button>
            <button class="zenThemeMarketplaceItemUninstallButton" data-l10n-id="zen-theme-marketplace-remove-button" zen-theme-id="${theme.id}"></button>
          </hbox>
        </vbox>
      `);
      fragment.querySelector('.zenThemeMarketplaceItemTitle').textContent = `${theme.name} (v${theme.version || '1.0.0'})`;
      fragment.querySelector('.zenThemeMarketplaceItemDescription').textContent = theme.description;
      fragment.querySelector('.zenThemeMarketplaceItemUninstallButton').addEventListener('click', async (event) => {
        if (!confirm('Are you sure you want to remove this theme?')) {
          return;
        }
        const target = event.target;
        const themeId = target.getAttribute('zen-theme-id');
        await this.removeTheme(themeId);
      });
      if (theme.preferences) {
        fragment.querySelector('.zenThemeMarketplaceItemConfigureButton').removeAttribute('hidden');
      }
      fragment.querySelector('.zenThemeMarketplaceItemConfigureButton').addEventListener('click', async (event) => {
        const target = event.target;
        // Unhide the preferences for this theme.
        const preferencesWrapper = target.closest('.zenThemeMarketplaceItem').querySelector('.zenThemeMarketplaceItemPreferences');
        if (preferencesWrapper.hasAttribute('hidden')) {
          preferencesWrapper.removeAttribute('hidden');
        } else {
          preferencesWrapper.setAttribute('hidden', 'true');
        }
      });

      const preferences = await this._getThemePreferences(theme);
      if (Object.keys(preferences).length > 0) {
        let preferencesWrapper = document.createXULElement('vbox');
        preferencesWrapper.classList.add('indent');
        preferencesWrapper.classList.add('zenThemeMarketplaceItemPreferences');
        preferencesWrapper.setAttribute('hidden', 'true');
        for (let [key, value] of Object.entries(preferences)) {
          const fragment = window.MozXULElement.parseXULToFragment(`
            <hbox class="zenThemeMarketplaceItemPreference">
              <checkbox class="zenThemeMarketplaceItemPreferenceCheckbox" zen-pref="${key}"></checkbox>
              <vbox class="zenThemeMarketplaceItemPreferenceData">
                <label class="zenThemeMarketplaceItemPreferenceLabel">${key}</label>
                <description class="description-deemphasized zenThemeMarketplaceItemPreferenceValue">${value}</description>
              </vbox>
            </hbox>
          `);
          // Checkbox only works with "true" and "false" values, it's not like HTML checkboxes.
          if (Services.prefs.getBoolPref(key, false)) {
            fragment.querySelector('.zenThemeMarketplaceItemPreferenceCheckbox').setAttribute('checked', 'true');
          }
          fragment.querySelector('.zenThemeMarketplaceItemPreferenceCheckbox').addEventListener('click', (event) => {
            let target = event.target.closest('.zenThemeMarketplaceItemPreferenceCheckbox');
            let key = target.getAttribute('zen-pref');
            let checked = target.hasAttribute('checked');
            if (!checked) {
              target.removeAttribute('checked');
            } else {
              target.setAttribute('checked', 'true');
            }
            Services.prefs.setBoolPref(key, !checked);
          });
          preferencesWrapper.appendChild(fragment);
        }
        fragment.querySelector('.zenThemeMarketplaceItemContent').appendChild(preferencesWrapper);
      }
      this.themesList.appendChild(fragment);
    }
  },
};

var gZenLooksAndFeel = {
  init() {
    if (this.__hasInitialized) return;
    this.__hasInitialized = true;
    this._initializeColorPicker(this._getInitialAccentColor());
    window.zenPageAccentColorChanged = this._handleAccentColorChange.bind(this);
    this._initializeTabbarExpandForm();
    gZenThemeBuilder.init();
    gZenMarketplaceManager.init();
    var onLegacyToolbarChange = this.onLegacyToolbarChange.bind(this);
    Services.prefs.addObserver('zen.themes.tabs.legacy-location', onLegacyToolbarChange);
    var onPreferColorSchemeChange = this.onPreferColorSchemeChange.bind(this);
    window.matchMedia('(prefers-color-scheme: dark)').addListener(onPreferColorSchemeChange);
    this.onPreferColorSchemeChange();
    window.addEventListener('unload', () => {
      Services.prefs.removeObserver('zen.themes.tabs.legacy-location', onLegacyToolbarChange);
      window.matchMedia('(prefers-color-scheme: dark)').removeListener(onPreferColorSchemeChange);
    });
    setTimeout(() => {
      const group = document.getElementById('zenLooksAndFeelGroup');
      const webGroup = document.getElementById('webAppearanceGroup');
      webGroup.style.display = 'none';
      // Iterate reverse to prepend the elements in the correct order.
      for (let child of [...webGroup.children].reverse()) {
        group.prepend(child);
      }
    }, 500);
    this.setDarkThemeListener();
  },

  onPreferColorSchemeChange(event) {
    const darkTheme = window.matchMedia('(prefers-color-scheme: dark)').matches;
    let elem = document.getElementById("ZenDarkThemeStyles");
    if (darkTheme) {
      elem.removeAttribute('hidden');
    } else {
      elem.setAttribute('hidden', 'true');
    }
  },

  setDarkThemeListener() {
    this.chooser = document.getElementById("zen-dark-theme-styles-form");
    this.radios = [...this.chooser.querySelectorAll("input")];
    for (let radio of this.radios) {
      if (radio.value === "amoled" && Services.prefs.getBoolPref("zen.theme.color-prefs.amoled")) {
        radio.checked = true;
      } else if (radio.value === "colorful" && Services.prefs.getBoolPref("zen.theme.color-prefs.colorful")) {
        radio.checked = true;
      } else if (radio.value === "default" && !Services.prefs.getBoolPref("zen.theme.color-prefs.amoled") && !Services.prefs.getBoolPref("zen.theme.color-prefs.colorful")) {
        radio.checked = true;
      }
      radio.addEventListener("change", e => {
        let value = e.target.value;
        switch (value) {
          case "amoled":
            Services.prefs.setBoolPref("zen.theme.color-prefs.amoled", true);
            Services.prefs.setBoolPref("zen.theme.color-prefs.colorful", false);
            break;
          case "colorful":
            Services.prefs.setBoolPref("zen.theme.color-prefs.amoled", false);
            Services.prefs.setBoolPref("zen.theme.color-prefs.colorful", true);
            break;
          default:
            Services.prefs.setBoolPref("zen.theme.color-prefs.amoled", false);
            Services.prefs.setBoolPref("zen.theme.color-prefs.colorful", false);
            break;
        }
      });
    }
  },

  async onLegacyToolbarChange(event) {
    let buttonIndex = await confirmRestartPrompt(true, 1, true, false);
    if (buttonIndex == CONFIRM_RESTART_PROMPT_RESTART_NOW) {
      Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit | Ci.nsIAppStartup.eRestart);
      return;
    }
  },

  _initializeTabbarExpandForm() {
    const form = document.getElementById('zen-expand-tabbar-strat');
    const radios = form.querySelectorAll('input[type=radio]');
    const onHoverPref = 'zen.view.sidebar-expanded.on-hover';
    const defaultExpandPref = 'zen.view.sidebar-expanded';
    if (Services.prefs.getBoolPref(onHoverPref)) {
      form.querySelector('input[value="hover"]').checked = true;
    } else if (Services.prefs.getBoolPref(defaultExpandPref)) {
      form.querySelector('input[value="expand"]').checked = true;
    } else {
      form.querySelector('input[value="none"]').checked = true;
    }
    for (let radio of radios) {
      radio.addEventListener('change', (e) => {
        switch (e.target.value) {
          case 'expand':
            Services.prefs.setBoolPref(onHoverPref, false);
            Services.prefs.setBoolPref(defaultExpandPref, true);
            break;
          case 'none':
            Services.prefs.setBoolPref(onHoverPref, false);
            Services.prefs.setBoolPref(defaultExpandPref, false);
            break;
          case 'hover':
            Services.prefs.setBoolPref(onHoverPref, true);
            Services.prefs.setBoolPref(defaultExpandPref, true);
            break;
        }
      });
    }
  },

  _initializeColorPicker(accentColor) {
    let elem = document.getElementById('zenLooksAndFeelColorOptions');
    elem.innerHTML = '';
    for (let color of kZenColors) {
      let colorElemParen = document.createElement('div');
      let colorElem = document.createElement('div');
      colorElemParen.classList.add('zenLooksAndFeelColorOptionParen');
      colorElem.classList.add('zenLooksAndFeelColorOption');
      colorElem.style.setProperty('--zen-primary-color', color, 'important');
      if (accentColor === color) {
        colorElemParen.setAttribute('selected', 'true');
      }
      colorElemParen.addEventListener('click', () => {
        Services.prefs.setStringPref('zen.theme.accent-color', color);
      });
      colorElemParen.appendChild(colorElem);
      elem.appendChild(colorElemParen);
    }
    // TODO: add custom color selection!
  },

  _handleAccentColorChange(accentColor) {
    this._initializeColorPicker(accentColor);
  },

  _getInitialAccentColor() {
    return Services.prefs.getStringPref('zen.theme.accent-color', kZenColors[0]);
  },
};

var gZenWorkspacesSettings = {
  init() {
    Services.prefs.addObserver('zen.workspaces.enabled', this);
    window.addEventListener('unload', () => {
      Services.prefs.removeObserver('zen.workspaces.enabled', this);
    });
  },

  async observe(subject, topic, data) {
    await this.onWorkspaceChange(Services.prefs.getBoolPref('zen.workspaces.enabled'));
  },

  async onWorkspaceChange(checked) {
    if (checked) {
      let buttonIndex = await confirmRestartPrompt(true, 1, true, false);
      if (buttonIndex == CONFIRM_RESTART_PROMPT_RESTART_NOW) {
        Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit | Ci.nsIAppStartup.eRestart);
        return;
      }
    }
  },
};

var gZenCKSSettings = {
  init() {
    this._currentAction = null;
    this._initializeEvents();
    this._initializeCKS();
    this._addPrefObservers();
    window.addEventListener('unload', () => {
      Services.prefs.removeObserver('zen.keyboard.shortcuts.disable-firefox', this);
    });
  },

  _addPrefObservers() {
    Services.prefs.addObserver('zen.keyboard.shortcuts.disable-firefox', this);
  },

  observe(subject, topic, data) {
    this.onDisableFirefoxShortcutsChange();
  },

  async onDisableFirefoxShortcutsChange(event) {
    let checked = Services.prefs.getBoolPref('zen.keyboard.shortcuts.disable-firefox');
    if (checked) return;
    let buttonIndex = await confirmRestartPrompt(true, 1, true, false);
    if (buttonIndex == CONFIRM_RESTART_PROMPT_RESTART_NOW) {
      Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit | Ci.nsIAppStartup.eRestart);
      return;
    }
  },

  _initializeCKS() {
    let wrapepr = document.getElementById('zenCKSOptions-wrapper');

    // Create the groups first.
    for (let key in kZKSActions) {
      const data = kZKSActions[key];
      const group = data[2];
      if (!wrapepr.querySelector(`[data-group="${group}"]`)) {
        let groupElem = document.createElement('h2');
        groupElem.setAttribute('data-group', group);
        document.l10n.setAttributes(groupElem, `zen-cks-group-${group}`);
        wrapepr.appendChild(groupElem);
      }
    }

    const keys = Object.keys(kZKSActions);
    for (let i = keys.length - 1; i >= 0; i--) {
      const key = keys[i];
      const data = kZKSActions[key];
      const l10nId = data[1];
      const group = data[2];
      let fragment = window.MozXULElement.parseXULToFragment(`
        <hbox class="zenCKSOption">
          <label class="zenCKSOption-label" for="zenCKSOption-${key}"></label>
          <html:input readonly="1" class="zenCKSOption-input" id="zenCKSOption-${key}" />
        </hbox>
      `);
      document.l10n.setAttributes(fragment.querySelector('.zenCKSOption-label'), l10nId);

      let input = fragment.querySelector('.zenCKSOption-input');
      let shortcut = gZenKeyboardShortcuts.getShortcut(key);
      if (shortcut) {
        input.value = gZenKeyboardShortcuts.shortCutToString(shortcut);
      } else {
        this._resetCKS(input, key);
      }

      input.setAttribute('data-key', key);
      input.addEventListener('focus', (event) => {
        const key = event.target.getAttribute('data-key');
        this._currentAction = key;
        event.target.classList.add('zenCKSOption-input-editing');
      });

      input.addEventListener('blur', (event) => {
        this._currentAction = null;
        event.target.classList.remove('zenCKSOption-input-editing');
      });

      const groupElem = wrapepr.querySelector(`[data-group="${group}"]`);
      groupElem.after(fragment);
    }
  },

  _resetCKS(input, key) {
    input.value = 'Not set';
    input.classList.add('zenCKSOption-input-not-set');
    input.classList.remove('zenCKSOption-input-invalid');
    gZenKeyboardShortcuts.setShortcut(key, null);
  },

  _initializeEvents() {
    window.addEventListener('keydown', this._handleKeyDown.bind(this));
  },

  _handleKeyDown(event) {
    if (!this._currentAction) {
      return;
    }

    let input = document.querySelector(`.zenCKSOption-input[data-key="${this._currentAction}"]`);
    let shortcut = {
      ctrl: event.ctrlKey,
      alt: event.altKey,
      shift: event.shiftKey,
      meta: event.metaKey,
    };

    const shortcutWithoutModifiers = !shortcut.ctrl && !shortcut.alt && !shortcut.shift && !shortcut.meta;

    if (event.key === 'Tab' && shortcutWithoutModifiers) {
      return;
    } else if (event.key === 'Escape' && shortcutWithoutModifiers) {
      this._currentAction = null;
      input.blur();
      return;
    } else if (event.key === 'Backspace' && shortcutWithoutModifiers) {
      this._resetCKS(input, this._currentAction);
      return;
    }

    if (!shortcut.ctrl && !shortcut.alt && !shortcut.shift && !shortcut.meta) {
      this._resetCKS(input, this._currentAction);
      return; // No modifiers, ignore.
    }

    if (!['Control', 'Alt', 'Meta', 'Shift'].includes(event.key)) {
      if (event.keycode) {
        shortcut.keycode = event.keycode;
      } else {
        shortcut.key = event.key;
      }
    }

    event.preventDefault();
    gZenKeyboardShortcuts.setShortcut(this._currentAction, shortcut);

    input.value = gZenKeyboardShortcuts.shortCutToString(shortcut);
    input.classList.remove('zenCKSOption-input-not-set');

    if (gZenKeyboardShortcuts.isValidShortcut(shortcut)) {
      input.classList.remove('zenCKSOption-input-invalid');
    } else {
      input.classList.add('zenCKSOption-input-invalid');
    }
  },
};

Preferences.addAll([
  {
    id: 'zen.theme.toolbar-themed',
    type: 'bool',
    default: true,
  },
  {
    id: 'zen.sidebar.enabled',
    type: 'bool',
    default: true,
  },
  {
    id: 'zen.sidebar.close-on-blur',
    type: 'bool',
    default: true,
  },
  {
    id: 'zen.view.compact',
    type: 'bool',
    default: false,
  },
  {
    id: 'zen.view.compact.hide-toolbar',
    type: 'bool',
    default: false,
  },
  {
    id: 'zen.view.compact.toolbar-flash-popup',
    type: 'bool',
    default: true,
  },
  {
    id: 'zen.workspaces.enabled',
    type: 'bool',
    default: true,
  },
  {
    id: 'zen.view.sidebar-expanded.show-button',
    type: 'bool',
    default: true,
  },
  {
    id: 'zen.view.sidebar-expanded',
    type: 'bool',
    default: true,
  },
  {
    id: 'zen.theme.pill-button',
    type: 'bool',
    default: true,
  },
  {
    id: 'zen.keyboard.shortcuts.disable-firefox',
    type: 'bool',
    default: false,
  },
  {
    id: 'zen.themes.tabs.legacy-location',
    type: 'bool',
    default: false,
  },
  {
    id: 'zen.workspaces.hide-default-container-indicator',
    type: 'bool',
    default: true,
  },
]);
