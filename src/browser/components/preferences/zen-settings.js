// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
var gZenMarketplaceManager = {
  async init() {
    const checkForUpdates = document.getElementById('zenThemeMarketplaceCheckForUpdates');
    const header = document.getElementById('zenMarketplaceHeader');

    if (!checkForUpdates || !header) {
      return; // We haven't entered the settings page yet.
    }

    if (this.__hasInitializedEvents) {
      return;
    }

    header.appendChild(this._initDisableAll());

    this.__hasInitializedEvents = true;

    await this._buildThemesList();

    Services.prefs.addObserver(this.updatePref, this);

    const checkForUpdateClick = (event) => {
      if (event.target === checkForUpdates) {
        event.preventDefault();
        this._checkForThemeUpdates(event);
      }
    };

    checkForUpdates.addEventListener('click', checkForUpdateClick);

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

    window.addEventListener('unload', () => {
      Services.prefs.removeObserver(this.updatePref, this);
      this.__hasInitializedEvents = false;
      document.removeEventListener('ZenThemeMarketplace:CheckForUpdatesFinished', this);
      document.removeEventListener('ZenCheckForThemeUpdates', this);
      checkForUpdates.removeEventListener('click', checkForUpdateClick);
      this.themesList.innerHTML = '';
      this._doNotRebuildThemesList = false;
    });
  },

  _initDisableAll() {
    const areThemesDisabled = Services.prefs.getBoolPref('zen.themes.disable-all', false);
    const browser = ZenThemesCommon.currentBrowser;
    const mozToggle = document.createElement('moz-toggle');

    mozToggle.className = 'zenThemeMarketplaceItemPreferenceToggle zenThemeMarketplaceDisableAllToggle';
    mozToggle.pressed = !areThemesDisabled;

    browser.document.l10n.setAttributes(mozToggle, `zen-theme-disable-all-${!areThemesDisabled ? 'enabled' : 'disabled'}`);

    mozToggle.addEventListener('toggle', async (event) => {
      const { pressed = false } = event.target || {};

      this.themesList.style.display = pressed ? '' : 'none';
      Services.prefs.setBoolPref('zen.themes.disable-all', !pressed);
      browser.document.l10n.setAttributes(mozToggle, `zen-theme-disable-all-${pressed ? 'enabled' : 'disabled'}`);
    });

    if (areThemesDisabled) {
      this.themesList.style.display = 'none';
    }

    return mozToggle;
  },

  async observe() {
    ZenThemesCommon.resetThemesCache();
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
    if (!this._themesList) {
      this._themesList = document.getElementById('zenThemeMarketplaceList');
    }
    return this._themesList;
  },

  async removeTheme(themeId) {
    const themePath = ZenThemesCommon.getThemeFolder(themeId);

    console.info(`[ZenThemeMarketplaceParent:settings]: Removing theme ${themePath}`);

    await IOUtils.remove(themePath, { recursive: true, ignoreAbsent: true });

    const themes = await ZenThemesCommon.getThemes();
    delete themes[themeId];
    await IOUtils.writeJSON(ZenThemesCommon.themesDataFile, themes);

    this.triggerThemeUpdate();
  },

  async disableTheme(themeId) {
    const themes = await ZenThemesCommon.getThemes();
    const theme = themes[themeId];

    console.log(`[ZenThemeMarketplaceParent:settings]: Disabling theme ${theme.name}`);

    theme.enabled = false;

    await IOUtils.writeJSON(ZenThemesCommon.themesDataFile, themes);
    this._doNotRebuildThemesList = true;
    this.triggerThemeUpdate();
  },

  async enableTheme(themeId) {
    const themes = await ZenThemesCommon.getThemes();
    const theme = themes[themeId];

    console.log(`[ZenThemeMarketplaceParent:settings]: Enabling theme ${theme.name}`);

    theme.enabled = true;

    await IOUtils.writeJSON(ZenThemesCommon.themesDataFile, themes);
    this._doNotRebuildThemesList = true;
    this.triggerThemeUpdate();
  },

  _triggerBuildUpdateWithoutRebuild() {
    this._doNotRebuildThemesList = true;
    this.triggerThemeUpdate();
  },

  async _buildThemesList() {
    if (!this.themesList) {
      return;
    }

    if (this._doNotRebuildThemesList) {
      this._doNotRebuildThemesList = false;
      return;
    }

    const themes = await ZenThemesCommon.getThemes();
    const browser = ZenMultiWindowFeature.currentBrowser;
    const themeList = document.createElement('div');

    for (const theme of Object.values(themes)) {
      const sanitizedName = `theme-${theme.name?.replaceAll(/\s/g, '-')?.replaceAll(/[^A-z_-]+/g, '')}`;
      const isThemeEnabled = theme.enabled === undefined || theme.enabled;

      const fragment = window.MozXULElement.parseXULToFragment(`
        <vbox class="zenThemeMarketplaceItem">
          <vbox class="zenThemeMarketplaceItemContent">
            <hbox flex="1" id="zenThemeMarketplaceItemContentHeader">
              <label><h3 class="zenThemeMarketplaceItemTitle"></h3></label>
            </hbox>
            <description class="description-deemphasized zenThemeMarketplaceItemDescription"></description>
          </vbox>
          <hbox class="zenThemeMarketplaceItemActions">
            ${theme.preferences ? `<button id="zenThemeMarketplaceItemConfigureButton-${sanitizedName}" class="zenThemeMarketplaceItemConfigureButton" hidden="true"></button>` : ''}
            <button class="zenThemeMarketplaceItemUninstallButton" data-l10n-id="zen-theme-marketplace-remove-button" zen-theme-id="${theme.id}"></button>
          </hbox>
        </vbox>
      `);

      const themeName = `${theme.name} (v${theme.version || '1.0.0'})`;

      const base = fragment.querySelector('.zenThemeMarketplaceItem');
      const baseHeader = fragment.querySelector('#zenThemeMarketplaceItemContentHeader');

      const dialog = document.createElement('dialog');
      const mainDialogDiv = document.createElement('div');
      const headerDiv = document.createElement('div');
      const headerTitle = document.createElement('h3');
      const closeButton = document.createElement('button');
      const contentDiv = document.createElement('div');
      const mozToggle = document.createElement('moz-toggle');

      mainDialogDiv.className = 'zenThemeMarketplaceItemPreferenceDialog';
      headerDiv.className = 'zenThemeMarketplaceItemPreferenceDialogTopBar';
      headerTitle.textContent = themeName;
      browser.document.l10n.setAttributes(headerTitle, 'zen-theme-marketplace-theme-header-title', {
        name: sanitizedName,
      });
      headerTitle.className = 'zenThemeMarketplaceItemTitle';
      closeButton.id = `${sanitizedName}-modal-close`;
      browser.document.l10n.setAttributes(closeButton, 'zen-theme-marketplace-close-modal');
      contentDiv.id = `${sanitizedName}-preferences-content`;
      contentDiv.className = 'zenThemeMarketplaceItemPreferenceDialogContent';
      mozToggle.className = 'zenThemeMarketplaceItemPreferenceToggle';

      mozToggle.pressed = isThemeEnabled;
      browser.document.l10n.setAttributes(
        mozToggle,
        `zen-theme-marketplace-toggle-${isThemeEnabled ? 'enabled' : 'disabled'}-button`
      );

      baseHeader.appendChild(mozToggle);

      headerDiv.appendChild(headerTitle);
      headerDiv.appendChild(closeButton);

      mainDialogDiv.appendChild(headerDiv);
      mainDialogDiv.appendChild(contentDiv);
      dialog.appendChild(mainDialogDiv);
      base.appendChild(dialog);

      closeButton.addEventListener('click', () => {
        dialog.close();
      });

      mozToggle.addEventListener('toggle', async (event) => {
        const themeId = event.target
          .closest('.zenThemeMarketplaceItem')
          .querySelector('.zenThemeMarketplaceItemUninstallButton')
          .getAttribute('zen-theme-id');
        event.target.setAttribute('disabled', true);

        if (!event.target.hasAttribute('pressed')) {
          await this.disableTheme(themeId);

          browser.document.l10n.setAttributes(mozToggle, 'zen-theme-marketplace-toggle-disabled-button');

          if (theme.preferences) {
            document.getElementById(`zenThemeMarketplaceItemConfigureButton-${sanitizedName}`).setAttribute('hidden', true);
          }
        } else {
          await this.enableTheme(themeId);

          browser.document.l10n.setAttributes(mozToggle, 'zen-theme-marketplace-toggle-enabled-button');

          if (theme.preferences) {
            document.getElementById(`zenThemeMarketplaceItemConfigureButton-${sanitizedName}`).removeAttribute('hidden');
          }
        }
        setTimeout(() => {
          // We use a timeout to make sure the theme list has been updated before re-enabling the button.
          event.target.removeAttribute('disabled');
        }, 400);
      });

      fragment.querySelector('.zenThemeMarketplaceItemTitle').textContent = themeName;
      fragment.querySelector('.zenThemeMarketplaceItemDescription').textContent = theme.description;
      fragment.querySelector('.zenThemeMarketplaceItemUninstallButton').addEventListener('click', async (event) => {
        const [msg] = await document.l10n.formatValues([{ id: 'zen-theme-marketplace-remove-confirmation' }]);

        if (!confirm(msg)) {
          return;
        }

        await this.removeTheme(event.target.getAttribute('zen-theme-id'));
      });

      if (theme.preferences) {
        fragment.querySelector('.zenThemeMarketplaceItemConfigureButton').addEventListener('click', () => {
          dialog.showModal();
        });

        if (isThemeEnabled) {
          fragment.querySelector('.zenThemeMarketplaceItemConfigureButton').removeAttribute('hidden');
        }
      }

      const preferences = await ZenThemesCommon.getThemePreferences(theme);

      if (preferences.length > 0) {
        const preferencesWrapper = document.createXULElement('vbox');

        preferencesWrapper.setAttribute('flex', '1');

        for (const entry of preferences) {
          const { property, label, type, placeholder } = entry;

          switch (type) {
            case 'dropdown': {
              const { options } = entry;

              const container = document.createXULElement('hbox');
              container.classList.add('zenThemeMarketplaceItemPreference');
              container.setAttribute('align', 'center');
              container.setAttribute('role', 'group');

              const menulist = document.createXULElement('menulist');
              const menupopup = document.createXULElement('menupopup');

              menulist.setAttribute('sizetopopup', 'none');
              menulist.setAttribute('id', property + '-popup-menulist');

              const savedValue = Services.prefs.getStringPref(property, 'none');

              menulist.setAttribute('value', savedValue);
              menulist.setAttribute('tooltiptext', property);

              const defaultItem = document.createXULElement('menuitem');

              defaultItem.setAttribute('value', 'none');

              if (placeholder) {
                defaultItem.setAttribute('label', placeholder || '-');
              } else {
                browser.document.l10n.setAttributes(defaultItem, 'zen-theme-marketplace-dropdown-default-label');
              }

              menupopup.appendChild(defaultItem);

              for (const option of options) {
                const { label, value } = option;

                const valueType = typeof value;

                if (!['string', 'number'].includes(valueType)) {
                  console.log(
                    `[ZenThemeMarketplaceParent:settings]: Warning, invalid data type received (${valueType}), skipping.`
                  );
                  continue;
                }

                const menuitem = document.createXULElement('menuitem');

                menuitem.setAttribute('value', value.toString());
                menuitem.setAttribute('label', label);

                menupopup.appendChild(menuitem);
              }

              menulist.appendChild(menupopup);

              menulist.addEventListener('command', () => {
                const value = menulist.selectedItem.value;

                let element = browser.document.getElementById(sanitizedName);

                if (!element) {
                  element = browser.document.createElement('div');

                  element.style.display = 'none';
                  element.setAttribute('id', sanitizedName);

                  browser.document.body.appendChild(element);
                }

                element.setAttribute(property?.replaceAll(/\./g, '-'), value);

                Services.prefs.setStringPref(property, value === 'none' ? '' : value);
                this._triggerBuildUpdateWithoutRebuild();
              });

              const nameLabel = document.createXULElement('label');
              nameLabel.setAttribute('flex', '1');
              nameLabel.setAttribute('class', 'zenThemeMarketplaceItemPreferenceLabel');
              nameLabel.setAttribute('value', label);
              nameLabel.setAttribute('tooltiptext', property);

              container.appendChild(nameLabel);
              container.appendChild(menulist);
              container.setAttribute('aria-labelledby', label);

              preferencesWrapper.appendChild(container);
              break;
            }

            case 'checkbox': {
              const checkbox = window.MozXULElement.parseXULToFragment(`
                <hbox class="zenThemeMarketplaceItemPreference">
                  <checkbox class="zenThemeMarketplaceItemPreferenceCheckbox"></checkbox>
                </hbox>
              `);

              const checkboxElement = checkbox.querySelector('.zenThemeMarketplaceItemPreferenceCheckbox');
              checkboxElement.setAttribute('label', label);
              checkboxElement.setAttribute('tooltiptext', property);
              checkboxElement.setAttribute('zen-pref', property);

              // Checkbox only works with "true" and "false" values, it's not like HTML checkboxes.
              if (Services.prefs.getBoolPref(property, false)) {
                checkboxElement.setAttribute('checked', 'true');
              }

              checkboxElement.addEventListener('click', (event) => {
                const target = event.target.closest('.zenThemeMarketplaceItemPreferenceCheckbox');
                const key = target.getAttribute('zen-pref');
                const checked = target.hasAttribute('checked');

                if (!checked) {
                  target.removeAttribute('checked');
                } else {
                  target.setAttribute('checked', 'true');
                }

                Services.prefs.setBoolPref(key, !checked);
              });

              preferencesWrapper.appendChild(checkbox);
              break;
            }

            case 'string': {
              const container = document.createXULElement('hbox');
              container.classList.add('zenThemeMarketplaceItemPreference');
              container.setAttribute('align', 'center');
              container.setAttribute('role', 'group');

              const savedValue = Services.prefs.getStringPref(property, '');
              const sanitizedProperty = property?.replaceAll(/\./g, '-');

              const input = document.createElement('input');
              input.setAttribute('flex', '1');
              input.setAttribute('type', 'text');
              input.id = `${sanitizedProperty}-input`;
              input.value = savedValue;

              if (placeholder) {
                input.setAttribute('placeholder', placeholder || '-');
              } else {
                browser.document.l10n.setAttributes(input, 'zen-theme-marketplace-input-default-placeholder');
              }

              input.addEventListener(
                'input',
                ZenThemesCommon.throttle((event) => {
                  const value = event.target.value;

                  Services.prefs.setStringPref(property, value);
                  this._triggerBuildUpdateWithoutRebuild();

                  if (value === '') {
                    browser.document.querySelector(':root').style.removeProperty(`--${sanitizedProperty}`);
                  } else {
                    browser.document.querySelector(':root').style.setProperty(`--${sanitizedProperty}`, value);
                  }
                }, 500)
              );

              const nameLabel = document.createXULElement('label');
              nameLabel.setAttribute('flex', '1');
              nameLabel.setAttribute('class', 'zenThemeMarketplaceItemPreferenceLabel');
              nameLabel.setAttribute('value', label);
              nameLabel.setAttribute('tooltiptext', property);

              container.appendChild(nameLabel);
              container.appendChild(input);
              container.setAttribute('aria-labelledby', label);

              preferencesWrapper.appendChild(container);
              break;
            }

            default:
              console.log(
                `[ZenThemeMarketplaceParent:settings]: Warning, unknown preference type received (${type}), skipping.`
              );
              continue;
          }
        }
        contentDiv.appendChild(preferencesWrapper);
      }
      themeList.appendChild(fragment);
    }

    this.themesList.replaceChildren(...themeList.children);
    themeList.remove();
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
    var onPreferColorSchemeChange = this.onPreferColorSchemeChange.bind(this);
    window.matchMedia('(prefers-color-scheme: dark)').addListener(onPreferColorSchemeChange);
    this.onPreferColorSchemeChange();
    window.addEventListener('unload', () => {
      window.matchMedia('(prefers-color-scheme: dark)').removeListener(onPreferColorSchemeChange);
    });
    this.setDarkThemeListener();
    this.setCompactModeStyle();
  },

  onPreferColorSchemeChange(event) {
    const darkTheme = window.matchMedia('(prefers-color-scheme: dark)').matches;
    let elem = document.getElementById('ZenDarkThemeStyles');
    if (darkTheme) {
      elem.removeAttribute('hidden');
    } else {
      elem.setAttribute('hidden', 'true');
    }
  },

  setDarkThemeListener() {
    const chooser = document.getElementById('zen-dark-theme-styles-form');
    const radios = [...chooser.querySelectorAll('input')];
    for (let radio of radios) {
      if (radio.value === 'amoled' && Services.prefs.getBoolPref('zen.theme.color-prefs.amoled')) {
        radio.checked = true;
      } else if (radio.value === 'colorful' && Services.prefs.getBoolPref('zen.theme.color-prefs.colorful')) {
        radio.checked = true;
      } else if (
        radio.value === 'default' &&
        !Services.prefs.getBoolPref('zen.theme.color-prefs.amoled') &&
        !Services.prefs.getBoolPref('zen.theme.color-prefs.colorful')
      ) {
        radio.checked = true;
      }
      radio.addEventListener('change', (e) => {
        let value = e.target.value;
        switch (value) {
          case 'amoled':
            Services.prefs.setBoolPref('zen.theme.color-prefs.amoled', true);
            Services.prefs.setBoolPref('zen.theme.color-prefs.colorful', false);
            break;
          case 'colorful':
            Services.prefs.setBoolPref('zen.theme.color-prefs.amoled', false);
            Services.prefs.setBoolPref('zen.theme.color-prefs.colorful', true);
            break;
          default:
            Services.prefs.setBoolPref('zen.theme.color-prefs.amoled', false);
            Services.prefs.setBoolPref('zen.theme.color-prefs.colorful', false);
            break;
        }
      });
    }
  },

  setCompactModeStyle() {
    const chooser = document.getElementById('zen-compact-mode-styles-form');
    const radios = [...chooser.querySelectorAll('input')];

    let value = '';
    if (
      Services.prefs.getBoolPref('zen.view.compact.hide-tabbar') &&
      Services.prefs.getBoolPref('zen.view.compact.hide-toolbar')
    ) {
      value = 'both';
    } else {
      value = Services.prefs.getBoolPref('zen.view.compact.hide-tabbar') ? 'left' : 'top';
    }
    chooser.querySelector(`[value='${value}']`).checked = true;
    const disableExpandTabsOnHover = () => {
      if (Services.prefs.getBoolPref('zen.view.sidebar-expanded.on-hover')) {
        document.querySelector(`#zen-expand-tabbar-strat input[value='expand']`).click();
      }
    };
    for (let radio of radios) {
      radio.addEventListener('change', (e) => {
        let value = e.target.value;
        switch (value) {
          case 'left':
            disableExpandTabsOnHover();
            Services.prefs.setBoolPref('zen.view.compact.hide-tabbar', true);
            Services.prefs.setBoolPref('zen.view.compact.hide-toolbar', false);
            break;
          case 'top':
            Services.prefs.setBoolPref('zen.view.compact.hide-tabbar', false);
            Services.prefs.setBoolPref('zen.view.compact.hide-toolbar', true);
            break;
          default:
            disableExpandTabsOnHover();
            Services.prefs.setBoolPref('zen.view.compact.hide-tabbar', true);
            Services.prefs.setBoolPref('zen.view.compact.hide-toolbar', true);
            break;
        }
      });
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
    const disableCompactTabbar = () => {
      const toolbarEnable = Services.prefs.getBoolPref('zen.view.compact.hide-toolbar');
      if (toolbarEnable) {
        document.querySelector(`#ZenCompactModeStyle input[value='top']`).click();
      } else if (Services.prefs.getBoolPref('zen.view.compact')) {
        document.getElementById('zenLooksAndFeelShowCompactView').click();
      }
    };
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
            disableCompactTabbar();
            Services.prefs.setBoolPref(onHoverPref, true);
            Services.prefs.setBoolPref(defaultExpandPref, false);
            break;
        }
      });
    }
  },

  _initializeColorPicker(accentColor) {
    let elem = document.getElementById('zenLooksAndFeelColorOptions');
    elem.innerHTML = '';
    for (let color of ZenThemesCommon.kZenColors) {
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
    return Services.prefs.getStringPref('zen.theme.accent-color', ZenThemesCommon.kZenColors[0]);
  },
};

