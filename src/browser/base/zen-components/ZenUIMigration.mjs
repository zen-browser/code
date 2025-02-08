const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  BrowserWindowTracker: 'resource:///modules/BrowserWindowTracker.sys.mjs',
});

class ZenUIMigration {
  PREF_NAME = 'zen.migration.version';
  MIGRATION_VERSION = 1;

  init(isNewProfile, win) {
    if (!isNewProfile) {
      this._migrate(win);
    }
    this.clearVariables();
  }

  get _migrationVersion() {
    return Services.prefs.getIntPref(this.PREF_NAME, 0);
  }

  set _migrationVersion(value) {
    Services.prefs.setIntPref(this.PREF_NAME, value);
  }

  _migrate(win) {
    if (this._migrationVersion < 1) {
      this._migrateV1(win);
    }
  }

  clearVariables() {
    this._migrationVersion = this.MIGRATION_VERSION;
  }

  async _migrateV1(win) {
    // Introduction of the new URL bar, show a message to the user
    const notification = win.gNotificationBox.appendNotification(
      'zen-new-urlbar-notification',
      {
        label: { 'l10n-id': 'zen-new-urlbar-notification' },
        image: 'chrome://browser/skin/notification-icons/persistent-storage-blocked.svg',
        priority: win.gNotificationBox.PRIORITY_WARNING_HIGH,
      },
      [
        {
          'l10n-id': 'zen-disable',
          accessKey: 'D',
          callback: () => {
            Services.prefs.setBoolPref('zen.urlbar.replace-newtab', false);
          },
        },
        {
          link: 'https://docs.zen-browser.app/user-manual/urlbar/',
          'l10n-id': 'zen-learn-more-text',
        },
      ]
    );
    notification.persistence = -1;
  }
}

export var gZenUIMigration = new ZenUIMigration();
