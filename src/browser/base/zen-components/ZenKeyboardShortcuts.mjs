const KEYCODE_MAP = {
  F1: 'VK_F1',
  F2: 'VK_F2',
  F3: 'VK_F3',
  F4: 'VK_F4',
  F5: 'VK_F5',
  F6: 'VK_F6',
  F7: 'VK_F7',
  F8: 'VK_F8',
  F9: 'VK_F9',
  F10: 'VK_F10',
  F11: 'VK_F11',
  F12: 'VK_F12',
  F13: 'VK_F13',
  F14: 'VK_F14',
  F15: 'VK_F15',
  F16: 'VK_F16',
  F17: 'VK_F17',
  F18: 'VK_F18',
  F19: 'VK_F19',
  F20: 'VK_F20',
  F21: 'VK_F21',
  F22: 'VK_F22',
  F23: 'VK_F23',
  F24: 'VK_F24',
  TAB: 'VK_TAB',
  ENTER: 'VK_RETURN',
  ESCAPE: 'VK_ESCAPE',
  SPACE: 'VK_SPACE',
  ARROWLEFT: 'VK_LEFT',
  ARROWRIGHT: 'VK_RIGHT',
  ARROWUP: 'VK_UP',
  ARROWDOWN: 'VK_DOWN',
  DELETE: 'VK_DELETE',
  BACKSPACE: 'VK_BACK',
  HOME: 'VK_HOME',
  NUM_LOCK: 'VK_NUMLOCK',
  SCROLL_LOCK: 'VK_SCROLL',
};

const defaultKeyboardGroups = {
  windowAndTabManagement: [
    'zen-window-new-shortcut',
    'zen-tab-new-shortcut',
    'zen-key-enter-full-screen',
    'zen-key-exit-full-screen',
    'zen-quit-app-shortcut',
    'zen-close-tab-shortcut',
    'zen-close-shortcut',
    'id:key_selectTab1',
    'id:key_selectTab2',
    'id:key_selectTab3',
    'id:key_selectTab4',
    'id:key_selectTab5',
    'id:key_selectTab6',
    'id:key_selectTab7',
    'id:key_selectTab8',
    'id:key_selectLastTab',
  ],
  navigation: [
    'zen-nav-back-shortcut-alt',
    'zen-nav-fwd-shortcut-alt',
    'zen-nav-reload-shortcut-2',
    'zen-nav-reload-shortcut-skip-cache',
    'zen-nav-reload-shortcut',
    'zen-key-stop',
    'zen-window-new-shortcut',
    'zen-private-browsing-shortcut',
    'id:goHome',
    'id:key_gotoHistory',
    'id:goBackKb',
    'id:goForwardKb',
  ],
  searchAndFind: [
    'zen-search-focus-shortcut',
    'zen-search-focus-shortcut-alt',
    'zen-find-shortcut',
    'zen-search-find-again-shortcut-2',
    'zen-search-find-again-shortcut',
    'zen-search-find-again-shortcut-prev',
  ],
  pageOperations: [
    'zen-text-action-copy-url-shortcut',
    'zen-location-open-shortcut',
    'zen-location-open-shortcut-alt',
    'zen-save-page-shortcut',
    'zen-print-shortcut',
    'zen-page-source-shortcut',
    'zen-page-info-shortcut',
    'zen-reader-mode-toggle-shortcut-other',
    'zen-picture-in-picture-toggle-shortcut',
  ],
  historyAndBookmarks: [
    'zen-history-show-all-shortcut',
    'zen-bookmark-this-page-shortcut',
    'zen-bookmark-show-library-shortcut',
  ],
  mediaAndDisplay: [
    'zen-mute-toggle-shortcut',
    'zen-full-zoom-reduce-shortcut',
    'zen-full-zoom-enlarge-shortcut',
    'zen-full-zoom-reset-shortcut',
    'zen-bidi-switch-direction-shortcut',
    'zen-screenshot-shortcut',
  ],
  devTools: [
    /*Filled automatically*/
  ],
};

const fixedL10nIds = {
  cmd_findPrevious: 'zen-search-find-again-shortcut-prev',
  'Browser:ReloadSkipCache': 'zen-nav-reload-shortcut-skip-cache',
  cmd_close: 'zen-close-tab-shortcut',
  'History:RestoreLastClosedTabOrWindowOrSession': 'zen-restore-last-closed-tab-shortcut',
};

const ZEN_MAIN_KEYSET_ID = 'mainKeyset';
const ZEN_DEVTOOLS_KEYSET_ID = 'devtoolsKeyset';
const ZEN_KEYSET_ID = 'zenKeyset';

