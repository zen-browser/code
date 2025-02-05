
{
  const PREF_NAME = "zen.migration.version";
  const MIGRATION_VERSION = 1;

  class ZenUIMigration {
    init() {
      if (Services.prefs.prefHasUserValue(PREF_NAME)) {
        this._migrate();
      }
      this.clearVariables();
    }

    get _migrationVersion() {
      return Services.prefs.getIntPref(PREF_NAME, 0);
    }

    set _migrationVersion(value) {
      Services.prefs.setIntPref(PREF_NAME, value);
    }

    _migrate() {
      if (this._migrationVersion < 1) {
        this._migrateV1();
      }
    }

    clearVariables() {
      this._migrationVersion = MIGRATION_VERSION;
      window.gZenUIMigration = null;
    }

    async _migrateV1() {
      // Introduction of the new URL bar, show a message to the user
      const notification = gNotificationBox.appendNotification(
        'zen-new-urlbar-notification',
        {
          label: { 'l10n-id': 'zen-new-urlbar-notification' },
          image: 'chrome://browser/skin/notification-icons/persistent-storage-blocked.svg',
          priority: gNotificationBox.PRIORITY_WARNING_HIGH,
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
            link: "https://docs.zen-browser.app/user-manual/urlbar/",
            'l10n-id': "zen-learn-more-text",
          }
        ],
      );
      notification.persistence = -1;
    }
  }

  window.gZenUIMigration = new ZenUIMigration();
}
