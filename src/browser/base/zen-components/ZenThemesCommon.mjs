var ZenThemesCommon = {
  kZenColors: ['#aac7ff', '#74d7cb', '#a0d490', '#dec663', '#ffb787', '#dec1b1', '#ffb1c0', '#ddbfc3', '#f6b0ea', '#d4bbff'],

  get browsers() {
    return Services.wm.getEnumerator('navigator:browser');
  },

  get currentBrowser() {
    return Services.wm.getMostRecentWindow('navigator:browser');
  },

  get themesRootPath() {
    return PathUtils.join(PathUtils.profileDir, 'chrome', 'zen-themes');
  },

  get themesDataFile() {
    return PathUtils.join(PathUtils.profileDir, 'zen-themes.json');
  },

  getThemeFolder(themeId) {
    return PathUtils.join(this.themesRootPath, themeId);
  },

  resetThemesCache() {
    this.themes = null;
  },

  async getThemes() {
    if (!this.themes) {
      if (!(await IOUtils.exists(this.themesDataFile))) {
        await IOUtils.writeJSON(this.themesDataFile, {});
      }

      try {
        this.themes = await IOUtils.readJSON(this.themesDataFile);
      } catch (e) {
        // If we have a corrupted file, reset it
        await IOUtils.writeJSON(this.themesDataFile, {});
        this.themes = {};
        gNotificationBox.appendNotification(
          'zen-themes-corrupted',
          {
            label: { 'l10n-id': 'zen-themes-corrupted' },
            image: 'chrome://browser/skin/notification-icons/persistent-storage-blocked.svg',
            priority: gNotificationBox.PRIORITY_WARNING_HIGH,
          },
          []
        );
      }
    }

    return this.themes;
  },

  async getThemePreferences(theme) {
    const themePath = PathUtils.join(this.themesRootPath, theme.id, 'preferences.json');
    if (!(await IOUtils.exists(themePath)) || !theme.preferences) {
      return [];
    }

    const preferences = await IOUtils.readJSON(themePath);

    // compat mode for old preferences, all of them can only be checkboxes
    if (typeof preferences === 'object' && !Array.isArray(preferences)) {
      console.warn(
        `[ZenThemes]: Warning, ${theme.name} uses legacy preferences, please migrate them to the new preferences style, as legacy preferences might be removed at a future release. More information at: https://docs.zen-browser.app/themes-store/themes-marketplace-preferences`
      );
      const newThemePreferences = [];

      for (let [entry, label] of Object.entries(preferences)) {
        const [_, negation = '', os = '', property] = /(!?)(?:(macos|windows|linux):)?([A-z0-9-_.]+)/g.exec(entry);
        const isNegation = negation === '!';

        if (
          (isNegation && os === gZenOperatingSystemCommonUtils.currentOperatingSystem) ||
          (os !== '' && os !== gZenOperatingSystemCommonUtils.currentOperatingSystem && !isNegation)
        ) {
          continue;
        }

        newThemePreferences.push({
          property,
          label,
          type: 'checkbox',
          disabledOn: os !== '' ? [os] : [],
        });
      }

      return newThemePreferences;
    }

    return preferences.filter(
      ({ disabledOn = [] }) => !disabledOn.includes(gZenOperatingSystemCommonUtils.currentOperatingSystem)
    );
  },

  throttle(mainFunction, delay) {
    let timerFlag = null;

    return (...args) => {
      if (timerFlag === null) {
        mainFunction(...args);
        timerFlag = setTimeout(() => {
          timerFlag = null;
        }, delay);
      }
    };
  },

  debounce(mainFunction, wait) {
    let timerFlag;

    return (...args) => {
      clearTimeout(timerFlag);
      timerFlag = setTimeout(() => {
        mainFunction(...args);
      }, wait);
    };
  },
};