const ZEN_COMPACT_MODE_SHORTCUTS_GROUP = 'zen-compact-mode';
const ZEN_WORKSPACE_SHORTCUTS_GROUP = 'zen-workspace';
const ZEN_OTHER_SHORTCUTS_GROUP = 'zen-other';
const ZEN_SPLIT_VIEW_SHORTCUTS_GROUP = 'zen-split-view';
const FIREFOX_SHORTCUTS_GROUP = 'zen-kbs-invalid';
const VALID_SHORTCUT_GROUPS = [
  ZEN_COMPACT_MODE_SHORTCUTS_GROUP,
  ZEN_WORKSPACE_SHORTCUTS_GROUP,
  ZEN_SPLIT_VIEW_SHORTCUTS_GROUP,
  ...Object.keys(defaultKeyboardGroups),
  ZEN_OTHER_SHORTCUTS_GROUP,
  'other',
];

class KeyShortcutModifiers {
  #control = false;
  #alt = false;
  #shift = false;
  #meta = false;
  #accel = false;

  constructor(ctrl, alt, shift, meta, accel) {
    this.#control = ctrl;
    this.#alt = alt;
    this.#shift = shift;
    this.#meta = meta;
    this.#accel = accel;

    if (AppConstants.platform != 'macosx') {
      // Replace control with accel, to make it more consistent
      this.#accel = ctrl || accel;
      this.#control = false;
    }
  }

  static parseFromJSON(modifiers) {
    if (!modifiers) {
      return new KeyShortcutModifiers(false, false, false, false, false);
    }

    return new KeyShortcutModifiers(
      modifiers['control'] == true,
      modifiers['alt'] == true,
      modifiers['shift'] == true,
      modifiers['meta'] == true,
      modifiers['accel'] == true
    );
  }

  static parseFromXHTMLAttribute(modifiers) {
    if (!modifiers) {
      return new KeyShortcutModifiers(false, false, false, false, false);
    }

    return new KeyShortcutModifiers(
      modifiers.includes('control'),
      modifiers.includes('alt'),
      modifiers.includes('shift'),
      modifiers.includes('meta'),
      modifiers.includes('accel')
    );
  }

  // used to avoid any future changes to the object
  static fromObject({ ctrl = false, alt = false, shift = false, meta = false, accel = false }) {
    return new KeyShortcutModifiers(ctrl, alt, shift, meta, accel);
  }

  toUserString() {
    let str = '';
    if (this.#control && !this.#accel) {
      str += 'Ctrl+';
    }
    if (this.#alt) {
      str += AppConstants.platform == 'macosx' ? 'Option+' : 'Alt+';
    }
    if (this.#shift) {
      str += 'Shift+';
    }
    if (this.#meta) {
      str += AppConstants.platform == 'macosx' ? 'Cmd+' : 'Win+';
    }
    if (this.#accel) {
      str += AppConstants.platform == 'macosx' ? 'Cmd+' : 'Ctrl+';
    }
    return str;
  }

