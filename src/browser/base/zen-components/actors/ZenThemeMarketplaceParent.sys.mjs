export class ZenThemeMarketplaceParent extends JSWindowActorParent {
  constructor() {
    super();
  }

  async receiveMessage(message) {
    switch (message.name) {
      case 'ZenThemeMarketplace:InstallTheme': {
        console.info('ZenThemeMarketplaceParent: Updating themes');
        const theme = message.data.theme;
        theme.enabled = true;
        const themes = await this.getThemes();
        themes[theme.id] = theme;
        this.updateThemes(themes);
        this.updateChildProcesses(theme.id);
        break;
      }
      case 'ZenThemeMarketplace:UninstallTheme': {
        console.info('ZenThemeMarketplaceParent: Uninstalling theme');
        const themeId = message.data.themeId;
        const themes = await this.getThemes();
        delete themes[themeId];
        this.removeTheme(themeId);
        this.updateThemes(themes);
        this.updateChildProcesses(themeId);
        break;
      }
      case 'ZenThemeMarketplace:IsThemeInstalled': {
        const themeId = message.data.themeId;
        const themes = await this.getThemes();
        return themes[themeId] ? true : false;
      }
      case 'ZenThemeMarketplace:CheckForUpdates': {
        this.checkForThemeUpdates();
        break;
      }
      case 'ZenThemeMarketplace:RicePage': {
        this.openRicePage(this.browsingContext.topChromeWindow, message.data);
        break;
      }
    }
  }

  openRicePage(window, data) {
    window.gZenThemePicker.riceManager.openRicePage(data);
  }

  compareVersions(version1, version2) {
    var result = false;
    if (typeof version1 !== 'object') {
      version1 = version1.toString().split('.');
    }
    if (typeof version2 !== 'object') {
      version2 = version2.toString().split('.');
    }
    for (var i = 0; i < Math.max(version1.length, version2.length); i++) {
      if (version1[i] == undefined) {
        version1[i] = 0;
      }
      if (version2[i] == undefined) {
        version2[i] = 0;
      }
      if (Number(version1[i]) < Number(version2[i])) {
        result = true;
        break;
      }
      if (version1[i] != version2[i]) {
        break;
      }
    }
    return result;
  }

  async checkForThemeUpdates() {
    console.info('ZenThemeMarketplaceParent: Checking for theme updates');

    let updates = [];
    this._themes = null;

    for (const theme of Object.values(await this.getThemes())) {
      const themeInfo = await this.sendQuery('ZenThemeMarketplace:GetThemeInfo', { themeId: theme.id });

      if (!themeInfo) {
        continue;
      }

      if (!this.compareVersions(themeInfo.version, theme.version || '0.0.0') && themeInfo.version != theme.version) {
        console.info('ZenThemeMarketplaceParent: Theme update found', theme.id, theme.version, themeInfo.version);

        themeInfo.enabled = theme.enabled;
        updates.push(themeInfo);

        await this.removeTheme(theme.id, false);

        this._themes[themeInfo.id] = themeInfo;
      }
    }

    await this.updateThemes(this._themes);

    this.sendAsyncMessage('ZenThemeMarketplace:CheckForUpdatesFinished', { updates });
  }

  async updateChildProcesses(themeId) {
    this.sendAsyncMessage('ZenThemeMarketplace:ThemeChanged', { themeId });
  }

  async getThemes() {
    if (!this._themes) {
      if (!(await IOUtils.exists(this.themesDataFile))) {
        await IOUtils.writeJSON(this.themesDataFile, {});
      }
      this._themes = await IOUtils.readJSON(this.themesDataFile);
    }
    return this._themes;
  }

  async updateThemes(themes) {
    this._themes = themes;
    await IOUtils.writeJSON(this.themesDataFile, themes);
    await this.checkForThemeChanges();
  }

  getStyleSheetFullContent(style = '') {
    let stylesheet = '@-moz-document url-prefix("chrome:") {';

    for (const line of style.split('\n')) {
      stylesheet += `  ${line}`;
    }

    stylesheet += '}';

    return stylesheet;
  }

  async downloadUrlToFile(url, path, isStyleSheet = false) {
    try {
      const response = await fetch(url);
      const data = await response.text();
      const content = isStyleSheet ? this.getStyleSheetFullContent(data) : data;
      // convert the data into a Uint8Array
      let buffer = new TextEncoder().encode(content);
      await IOUtils.write(path, buffer);
    } catch (e) {
      console.error('ZenThemeMarketplaceParent: Error downloading file', url, e);
    }
  }

  async downloadThemeFileContents(theme) {
    const themePath = PathUtils.join(this.themesRootPath, theme.id);
    await IOUtils.makeDirectory(themePath, { ignoreExisting: true });
    await this.downloadUrlToFile(theme.style, PathUtils.join(themePath, 'chrome.css'), true);
    await this.downloadUrlToFile(theme.readme, PathUtils.join(themePath, 'readme.md'));
    if (theme.preferences) {
      await this.downloadUrlToFile(theme.preferences, PathUtils.join(themePath, 'preferences.json'));
    }
  }

  get themesRootPath() {
    return PathUtils.join(PathUtils.profileDir, 'chrome', 'zen-themes');
  }

  get themesDataFile() {
    return PathUtils.join(PathUtils.profileDir, 'zen-themes.json');
  }

  triggerThemeUpdate() {
    const pref = 'zen.themes.updated-value-observer';
    Services.prefs.setBoolPref(pref, !Services.prefs.getBoolPref(pref));
  }

  async installTheme(theme) {
    await this.downloadThemeFileContents(theme);
  }

  async checkForThemeChanges() {
    const themes = await this.getThemes();

    const themeIds = Object.keys(themes);

    for (const themeId of themeIds) {
      const theme = themes[themeId];

      if (!theme) {
        continue;
      }

      const themePath = PathUtils.join(this.themesRootPath, themeId);

      if (!(await IOUtils.exists(themePath))) {
        await this.installTheme(theme);
      }
    }

    this.triggerThemeUpdate();
  }

  async removeTheme(themeId, triggerUpdate = true) {
    const themePath = PathUtils.join(this.themesRootPath, themeId);
    await IOUtils.remove(themePath, { recursive: true, ignoreAbsent: true });

    if (triggerUpdate) {
      this.triggerThemeUpdate();
    }
  }
}
