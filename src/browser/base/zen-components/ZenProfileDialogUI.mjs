// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

var ZenProfileDialogUI = {
  showSubView(parent, event) {
    let element = parent.querySelector('.zen-side-bar-profiles-button-panel-correction') || parent;
    PanelUI.showSubView('PanelUI-zen-profiles', element, event);
    this._updateProfilesList();
    this._updateCurentProfileId();
  },

  _updateProfilesList() {
    let parentList = document.getElementById('PanelUI-zen-profiles-list');
    this._emptyUserList(parentList);
    if (this._getProfilesSize(ProfileService.profiles) <= 1) {
      return;
    }
    parentList.appendChild(document.createElement('toolbarseparator'));
    for (let profile of ProfileService.profiles) {
      if (profile == ProfileService.currentProfile) {
        continue;
      }
      let item = document.createElement('div');
      item.onclick = () => this._openProfile(profile);
      item.className = 'PanelUI-zen-profiles-item';
      let avatar = document.createElement('img');
      avatar.className = 'PanelUI-zen-profiles-item-avatar';
      let name = document.createElement('div');
      name.className = 'PanelUI-zen-profiles-item-name';
      name.appendChild(document.createTextNode(profile.name));
      name.container = true;
      avatar.setAttribute('src', ZenThemeModifier._getThemedAvatar(profile.zenAvatarPath));
      item.appendChild(avatar);
      item.appendChild(name);
      parentList.appendChild(item);
    }
  },

  _emptyUserList(element) {
    element.innerHTML = '';
  },

  _updateCurentProfileId() {
    let currentProfile = ProfileService.currentProfile;
    if (!currentProfile) return;
    let nameContainer = document.getElementById('PanelUI-zen-profiles-current-name');
    nameContainer.textContent = currentProfile.name;
  },

  _openProfile(profile) {
    Services.startup.createInstanceWithProfile(profile);
  },

  _getProfilesSize(profiles) {
    let size = 0;
    for (let _ of profiles) {
      size += 1;
    }
    return size;
  },

  createProfileWizard() {
    // This should be rewritten in HTML eventually.
    // TODO: it could be `window.browsingContext.topChromeWindow.gDialogBox.open` but it does not work with the callback?
    window.browsingContext.topChromeWindow.openDialog(
      'chrome://mozapps/content/profile/createProfileWizard.xhtml',
      '',
      'centerscreen,chrome,modal,titlebar',
      ProfileService,
      {
        CreateProfile: async (profile) => {
          try {
            ProfileService.defaultProfile = profile;
            this._flush();
            this._openProfile(profile);
          } catch (e) {
            // This can happen on dev-edition.
            let [title, msg] = await document.l10n.formatValues([
              { id: 'profiles-cannot-set-as-default-title' },
              { id: 'profiles-cannot-set-as-default-message' },
            ]);

            Services.prompt.alert(window, title, msg);
          }
        },
      }
    );
  },

  async _flush() {
    try {
      ProfileService.flush();
      this._updateProfilesList();
    } catch (e) {
      let [title, msg, button] = await document.l10n.formatValues([
        { id: 'profiles-flush-fail-title' },
        {
          id: e.result == Cr.NS_ERROR_DATABASE_CHANGED ? 'profiles-flush-conflict' : 'profiles-flush-failed',
        },
        { id: 'profiles-flush-restart-button' },
      ]);

      const PS = Ci.nsIPromptService;
      let result = Services.prompt.confirmEx(
        window,
        title,
        msg,
        PS.BUTTON_POS_0 * PS.BUTTON_TITLE_CANCEL + PS.BUTTON_POS_1 * PS.BUTTON_TITLE_IS_STRING,
        null,
        button,
        null,
        null,
        {}
      );
      if (result == 1) {
        this._restart(false);
      }
    }
  },

  _restart(safeMode) {
    let cancelQuit = Cc['@mozilla.org/supports-PRBool;1'].createInstance(Ci.nsISupportsPRBool);
    Services.obs.notifyObservers(cancelQuit, 'quit-application-requested', 'restart');

    if (cancelQuit.data) {
      return;
    }

    let flags = Ci.nsIAppStartup.eAttemptQuit | Ci.nsIAppStartup.eRestart;

    if (safeMode) {
      Services.startup.restartInSafeMode(flags);
    } else {
      Services.startup.quit(flags);
    }
  },
};
