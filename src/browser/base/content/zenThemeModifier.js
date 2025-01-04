/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

/* INCLUDE THIS FILE AS:
 *   <script src="chrome://browser/content/zenThemeModifier.js"></script>
 *
 * FOR ANY WEBSITE THAT WOULD NEED TO USE THE ACCENT COLOR, ETC
 */

const kZenThemePrefsList = ['zen.theme.accent-color', 'zen.theme.border-radius', 'zen.theme.content-element-separation'];

/**
 * ZenThemeModifier controls the application of theme data to the browser,
 * for examplem, it injects the accent color to the document. This is used
 * because we need a way to apply the accent color without having to worry about
 * shadow roots not inheriting the accent color.
 *
 * note: It must be a firefox builtin page with access to the browser's configuration
 *  and services.
 */
var ZenThemeModifier = {
  _inMainBrowserWindow: false,

  /**
   * Listen for theming updates from the LightweightThemeChild actor, and
   * begin listening to changes in preferred color scheme.
   */
  init() {
    this._inMainBrowserWindow = window.location.href == 'chrome://browser/content/browser.xhtml';
    this.listenForEvents();
    this.updateAllThemeBasics();
    this._onPrefersColorSchemeChange();
  },

  listenForEvents() {
    if (this._inMainBrowserWindow) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', this._onPrefersColorSchemeChange.bind(this));
    }

    var handleEvent = this.handleEvent.bind(this);
    // Listen for changes in the accent color and border radius
    for (let pref of kZenThemePrefsList) {
      Services.prefs.addObserver(pref, handleEvent);
    }

    window.addEventListener('unload', () => {
      for (let pref of kZenThemePrefsList) {
        Services.prefs.removeObserver(pref, handleEvent);
      }
    });
  },

  handleEvent(event) {
    // note: even might be undefined, but we shoudnt use it!
    this.updateAllThemeBasics();
  },

  /**
   * Update all theme basics, like the accent color.
   */
  async updateAllThemeBasics() {
    this.updateAccentColor();
    this.updateBorderRadius();
    this.updateElementSeparation();
  },

  updateBorderRadius() {
    const borderRadius = Services.prefs.getIntPref('zen.theme.border-radius');
    document.documentElement.style.setProperty('--zen-border-radius', borderRadius + 'px');
  },

  updateElementSeparation() {
    const separation = Services.prefs.getIntPref('zen.theme.content-element-separation');
    document.documentElement.style.setProperty('--zen-element-separation', separation + 'px');
    if (separation == 0) {
      document.documentElement.setAttribute('zen-no-padding', true);
    } else {
      document.documentElement.removeAttribute('zen-no-padding');
    }
  },

  /**
   * Update the accent color.
   */
  updateAccentColor() {
    const accentColor = Services.prefs.getStringPref('zen.theme.accent-color');
    document.documentElement.style.setProperty('--zen-primary-color', accentColor);
    // Notify the page that the accent color has changed, only if a function
    // handler is defined.
    if (typeof window.zenPageAccentColorChanged === 'function') {
      window.zenPageAccentColorChanged(accentColor);
    }
  },

  _onPrefersColorSchemeChange() {
    this._updateZenAvatar();
  },

  _updateZenAvatar() {
    if (typeof ProfileService === 'undefined') {
      return;
    }
    const mainWindowEl = document.documentElement;
    // Dont override the sync avatar if it's already set
    if (mainWindowEl.style.hasOwnProperty('--avatar-image-url')) {
      return;
    }
    let profile = ProfileService.currentProfile;
    if (!profile || profile.zenAvatarPath == '') return;
    // TODO: actually use profile data to generate the avatar, instead of just using the name
    let avatarUrl = this._getThemedAvatar(profile.zenAvatarPath);
    if (document.documentElement.hasAttribute('privatebrowsingmode')) {
      avatarUrl = 'chrome://global/skin/icons/indicator-private-browsing.svg';
    }
    mainWindowEl.style.setProperty('--zen-avatar-image-url', `url(${avatarUrl})`);
    mainWindowEl.style.setProperty('--avatar-image-url', `var(--zen-avatar-image-url)`, 'important');
  },

  _getThemedAvatar(avatarPath) {
    if (!avatarPath || !avatarPath.startsWith('chrome://browser/content/zen-avatars/avatar-') || !avatarPath.endsWith('.svg')) {
      return avatarPath;
    }
    let withoutExtension = avatarPath.slice(0, -4);
    let scheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    return `${withoutExtension}-${scheme}.svg`;
  },
};

if (typeof Services !== 'undefined') ZenThemeModifier.init();