var gZenWorkspacesSettings = {
  init() {
    var tabsUnloaderPrefListener = {
      async observe(subject, topic, data) {
        let buttonIndex = await confirmRestartPrompt(true, 1, true, true);
        if (buttonIndex == CONFIRM_RESTART_PROMPT_RESTART_NOW) {
          Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit | Ci.nsIAppStartup.eRestart);
        }
      },
    };
    Services.prefs.addObserver('zen.workspaces.enabled', this);
    Services.prefs.addObserver('zen.tab-unloader.enabled', tabsUnloaderPrefListener);
    window.addEventListener('unload', () => {
      Services.prefs.removeObserver('zen.workspaces.enabled', this);
      Services.prefs.removeObserver('zen.tab-unloader.enabled', tabsUnloaderPrefListener);
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

const ZEN_CKS_CLASS_BASE = 'zenCKSOption';
const ZEN_CKS_INPUT_FIELD_CLASS = `${ZEN_CKS_CLASS_BASE}-input`;
const ZEN_CKS_LABEL_CLASS = `${ZEN_CKS_CLASS_BASE}-label`;
const ZEN_CKS_WRAPPER_ID = `${ZEN_CKS_CLASS_BASE}-wrapper`;
const ZEN_CKS_GROUP_PREFIX = `${ZEN_CKS_CLASS_BASE}-group`;
const KEYBIND_ATTRIBUTE_KEY = 'key';

var zenMissingKeyboardShortcutL10n = {
  key_quickRestart: 'zen-key-quick-restart',
  key_delete: 'zen-key-delete',
  goBackKb: 'zen-key-go-back',
  goForwardKb: 'zen-key-go-forward',
  key_enterFullScreen: 'zen-key-enter-full-screen',
  key_exitFullScreen: 'zen-key-exit-full-screen',
  key_aboutProcesses: 'zen-key-about-processes',
  key_stop: 'zen-key-stop',
  key_sanitize: 'zen-key-sanitize',
  key_wrCaptureCmd: 'zen-key-wr-capture-cmd',
  key_wrToggleCaptureSequenceCmd: 'zen-key-wr-toggle-capture-sequence-cmd',
  key_undoCloseWindow: 'zen-key-undo-close-window',

  key_selectTab1: 'zen-key-select-tab-1',
  key_selectTab2: 'zen-key-select-tab-2',
  key_selectTab3: 'zen-key-select-tab-3',
  key_selectTab4: 'zen-key-select-tab-4',
  key_selectTab5: 'zen-key-select-tab-5',
  key_selectTab6: 'zen-key-select-tab-6',
  key_selectTab7: 'zen-key-select-tab-7',
  key_selectTab8: 'zen-key-select-tab-8',
  key_selectLastTab: 'zen-key-select-tab-last',

  key_showAllTabs: 'zen-key-show-all-tabs',
  key_gotoHistory: 'zen-key-goto-history',

  goHome: 'zen-key-go-home',
  key_redo: 'zen-key-redo',
};

var gZenCKSSettings = {
  async init() {
    await this._initializeCKS();
    if (this.__hasInitialized) return;
    this.__hasInitialized = true;
    this._currentActionID = null;
    this._initializeEvents();
    window.addEventListener('unload', () => {
      this.__hasInitialized = false;
      document.getElementById(ZEN_CKS_WRAPPER_ID).innerHTML = '';
    });
  },

  _initializeEvents() {
    const resetAllListener = this.resetAllShortcuts.bind(this);
    const handleKeyDown = this._handleKeyDown.bind(this);
    window.addEventListener('keydown', handleKeyDown);
    const button = document.getElementById('zenCKSResetButton');
    button.addEventListener('click', resetAllListener);
    window.addEventListener('unload', () => {
      window.removeEventListener('keydown', handleKeyDown);
      button.removeEventListener('click', resetAllListener);
    });
  },

  async resetAllShortcuts() {
    let buttonIndex = await confirmRestartPrompt(true, 1, true, false);
    if (buttonIndex == CONFIRM_RESTART_PROMPT_RESTART_NOW) {
      await gZenKeyboardShortcutsManager.resetAllShortcuts();
      Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit | Ci.nsIAppStartup.eRestart);
    }
  },

  async _initializeCKS() {
    let wrapper = document.getElementById(ZEN_CKS_WRAPPER_ID);
    wrapper.innerHTML = '';

    let shortcuts = await gZenKeyboardShortcutsManager.getModifiableShortcuts();

    if (!shortcuts) {
      throw Error('No shortcuts defined!');
    }

    // Generate section per each group
    for (let group of VALID_SHORTCUT_GROUPS) {
      let groupClass = `${ZEN_CKS_GROUP_PREFIX}-${group}`;
      if (!wrapper.querySelector(`[data-group="${groupClass}"]`)) {
        let groupElem = document.createElement('h2');
        groupElem.setAttribute('data-group', groupClass);
        document.l10n.setAttributes(groupElem, groupClass);
        wrapper.appendChild(groupElem);
      }
    }

    for (let shortcut of shortcuts) {
      const keyID = shortcut.getID();
      const action = shortcut.getAction();
      const l10nID = shortcut.getL10NID();
      const group = shortcut.getGroup();
      const keyInString = shortcut.toUserString();

      const labelValue = zenMissingKeyboardShortcutL10n[keyID] ?? l10nID;

      let fragment = window.MozXULElement.parseXULToFragment(`
        <hbox class="${ZEN_CKS_CLASS_BASE}">
          <label class="${ZEN_CKS_LABEL_CLASS}" for="${ZEN_CKS_CLASS_BASE}-${keyID}"></label>
          <vbox flex="1">
            <html:input readonly="1" class="${ZEN_CKS_INPUT_FIELD_CLASS}" id="${ZEN_CKS_INPUT_FIELD_CLASS}-${keyID}" />
          </vbox>
        </hbox>
      `);

      const label = fragment.querySelector(`.${ZEN_CKS_LABEL_CLASS}`);
      if (!labelValue) {
        label.textContent = action; // Just in case
      } else {
        document.l10n.setAttributes(label, labelValue);
      }

      let input = fragment.querySelector(`.${ZEN_CKS_INPUT_FIELD_CLASS}`);
      if (keyInString && !shortcut.isEmpty()) {
        input.value = keyInString;
      } else {
        this._resetShortcut(input);
      }

      input.setAttribute(KEYBIND_ATTRIBUTE_KEY, keyID);
      input.setAttribute('data-group', group);
      input.setAttribute('data-id', keyID);

      input.addEventListener('focus', (event) => {
        const value = event.target.getAttribute(KEYBIND_ATTRIBUTE_KEY);
        this._currentActionID = event.target.getAttribute('data-id');
        event.target.classList.add(`${ZEN_CKS_INPUT_FIELD_CLASS}-editing`);
        this._hasSafed = true;
      });

      input.addEventListener('editDone', (event) => {
        const target = event.target;
        target.classList.add(`${ZEN_CKS_INPUT_FIELD_CLASS}-editing`);
      });

      input.addEventListener('blur', (event) => {
        const target = event.target;
        target.classList.remove(`${ZEN_CKS_INPUT_FIELD_CLASS}-editing`);
        if (!this._hasSafed) {
          target.classList.add(`${ZEN_CKS_INPUT_FIELD_CLASS}-unsafed`);
          if (!target.nextElementSibling) {
            target.after(
              window.MozXULElement.parseXULToFragment(`
              <label class="${ZEN_CKS_CLASS_BASE}-unsafed" data-l10n-id="zen-key-unsafed"></label>
            `)
            );
            target.value = 'Not set';
          }
        } else {
          target.classList.remove(`${ZEN_CKS_INPUT_FIELD_CLASS}-unsafed`);
          const sibling = target.nextElementSibling;
          if (sibling && sibling.classList.contains(`${ZEN_CKS_CLASS_BASE}-unsafed`)) {
            sibling.remove();
          }
        }
      });

      const groupElem = wrapper.querySelector(`[data-group="${ZEN_CKS_GROUP_PREFIX}-${group}"]`);
      groupElem.after(fragment);
    }
  },

  async _resetShortcut(input) {
    input.value = 'Not set';
    input.classList.remove(`${ZEN_CKS_INPUT_FIELD_CLASS}-invalid`);
    input.classList.remove(`${ZEN_CKS_INPUT_FIELD_CLASS}-editing`);
    input.classList.add(`${ZEN_CKS_INPUT_FIELD_CLASS}-not-set`);

    if (this._currentActionID) {
      this._editDone();
      await gZenKeyboardShortcutsManager.setShortcut(this._currentActionID, null, null);
    }
  },

  _editDone(shortcut, modifiers) {
    // Check if we have a valid key
    if (!shortcut || !modifiers) {
      return;
    }
    gZenKeyboardShortcutsManager.setShortcut(this._currentActionID, shortcut, modifiers);
    this._currentActionID = null;
  },

  //TODO Check for duplicates
  async _handleKeyDown(event) {
    if (!this._currentActionID || document.hidden) {
      return;
    }

    event.preventDefault();

    let input = document.querySelector(`.${ZEN_CKS_INPUT_FIELD_CLASS}[${KEYBIND_ATTRIBUTE_KEY}="${this._currentActionID}"]`);
    const modifiers = new KeyShortcutModifiers(event.ctrlKey, event.altKey, event.shiftKey, event.metaKey, false);
    const modifiersActive = modifiers.areAnyActive();

    input.classList.remove(`${ZEN_CKS_INPUT_FIELD_CLASS}-not-set`);

    // This is because on some OSs (windows/macos mostly) the key is not the same as the keycode
    // e.g. CTRL+ALT+3 may be displayed as the euro sign
    let shortcut = event.key;

    shortcut = shortcut.replace(/Ctrl|Control|Shift|Alt|Option|Cmd|Meta/, ''); // Remove all modifiers

    if (shortcut == 'Tab' && !modifiersActive) {
      input.classList.remove(`${ZEN_CKS_INPUT_FIELD_CLASS}-editing`);
      this._latestValidKey = null;
      return;
    } else if (shortcut == 'Escape' && !modifiersActive) {
      const hasConflicts = gZenKeyboardShortcutsManager.checkForConflicts(
        this._latestValidKey ? this._latestValidKey : shortcut,
        this._latestModifier ? this._latestModifier : modifiers,
        this._currentActionID
      );

      if (!this._latestValidKey && !this._latestModifier) {
      } else if (!this._latestValidKey || hasConflicts) {
        if (!input.classList.contains(`${ZEN_CKS_INPUT_FIELD_CLASS}-invalid`)) {
          input.classList.add(`${ZEN_CKS_INPUT_FIELD_CLASS}-invalid`);
        }
        input.classList.remove(`${ZEN_CKS_INPUT_FIELD_CLASS}-unsafed`);
        if (hasConflicts && !input.nextElementSibling) {
          input.after(
            window.MozXULElement.parseXULToFragment(`
            <label class="${ZEN_CKS_CLASS_BASE}-conflict" data-l10n-id="zen-key-conflict"></label>
          `)
          );
        }
      } else {
        input.classList.remove(`${ZEN_CKS_INPUT_FIELD_CLASS}-editing`);

        this._editDone(this._latestValidKey, this._latestModifier);
        this._latestValidKey = null;
        this._latestModifier = null;
        input.classList.remove(`${ZEN_CKS_INPUT_FIELD_CLASS}-invalid`);
        input.classList.add(`${ZEN_CKS_INPUT_FIELD_CLASS}-valid`);
        setTimeout(() => {
          input.classList.remove(`${ZEN_CKS_INPUT_FIELD_CLASS}-valid`);
        }, 1000);
        const sibling = input.nextElementSibling;
        if (sibling && sibling.classList.contains(`${ZEN_CKS_CLASS_BASE}-conflict`)) {
          sibling.remove();
        }
      }
      this._hasSafed = true;
      input.blur();
      this._currentActionID = null;
      return;
    } else if (shortcut == 'Backspace' && !modifiersActive) {
      this._resetShortcut(input);
      this._latestValidKey = null;
      this._latestModifier = null;
      this._hasSafed = true;
      return;
    }

    this._latestModifier = modifiers;
    this._hasSafed = false;
    input.classList.remove(`${ZEN_CKS_INPUT_FIELD_CLASS}-invalid`);
    input.classList.remove(`${ZEN_CKS_INPUT_FIELD_CLASS}-not-set`);
    input.value = modifiers.toUserString() + shortcut;
    this._latestValidKey = shortcut;
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
    id: 'zen.workspaces.hide-default-container-indicator',
    type: 'bool',
    default: true,
  },
  {
    id: 'zen.workspaces.individual-pinned-tabs',
    type: 'bool',
    default: true,
  },
  {
    id: 'zen.workspaces.show-icon-strip',
    type: 'bool',
    default: true,
  },
  {
    id: 'zen.tab-unloader.enabled',
    type: 'bool',
    default: true,
  },
  {
    id: 'zen.splitView.change-on-hover',
    type: 'bool',
    default: true,
  },
  {
    id: 'zen.tab-unloader.timeout-minutes',
    type: 'int',
    default: 10,
  },
  {
    id: 'zen.view.show-bottom-border',
    type: 'bool',
    default: false,
  },
  {
    id: 'zen.workspaces.hide-deactivated-workspaces',
    type: 'bool',
    default: true,
  },
  {
    id: 'zen.pinned-tab-manager.restore-pinned-tabs-to-pinned-url',
    type: 'bool',
    default: true,
  },
  {
    id: 'zen.pinned-tab-manager.close-shortcut-behavior',
    type: 'string',
    default: 'switch',
  },
  {
    id: 'zen.workspaces.force-container-workspace',
    type: 'bool',
    default: true,
  },
  {
    id: 'zen.workspaces.open-new-tab-if-last-unpinned-tab-is-closed',
    type: 'bool',
    default: true,
  },
  {
    id: 'services.sync.engine.contextualidentities',
    type: 'bool',
    default: true,
  },
]);