  equals(other) {
    if (!other) {
      return false;
    }
    // If we are on macos, we can have accel and meta at the same time
    return (
      this.#alt == other.#alt &&
      this.#shift == other.#shift &&
      this.#control == other.#control &&
      (AppConstants.platform == 'macosx'
        ? (this.#meta || this.#accel) == (other.#meta || other.#accel) && this.#control == other.#control
        : // In other platforms, we can have control and accel counting as the same thing
          this.#meta == other.#meta && (this.#control || this.#accel) == (other.#control || other.#accel))
    );
  }

  toString() {
    let str = '';
    if (this.#control) {
      str += 'control,';
    }
    if (this.#accel) {
      str += 'accel,';
    }
    if (this.#shift) {
      str += 'shift,';
    }
    if (this.#alt) {
      str += 'alt,';
    }
    if (this.#meta) {
      str += 'meta,';
    }
    return str.slice(0, -1);
  }

  toJSONString() {
    return {
      control: this.#control,
      alt: this.#alt,
      shift: this.#shift,
      meta: this.#meta,
      accel: this.#accel,
    };
  }

  areAnyActive() {
    return this.#control || this.#alt || this.#shift || this.#meta || this.#accel;
  }

  get control() {
    return this.#control;
  }

  get alt() {
    return this.#alt;
  }

  get shift() {
    return this.#shift;
  }

  get meta() {
    return this.#meta;
  }

  get accel() {
    return this.#accel;
  }
}

class KeyShortcut {
  #id = '';
  #key = '';
  #keycode = '';
  #group = FIREFOX_SHORTCUTS_GROUP;
  #modifiers = new KeyShortcutModifiers(false, false, false, false, false);
  #action = '';
  #l10nId = '';
  #disabled = false;
  #reserved = false;
  #internal = false;

  constructor(id, key, keycode, group, modifiers, action, l10nId, disabled = false, reserved = false, internal = false) {
    this.#id = id;
    this.#key = key?.toLowerCase();
    this.#keycode = keycode;

    if (!VALID_SHORTCUT_GROUPS.includes(group)) {
      throw new Error('Illegal group value: ' + group);
    }

    this.#group = group;
    this.#modifiers = modifiers;
    this.#action = action;
    this.#l10nId = KeyShortcut.sanitizeL10nId(l10nId, action);
    this.#disabled = disabled;
    this.#reserved = reserved;
    this.#internal = internal;
  }

  isEmpty() {
    return !this.#key && !this.getRealKeycode();
  }

  static parseFromSaved(json) {
    let rv = [];
    for (let key of json) {
      rv.push(this.#parseFromJSON(key));
    }

    return rv;
  }

  static getGroupFromL10nId(l10nId, id) {
    // Find inside defaultKeyboardGroups
    for (let group of Object.keys(defaultKeyboardGroups)) {
      for (let shortcut of defaultKeyboardGroups[group]) {
        if (shortcut == l10nId || shortcut == 'id:' + id) {
          return group;
        }
      }
    }
    return 'other';
  }

  static #parseFromJSON(json) {
    return new KeyShortcut(
      json['id'],
      json['key'],
      json['keycode'],
      json['group'],
      KeyShortcutModifiers.parseFromJSON(json['modifiers']),
      json['action'],
      json['l10nId'],
      json['disabled'],
      json['reserved'],
      json['internal']
    );
  }

  static parseFromXHTML(key, { group = undefined } = {}) {
    return new KeyShortcut(
      key.getAttribute('id'),
      key.getAttribute('key'),
      key.getAttribute('keycode'),
      group ??
        KeyShortcut.getGroupFromL10nId(KeyShortcut.sanitizeL10nId(key.getAttribute('data-l10n-id')), key.getAttribute('id')),
      KeyShortcutModifiers.parseFromXHTMLAttribute(key.getAttribute('modifiers')),
      key.getAttribute('command'),
      key.getAttribute('data-l10n-id'),
      key.getAttribute('disabled') == 'true',
      key.getAttribute('reserved') == 'true',
      key.getAttribute('internal') == 'true'
    );
  }

  static sanitizeL10nId(id, action) {
    if (!id || id.startsWith('zen-')) {
      return id;
    }
    // Check if any action is on the list of fixed l10n ids
    if (fixedL10nIds[action]) {
      return fixedL10nIds[action];
    }
    return `zen-${id}`;
  }

  toXHTMLElement(window) {
    let key = window.document.createXULElement('key');
    return this.replaceWithChild(key);
  }

  replaceWithChild(key) {
    key.id = this.#id;
    if (this.#keycode) {
      key.setAttribute('keycode', this.#keycode);
      key.removeAttribute('key');
    } else {
      // note to "mr. macos": Better use setAttribute, because without it, there's a
      //  risk of malforming the XUL element.
      key.setAttribute('key', this.#key);
      key.removeAttribute('keycode');
    }
    key.setAttribute('group', this.#group);

    // note to "mr. macos": We add the `zen-` prefix because firefox hasnt been built with the
    // shortcuts in mind, it will simply just override the shortcuts with whatever the default is.
    //  note that this l10n id is not used for actually translating the key's label, but rather to
    //  identify the default keybinds.
    if (this.#l10nId) {
      key.setAttribute('data-l10n-id', this.#l10nId);
    }
    key.setAttribute('modifiers', this.#modifiers.toString());
    if (this.#action) {
      if (this.#action?.startsWith('code:')) {
        key.setAttribute('oncommand', this.#action.substring(5));
      } else {
        key.setAttribute('command', this.#action);
      }
    }
    if (this.#disabled) {
      key.setAttribute('disabled', this.#disabled);
    }
    if (this.#reserved) {
      key.setAttribute('reserved', this.#reserved);
    }
    if (this.#internal) {
      key.setAttribute('internal', this.#internal);
    }
    key.setAttribute('zen-keybind', 'true');

    return key;
  }

  _modifyInternalAttribute(value) {
    this.#internal = value;
  }

  getRealKeycode() {
    if (this.#keycode === '') {
      return null;
    }
    return this.#keycode;
  }

  getID() {
    return this.#id;
  }

  getAction() {
    return this.#action;
  }

  getL10NID() {
    return this.#l10nId;
  }

  getGroup() {
    return this.#group;
  }

  getModifiers() {
    return this.#modifiers;
  }

  getKeyName() {
    return this.#key?.toLowerCase();
  }

  getKeyCode() {
    return this.getRealKeycode();
  }

  getKeyNameOrCode() {
    return this.#key ? this.getKeyName() : this.getKeyCode();
  }

  isDisabled() {
    return this.#disabled;
  }

  isReserved() {
    return this.#reserved;
  }

  isInternal() {
    return this.#internal;
  }

  isInvalid() {
    return this.#key == '' && this.#keycode == '' && this.#l10nId == null;
  }

  setModifiers(modifiers) {
    if ((!modifiers) instanceof KeyShortcutModifiers) {
      throw new Error('Only KeyShortcutModifiers allowed');
    }
    this.#modifiers = modifiers;
  }

  toJSONForm() {
    return {
      id: this.#id,
      key: this.#key,
      keycode: this.#keycode,
      group: this.#group,
      l10nId: this.#l10nId,
      modifiers: this.#modifiers.toJSONString(),
      action: this.#action,
      disabled: this.#disabled,
      reserved: this.#reserved,
      internal: this.#internal,
    };
  }

  toUserString() {
    let str = this.#modifiers.toUserString();

    if (this.#key) {
      str += this.#key.toUpperCase();
    } else if (this.#keycode) {
      // Get the key from the value
      for (let [key, value] of Object.entries(KEYCODE_MAP)) {
        if (value == this.#keycode) {
          str += key.toLowerCase();
          break;
        }
      }
    } else {
      return '';
    }
    return str;
  }

  isUserEditable() {
    if (!this.#id || this.#internal || (this.#group == FIREFOX_SHORTCUTS_GROUP && this.#disabled)) {
      return false;
    }
    return true;
  }

  clearKeybind() {
    this.#key = '';
    this.#keycode = '';
    this.#modifiers = new KeyShortcutModifiers(false, false, false, false);
  }

  setNewBinding(shortcut) {
    for (let keycode of Object.keys(KEYCODE_MAP)) {
      if (keycode == shortcut.toUpperCase()) {
        this.#keycode = KEYCODE_MAP[keycode];
        this.#key = '';
        return;
      }
    }

    this.#keycode = ''; // Clear the keycode
    this.#key = shortcut;
  }
}

class ZenKeyboardShortcutsLoader {
  constructor() {}

  get shortcutsFile() {
    return PathUtils.join(PathUtils.profileDir, 'zen-keyboard-shortcuts.json');
  }

  async save(data) {
    await IOUtils.writeJSON(this.shortcutsFile, data);
  }

  async loadObject() {
    try {
      return await IOUtils.readJSON(this.shortcutsFile);
    } catch (e) {
      // Recreate shortcuts file
      Services.prefs.clearUserPref('zen.keyboard.shortcuts.version');
      console.warn('Error loading shortcuts file', e);
      return null;
    }
  }

  async load() {
    return (await this.loadObject())?.shortcuts;
  }

  async remove() {
    await IOUtils.remove(this.shortcutsFile);
  }

  static zenGetDefaultShortcuts() {
    // DO NOT CHANGE ANYTHING HERE
    // For adding new default shortcuts, add them to inside the migration function
    //  and increment the version number.

    let keySet = document.getElementById(ZEN_MAIN_KEYSET_ID);
    let newShortcutList = [];

    // Firefox's standard keyset. Reverse order to keep the order of the keys
    for (let i = keySet.children.length - 1; i >= 0; i--) {
      let key = keySet.children[i];
      let parsed = KeyShortcut.parseFromXHTML(key);
      newShortcutList.push(parsed);
    }

    // Compact mode's keyset
    newShortcutList.push(
      new KeyShortcut(
        'zen-compact-mode-toggle',
        'C',
        '',
        ZEN_COMPACT_MODE_SHORTCUTS_GROUP,
        KeyShortcutModifiers.fromObject({ accel: true, alt: true }),
        'code:gZenCompactModeManager.toggle()',
        'zen-compact-mode-shortcut-toggle'
      )
    );
    newShortcutList.push(
      new KeyShortcut(
        'zen-compact-mode-show-sidebar',
        'S',
        '',
        ZEN_COMPACT_MODE_SHORTCUTS_GROUP,
        KeyShortcutModifiers.fromObject({ accel: true, alt: true }),
        'code:gZenCompactModeManager.toggleSidebar()',
        'zen-compact-mode-shortcut-show-sidebar'
      )
    );
    newShortcutList.push(
      new KeyShortcut(
        'zen-compact-mode-show-toolbar',
        'T',
        '',
        ZEN_COMPACT_MODE_SHORTCUTS_GROUP,
        KeyShortcutModifiers.fromObject({ accel: true, alt: true }),
        'code:gZenCompactModeManager.toggleToolbar()',
        'zen-compact-mode-shortcut-show-toolbar'
      )
    );

    // Workspace's keyset
    for (let i = 10; i > 0; i--) {
      newShortcutList.push(
        new KeyShortcut(
          `zen-workspace-switch-${i}`,
          '',
          '',
          ZEN_WORKSPACE_SHORTCUTS_GROUP,
          KeyShortcutModifiers.fromObject({}),
          `code:ZenWorkspaces.shortcutSwitchTo(${i - 1})`,
          `zen-workspace-shortcut-switch-${i}`
        )
      );
    }
    newShortcutList.push(
      new KeyShortcut(
        'zen-workspace-forward',
        'E',
        '',
        ZEN_WORKSPACE_SHORTCUTS_GROUP,
        KeyShortcutModifiers.fromObject({ accel: true, alt: true }),
        'code:ZenWorkspaces.changeWorkspaceShortcut()',
        'zen-workspace-shortcut-forward'
      )
    );
    newShortcutList.push(
      new KeyShortcut(
        'zen-workspace-backward',
        'Q',
        '',
        ZEN_WORKSPACE_SHORTCUTS_GROUP,
        KeyShortcutModifiers.fromObject({ accel: true, alt: true }),
        'code:ZenWorkspaces.changeWorkspaceShortcut(-1)',
        'zen-workspace-shortcut-backward'
      )
    );

    // Other keyset
    newShortcutList.push(
      new KeyShortcut(
        'zen-toggle-web-panel',
        'P',
        '',
        ZEN_OTHER_SHORTCUTS_GROUP,
        KeyShortcutModifiers.fromObject({ alt: true }),
        'code:gZenBrowserManagerSidebar.toggle()',
        'zen-web-panel-shortcut-toggle'
      )
    );

    // Split view
    newShortcutList.push(
      new KeyShortcut(
        'zen-split-view-grid',
        'G',
        '',
        ZEN_SPLIT_VIEW_SHORTCUTS_GROUP,
        KeyShortcutModifiers.fromObject({ accel: true, alt: true }),
        "code:gZenViewSplitter.toggleShortcut('grid')",
        'zen-split-view-shortcut-grid'
      )
    );
    newShortcutList.push(
      new KeyShortcut(
        'zen-split-view-vertical',
        'V',
        '',
        ZEN_SPLIT_VIEW_SHORTCUTS_GROUP,
        KeyShortcutModifiers.fromObject({ accel: true, alt: true }),
        "code:gZenViewSplitter.toggleShortcut('vsep')",
        'zen-split-view-shortcut-vertical'
      )
    );
    newShortcutList.push(
      new KeyShortcut(
        'zen-split-view-horizontal',
        'H',
        '',
        ZEN_SPLIT_VIEW_SHORTCUTS_GROUP,
        KeyShortcutModifiers.fromObject({ accel: true, alt: true }),
        "code:gZenViewSplitter.toggleShortcut('hsep')",
        'zen-split-view-shortcut-horizontal'
      )
    );
    newShortcutList.push(
      new KeyShortcut(
        'zen-split-view-unsplit',
        'U',
        '',
        ZEN_SPLIT_VIEW_SHORTCUTS_GROUP,
        KeyShortcutModifiers.fromObject({ accel: true, alt: true }),
        "code:gZenViewSplitter.toggleShortcut('unsplit')",
        'zen-split-view-shortcut-unsplit'
      )
    );

    return newShortcutList;
  }

  // Make sure to stay in sync with https://searchfox.org/mozilla-central/source/devtools/startup/DevToolsStartup.sys.mjs#879
  static IGNORED_DEVTOOLS_SHORTCUTS = [
    'key_toggleToolboxF12',
    'profilerStartStop',
    'profilerStartStopAlternate',
    'profilerCapture',
    'profilerCaptureAlternate',
    'javascriptTracingToggle',
  ];

  static zenGetDefaultDevToolsShortcuts() {
    let keySet = document.getElementById(ZEN_DEVTOOLS_KEYSET_ID);
    let newShortcutList = [];
    for (let i = keySet.children.length - 1; i >= 0; i--) {
      let key = keySet.children[i];
      if (this.IGNORED_DEVTOOLS_SHORTCUTS.includes(key.id)) {
        continue;
      }
      let parsed = KeyShortcut.parseFromXHTML(key, { group: 'devTools' });
      newShortcutList.push(parsed);
    }

    return newShortcutList;
  }
}

class ZenKeyboardShortcutsVersioner {
  static LATEST_KBS_VERSION = 7;

  constructor() {}

  get version() {
    return Services.prefs.getIntPref('zen.keyboard.shortcuts.version', 0);
  }

  set version(version) {
    Services.prefs.setIntPref('zen.keyboard.shortcuts.version', version);
  }

  getVersionedData(data) {
    return {
      shortcuts: data,
    };
  }

  isVersionUpToDate() {
    return this.version == ZenKeyboardShortcutsVersioner.LATEST_KBS_VERSION;
  }

  isVersionOutdated() {
    return this.version < ZenKeyboardShortcutsVersioner.LATEST_KBS_VERSION;
  }

  migrateIfNeeded(data) {
    if (!data) {
      // Rebuid the shortcuts, just in case
      this.version = 0;
    }

    if (this.isVersionUpToDate()) {
      return data;
    }

    if (this.isVersionOutdated()) {
      const version = this.version;
      console.info(
        'Zen CKS: Migrating shortcuts from version',
        version,
        'to',
        ZenKeyboardShortcutsVersioner.LATEST_KBS_VERSION
      );
      const newData = this.migrate(data, version);
      this.version = ZenKeyboardShortcutsVersioner.LATEST_KBS_VERSION;
      return newData;
    }

    console.error('Unknown keyboar shortcuts version');
    this.version = 0;
    return this.migrateIfNeeded(data);
  }

  migrate(data, version) {
    if (version < 1) {
      // Migrate from 0 to 1
      // Here, we do a complet reset of the shortcuts,
      // since nothing seems to work properly.
      data = ZenKeyboardShortcutsLoader.zenGetDefaultShortcuts();
    }
    if (version < 2) {
      // Migrate from 1 to 2
      // In this new version, we are resolving the conflicts between
      //  shortcuts having keycode and key at the same time.
      // If there's both, we remove the keycodes.
      for (let shortcut of data) {
        if (shortcut.getKeyCode() && shortcut.getKeyName()) {
          shortcut.setNewBinding(shortcut.getKeyName());
        }
      }
      data.push(
        new KeyShortcut(
          'zen-pinned-tab-reset-shortcut',
          '',
          '',
          ZEN_OTHER_SHORTCUTS_GROUP,
          KeyShortcutModifiers.fromObject({}),
          'code:gZenPinnedTabManager.resetPinnedTab(gBrowser.selectedTab)',
          'zen-pinned-tab-shortcut-reset'
        )
      );
    }
    if (version < 3) {
      // Migrate from 2 to 3
      // In this new version, there was this *really* annoying bug. Shortcuts
      //  detection for internal keys was not working properly, so every internal
      //  shortcut was being saved as a user-editable shortcut.
      // This migration will fix this issue.
      const defaultShortcuts = ZenKeyboardShortcutsLoader.zenGetDefaultShortcuts();
      // Get the default shortcut, compare the id and set the internal flag if needed
      for (let shortcut of data) {
        for (let defaultShortcut of defaultShortcuts) {
          if (shortcut.getID() == defaultShortcut.getID()) {
            shortcut._modifyInternalAttribute(defaultShortcut.isInternal());
          }
        }
      }
    }
    if (version < 4) {
      // Migrate from 3 to 4
      // In this new version, we are just removing the 'zen-toggle-sidebar' shortcut
      //  since it's not used anymore.
      data = data.filter((shortcut) => shortcut.getID() != 'zen-toggle-sidebar');
    }
    if (version < 5) {
      // Migrate from 4 to 5
      // Here, we are adding the 'zen-toggle-sidebar' shortcut back, but with a new action
      data.push(
        new KeyShortcut(
          'zen-toggle-sidebar',
          'B',
          '',
          ZEN_OTHER_SHORTCUTS_GROUP,
          KeyShortcutModifiers.fromObject({ alt: true }),
          'code:gZenVerticalTabsManager.toggleExpand()',
          'zen-sidebar-shortcut-toggle'
        )
      );
    }
    if (version < 6) {
      // Migrate from 5 to 6
      // In this new version, we add the "Copy URL" shortcut to the default shortcuts
      data.push(
        new KeyShortcut(
          'zen-copy-url',
          'C',
          '',
          ZEN_OTHER_SHORTCUTS_GROUP,
          KeyShortcutModifiers.fromObject({ accel: true, shift: true }),
          'code:gZenCommonActions.copyCurrentURLToClipboard()',
          'zen-text-action-copy-url-shortcut'
        )
      );
    }
    if (version < 7) {
      // Migrate from 6 to 7
      // In this new version, we add the devtools shortcuts
      const listener = (event) => {
        event.stopPropagation();

        const devToolsShortcuts = ZenKeyboardShortcutsLoader.zenGetDefaultDevToolsShortcuts();
        gZenKeyboardShortcutsManager.updatedDefaultDevtoolsShortcuts(devToolsShortcuts);

        window.removeEventListener('zen-devtools-keyset-added', listener);
      };

      // We need to load after an event because the devtools keyset is not in the DOM yet
      // and we need to wait for it to be added.
      gZenKeyboardShortcutsManager._hasToLoadDefaultDevtools = true;
      window.addEventListener('zen-devtools-keyset-added', listener);
    }
    return data;
  }
}

var gZenKeyboardShortcutsManager = {
  loader: new ZenKeyboardShortcutsLoader(),
  _hasToLoadDevtools: false,

  beforeInit() {
    if (!this.inBrowserView) {
      return;
    }
    // Create the main keyset before calling the async init function,
    // This is because other browser-sets needs this element and the JS event
    //  handled wont wait for the async function to finish.
    void this.getZenKeyset();

    this._hasCleared = Services.prefs.getBoolPref('zen.keyboard.shortcuts.disable-mainkeyset-clear', false);
    window.addEventListener('zen-devtools-keyset-added', this._hasAddedDevtoolShortcuts.bind(this));

    this.init();
  },

  async init() {
    if (this.inBrowserView) {
      const loadedShortcuts = await this._loadSaved();

      this._currentShortcutList = this.versioner.migrateIfNeeded(loadedShortcuts);
      this._applyShortcuts();

      await this._saveShortcuts();

      console.info('Zen CKS: Initialized');
    }
  },

  get inBrowserView() {
    return window.location.href == 'chrome://browser/content/browser.xhtml';
  },

  async _loadSaved() {
    var innerLoad = async () => {
      let data = await this.loader.load();
      if (!data || data.length == 0) {
        return null;
      }

      try {
        return KeyShortcut.parseFromSaved(data);
      } catch (e) {
        console.error('Zen CKS: Error parsing saved shortcuts. Resetting to defaults...', e);
        gNotificationBox.appendNotification(
          'zen-shortcuts-corrupted',
          {
            label: { 'l10n-id': 'zen-shortcuts-corrupted' },
            image: 'chrome://browser/skin/notification-icons/persistent-storage-blocked.svg',
            priority: gNotificationBox.PRIORITY_WARNING_HIGH,
          },
          []
        );
        return null;
      }
    };

    const loadedShortcuts = await innerLoad();
    this.versioner = new ZenKeyboardShortcutsVersioner(loadedShortcuts);
    return loadedShortcuts;
  },

  getZenKeyset(browser = window) {
    if (!browser.gZenKeyboardShortcutsManager._zenKeyset) {
      const existingKeyset = browser.document.getElementById(ZEN_KEYSET_ID);
      if (existingKeyset) {
        browser.gZenKeyboardShortcutsManager._zenKeyset = existingKeyset;
        return browser.gZenKeyboardShortcutsManager._zenKeyset;
      }

      throw new Error('Zen keyset not found');
    }
    return browser.gZenKeyboardShortcutsManager._zenKeyset;
  },

  getZenDevtoolsKeyset() {
    // note: we use `this` here because we are in the context of the browser
    if (!this._zenDevtoolsKeyset) {
      const id = `zen-${ZEN_DEVTOOLS_KEYSET_ID}`;
      const existingKeyset = document.getElementById(id);
      if (existingKeyset) {
        this._zenDevtoolsKeyset = existingKeyset;
        return existingKeyset;
      }

      this._zenDevtoolsKeyset = document.createXULElement('keyset');
      this._zenDevtoolsKeyset.id = id;

      const mainKeyset = document.getElementById(ZEN_DEVTOOLS_KEYSET_ID);
      mainKeyset.before(this._zenDevtoolsKeyset);
    }
    return this._zenDevtoolsKeyset;
  },

  clearMainKeyset(element) {
    if (this._hasCleared) {
      return;
    }
    this._hasCleared = true;
    const children = element.children;
    for (let i = children.length - 1; i >= 0; i--) {
      const key = children[i];
      if (key.getAttribute('internal') == 'true') {
        continue;
      }
      key.remove();
    }

    // Restore the keyset, https://searchfox.org/mozilla-central/rev/a59018f9ff34170810b43e12bf6f09a1512de7ab/dom/events/GlobalKeyListener.cpp#478
    const parent = element.parentElement;
    element.remove();
    parent.prepend(element);
  },

  async updatedDefaultDevtoolsShortcuts(shortcuts) {
    this._hasToLoadDefaultDevtools = false;
    this._currentShortcutList = this._currentShortcutList.concat(shortcuts);
    await this._saveShortcuts();
    this._hasAddedDevtoolShortcuts();
  },

  _hasAddedDevtoolShortcuts() {
    if (this._hasToLoadDevtools || this._hasToLoadDefaultDevtools) {
      return;
    }
    this._hasToLoadDevtools = true;
    this.triggerShortcutRebuild();
  },

  _applyShortcuts() {
    for (const browser of ZenMultiWindowFeature.browsers) {
      let mainKeyset = browser.document.getElementById(ZEN_MAIN_KEYSET_ID);
      if (!mainKeyset) {
        throw new Error('Main keyset not found');
      }
      browser.gZenKeyboardShortcutsManager.clearMainKeyset(mainKeyset);

      const keyset = this.getZenKeyset(browser);
      keyset.innerHTML = '';

      // We dont check this anymore since we are skiping internal keys
      //if (mainKeyset.children.length > 0) {
      //  throw new Error('Child list not empty');
      //}

      for (let key of this._currentShortcutList) {
        if (key.isInternal()) {
          continue;
        }
        let child = key.toXHTMLElement(browser);
        keyset.appendChild(child);
      }

      this._applyDevtoolsShortcuts(browser);
      mainKeyset.after(keyset);
    }
  },

  _applyDevtoolsShortcuts(browser) {
    if (!browser.gZenKeyboardShortcutsManager?._hasToLoadDevtools) {
      return;
    }
    let devtoolsKeyset = browser.gZenKeyboardShortcutsManager.getZenDevtoolsKeyset(browser);
    for (let key of this._currentShortcutList) {
      if (key.getGroup() != 'devTools') {
        continue;
      }
      if (ZenKeyboardShortcutsLoader.IGNORED_DEVTOOLS_SHORTCUTS.includes(key.getID())) {
        continue;
      }
      const originalKey = browser.document.getElementById(key.getID());
      // We do not want to remove and create a new key in these cases,
      // because it will lose the event listeners.
      key.replaceWithChild(originalKey);
      // Move the key to the main keyset if it's not there, this is because
      //  changing modifiers will not work if they are under the devtools keyset
      //  for some really weird reason.
      if (originalKey.parentElement.id === ZEN_DEVTOOLS_KEYSET_ID) {
        devtoolsKeyset.prepend(originalKey);
      }
    }

    const originalDevKeyset = browser.document.getElementById(ZEN_DEVTOOLS_KEYSET_ID);
    originalDevKeyset.after(devtoolsKeyset);
  },

  async resetAllShortcuts() {
    await this.loader.remove();
    Services.prefs.clearUserPref('zen.keyboard.shortcuts.version');
  },

  async _saveShortcuts() {
    let json = [];
    for (shortcut of this._currentShortcutList) {
      json.push(shortcut.toJSONForm());
    }

    await this.loader.save(this.versioner.getVersionedData(json));
  },

  triggerShortcutRebuild() {
    this._applyShortcuts();
  },

  async setShortcut(action, shortcut, modifiers) {
    if (!action) {
      throw new Error('Action cannot be null');
    }

    // Unsetting shortcut
    for (let targetShortcut of this._currentShortcutList) {
      if (targetShortcut.getID() != action) {
        continue;
      }
      if (!shortcut && !modifiers) {
        targetShortcut.clearKeybind();
      } else {
        targetShortcut.setNewBinding(shortcut);
        targetShortcut.setModifiers(modifiers);
      }
    }

    await this._saveShortcuts();
    this.triggerShortcutRebuild();
  },

  async getModifiableShortcuts() {
    let rv = [];

    if (!this._currentShortcutList) {
      this._currentShortcutList = await this._loadSaved();
    }

    for (let shortcut of this._currentShortcutList) {
      if (shortcut.isUserEditable()) {
        rv.push(shortcut);
      }
    }

    return rv;
  },

  checkForConflicts(shortcut, modifiers, id) {
    const realShortcut = shortcut.toLowerCase();
    for (let targetShortcut of this._currentShortcutList) {
      if (targetShortcut.getID() == id) {
        continue;
      }

      if (targetShortcut.getModifiers().equals(modifiers) && targetShortcut.getKeyNameOrCode()?.toLowerCase() == realShortcut) {
        return true;
      }
    }

    return false;
  },
};

document.addEventListener(
  'MozBeforeInitialXULLayout',
  () => {
    if (Services.prefs.getBoolPref('zen.keyboard.shortcuts.enabled', false)) {
      gZenKeyboardShortcutsManager.beforeInit();
    }
  },
  { once: true }
);
