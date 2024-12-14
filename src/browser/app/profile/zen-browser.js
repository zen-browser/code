// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

#ifdef XP_UNIX
  #ifndef XP_MACOSX
    #define UNIX_BUT_NOT_MAC
  #endif
#endif

pref("browser.tabs.cardPreview.enabled", true);
pref("browser.tabs.hoverPreview.enabled", true);
pref("browser.tabs.cardPreview.delayMs", 100);

#ifdef MOZ_UPDATE_CHANNEL
pref("devtools.debugger.prompt-connection", true);
#endif

// Dont download the multilingual dictionary
pref("intl.multilingual.downloadEnabled", false);

// Restore session on startup
pref("browser.startup.page", 3);

// Theme
pref('toolkit.legacyUserProfileCustomizations.stylesheets', true);
pref('browser.compactmode.show', true);

pref('browser.newtabpage.activity-stream.newtabWallpapers.enabled', true);
pref('browser.newtabpage.activity-stream.newtabWallpapers.v2.enabled', true);
pref('browser.translations.newSettingsUI.enable', true);

pref('privacy.userContext.enabled', true);
pref('privacy.userContext.ui.enabled', true);

pref("browser.urlbar.trimHttps", true);
pref("browser.urlbar.untrimOnUserInteraction.featureGate", true);

// Url bar
pref('browser.urlbar.unitConversion.enabled', true);
pref('browser.urlbar.trending.featureGate', false);
pref('browser.urlbar.weather.featureGate', true);
pref('browser.urlbar.quickactions.enabled', true);
pref('browser.urlbar.clipboard.featureGate', true);

// new tab page
pref('browser.newtabpage.activity-stream.feeds.topsites', false);
pref('browser.newtabpage.activity-stream.feeds.section.topstories', false);
pref("browser.topsites.contile.enabled", true);

// Pdf
pref('browser.download.open_pdf_attachments_inline', true);
pref('pdfjs.enableHighlightEditor', true);
pref('pdfjs.enableHighlightFloatingButton', true);

pref("alerts.showFavicons", true);

pref("browser.tabs.loadBookmarksInTabs", false);
pref('browser.toolbars.bookmarks.visibility', 'never');

// Enable Do Not Track and GPC by default.
pref("privacy.donottrackheader.enabled", false);
pref("privacy.globalprivacycontrol.enabled", true);
// Disable more telemetry
pref("toolkit.telemetry.enabled", false);
pref("browser.ping-centre.telemetry", false);
pref("browser.attribution.enabled", false);
pref("toolkit.telemetry.pioneer-new-studies-available", false);

pref("app.update.checkInstallTime.days", 6);

// CUSTOM ZEN PREFS

pref('zen.welcomeScreen.enabled', true);
pref('zen.welcomeScreen.seen', false);

pref('zen.tabs.vertical', true);
pref('zen.tabs.vertical.right-side', false);
pref('zen.theme.accent-color', "#ffb787");
pref('zen.theme.content-element-separation', 6); // In pixels
pref('zen.theme.pill-button', false);
pref('zen.theme.gradient', true);

pref('zen.tabs.show-newtab-vertical', true);
pref('zen.view.show-newtab-button-border-top', true);
pref('zen.view.show-newtab-button-top', false);
pref("zen.tabs.openNewTabByDblclick", true);

#ifdef XP_MACOSX
pref('zen.theme.border-radius', 10); // In pixels
#else
#ifdef XP_WIN
pref('zen.theme.border-radius', 6); // In pixels
#else
pref('zen.theme.border-radius', 8); // In pixels
#endif
#endif

pref('zen.theme.color-prefs.use-workspace-colors', true);
pref('zen.theme.color-prefs.amoled', false);
pref('zen.theme.color-prefs.colorful', false);

pref('zen.view.compact', false);
pref('zen.view.compact.hide-tabbar', true);
pref('zen.view.compact.hide-toolbar', false);
pref('zen.view.compact.toolbar-flash-popup', true);
pref('zen.view.compact.toolbar-flash-popup.duration', 800);
pref('zen.view.compact.toolbar-hide-after-hover.duration', 1000);
pref('zen.view.compact.color-toolbar', true);
pref('zen.view.compact.color-sidebar', true);

pref('zen.glance.enabled', true);
pref('zen.glance.hold-duration', 300); // in ms

pref('zen.glance.activation-method', 'alt'); // ctrl, alt, shift, none, hold

pref('zen.view.sidebar-height-throttle', 200); // in ms
pref('zen.view.sidebar-expanded.max-width', 400);

pref('zen.view.show-bottom-border', false);
pref('zen.view.use-single-toolbar', true);
pref('zen.view.sidebar-expanded', true);
pref('zen.view.sidebar-collapsed.hide-mute-button', true);
pref('zen.view.experimental-force-window-controls-left', false);

#ifndef XP_MACOSX
pref('zen.view.hide-window-controls', true);
#endif

pref('zen.tabs.dim-pending', true);
pref('zen.tabs.newtab-on-middle-click', true);

pref('zen.keyboard.shortcuts.enabled', true);
pref('zen.keyboard.shortcuts.version', 0); // Empty string means default shortcuts
pref('zen.keyboard.shortcuts.disable-mainkeyset-clear', false); // for debugging

pref('zen.themes.updated-value-observer', false);

pref('zen.tab-unloader.enabled', true);
pref('zen.tab-unloader.timeout-minutes', 20);
pref('zen.tab-unloader.excluded-urls', "example.com,example.org");

pref('zen.pinned-tab-manager.restore-pinned-tabs-to-pinned-url', false);
pref('zen.pinned-tab-manager.close-shortcut-behavior', 'switch');

// Pref to enable the new profiles (TODO: Check this out!)
//pref("browser.profiles.enabled", true);

// Zen Sidebar
pref('zen.sidebar.data', "{\"data\":\n {\"p1\":{\n   \"url\":\"https://www.wikipedia.org/\"\n  },\n\"p2\":{\n   \"url\":\"https://m.twitter.com/\",\n\"ua\": true\n  },\n\"p3\": {\n   \"url\": \"https://www.youtube.com/\",\n\"ua\": true\n},\n\"p4\": {\n   \"url\": \"https://translate.google.com/\",\n\"ua\": true\n},\n\"p5\": {\n   \"url\": \"https://todoist.com/\",\n\"ua\": true\n}},\n\"index\":[\"p1\",\"p2\",\"p3\",\"p4\",\"p5\"]}");
pref('zen.sidebar.enabled', true);
pref('zen.sidebar.close-on-blur', true);
pref('zen.sidebar.max-webpanels', 8);

// Zen Split View
pref('zen.splitView.working', false);
pref('zen.splitView.min-resize-width', 7);
pref('zen.splitView.change-on-hover', false);
pref('zen.splitView.rearrange-hover-size', 24);

// Zen Workspaces
pref('zen.workspaces.enabled', true);
pref('zen.workspaces.hide-deactivated-workspaces', false);
pref('zen.workspaces.hide-default-container-indicator', true);
pref('zen.workspaces.individual-pinned-tabs', true);
pref('zen.workspaces.show-icon-strip', true);
pref('zen.workspaces.force-container-workspace', false);
pref('zen.workspaces.open-new-tab-if-last-unpinned-tab-is-closed', true);
pref('zen.workspaces.show-workspace-indicator', true);
pref('zen.workspaces.swipe-actions', true);
pref('zen.workspaces.icons', '["⌚","⌛","⏪","⏫","⏬","⏰","⏳","⚽","⚾","⛄","⛅","⛎","⛔","⛪","⛲","⛳","⛵","⛺","⛽","✅","✊","✋","✨","❌","❎","❓","⭐","⭕","🀄","🃏","🆎","🆑","🆒","🆓","🆔","🆕","🆖","🆗","🆘","🆙","🆚","🈁","🈚","🈯","🈲","🈳","🈴","🈵","🈶","🈸","🈹","🈺","🉐","🉑","🌀","🌁","🌂","🌃","🌄","🌅","🌆","🌇","🌈","🌉","🌊","🌋","🌌","🌍","🌎","🌏","🌐","🌑","🌒","🌓","🌔","🌕","🌖","🌗","🌘","🌙","🌚","🌛","🌜","🌝","🌞","🌟","🌠","🌭","🌮","🌯","🌰","🌱","🌲","🌳","🌴","🌵","🌷","🌸","🌹","🌺","🌻","🌼","🌽","🌾","🌿","🍀","🍁","🍂","🍃","🍄","🍅","🍆","🍇","🍈","🍉","🍊","🍋","🍌","🍍","🍎","🍏","🍐","🍑","🍒","🍓","🍔","🍕","🍖","🍗","🍘","🍙","🍚","🍛","🍜","🍝","🍞","🍟","🍠","🍡","🍢","🍣","🍤","🍥","🍦","🍧","🍨","🍩","🍪","🍫","🍬","🍭","🍮","🍯","🍰","🍱","🍲","🍳","🍴","🍵","🍶","🍷","🍸","🍹","🍺","🍻","🍼","🍾","🍿","🎀","🎁","🎂","🎃","🎄","🎅","🎆","🎇","🎈","🎉","🎊","🎋","🎌","🎍","🎎","🎏","🎐","🎑","🎒","🎓","🎠","🎡","🎢","🎣","🎤","🎥","🎦","🎧","🎨","🎩","🎪","🎫","🎬","🎭","🎮","🎯","🎰","🎱","🎲","🎳","🎴","🎵","🎶","🎷","🎸","🎹","🎺","🎻","🎼","🎽","🎾","🎿","🏀","🏁","🏂","🏃","🏄","🏅","🏆","🏇","🏈","🏉","🏊","🏏","🏐","🏑","🏒","🏓","🏠","🏡","🏢","🏣","🏤","🏥","🏦","🏧","🏨","🏩","🏪","🏫","🏬","🏭","🏮","🏯","🏰","🏴","🏸","🏹","🏺","🏻","🏼","🏽","🏾","🏿","🐀","🐁","🐂","🐃","🐄","🐅","🐆","🐇","🐈","🐉","🐊","🐋","🐌","🐍","🐎","🐏","🐐","🐑","🐒","🐓","🐔","🐕","🐖","🐗","🐘","🐙","🐚","🐛","🐜","🐝","🐞","🐟","🐠","🐡","🐢","🐣","🐤","🐥","🐦","🐧","🐨","🐩","🐪","🐫","🐬","🐭","🐮","🐯","🐰","🐱","🐲","🐳","🐴","🐵","🐶","🐷","🐸","🐹","🐺","🐻","🐼","🐽","🐾","👀","👂","👃","👄","👅","👆","👇","👈","👉","👊","👋","👌","👍","👎","👏","👐","👑","👒","👓","👔","👕","👖","👗","👘","👙","👚","👛","👜","👝","👞","👟","👠","👡","👢","👣","👤","👥","👦","👧","👨","👩","👪","👫","👬","👭","👮","👯","👰","👱","👲","👳","👴","👵","👶","👷","👸","👹","👺","👻","👼","👽","👾","👿","💀","💁","💂","💃","💄","💅","💆","💇","💈","💉","💊","💋","💌","💍","💎","💏","💐","💑","💒","💓","💔","💕","💖","💗","💘","💙","💚","💛","💜","💝","💞","💟","💠","💡","💢","💣","💤","💥","💦","💧","💨","💩","💪","💫","💬","💭","💮","💯","💰","💱","💲","💳","💴","💵","💶","💷","💸","💹","💺","💻","💼","💽","💾","💿","📀","📁","📂","📃","📄","📅","📆","📇","📈","📉","📊","📋","📌","📍","📎","📏","📐","📑","📒","📓","📔","📕","📖","📗","📘","📙","📚","📛","📜","📝","📞","📟","📠","📡","📢","📣","📤","📥","📦","📧","📨","📩","📪","📫","📬","📭","📮","📯","📰","📱","📲","📳","📴","📵","📶","📷","📸","📹","📺","📻","📼","📿","🔀","🔁","🔂","🔃","🔄","🔅","🔆","🔇","🔈","🔉","🔊","🔋","🔌","🔍","🔎","🔏","🔐","🔑","🔒","🔓","🔔","🔕","🔖","🔗","🔘","🔙","🔚","🔛","🔜","🔝","🔞","🔟","🔠","🔡","🔢","🔣","🔤","🔥","🔦","🔧","🔨","🔩","🔪","🔫","🔬","🔭","🔮","🔯","🔰","🔱","🔲","🔳","🔴","🔵","🔶","🔷","🔸","🔹","🔺","🔻","🔼","🔽","🕋","🕌","🕍","🕎","🕐","🕑","🕒","🕓","🕔","🕕","🕖","🕗","🕘","🕙","🕚","🕛","🕜","🕝","🕞","🕟","🕠","🕡","🕢","🕣","🕤","🕥","🕦","🕧","🖕","🖖","🗻","🗼","🗽","🗾","🗿","😀","😁","😂","😃","😄","😅","😆","😇","😈","😉","😊","😋","😌","😍","😎","😏","😐","😑","😒","😓","😔","😕","😖","😗","😘","😙","😚","😛","😜","😝","😞","😟","😠","😡","😢","😣","😤","😥","😦","😧","😨","😩","😪","😫","😬","😭","😮","😯","😰","😱","😲","😳","😴","😵","😶","😷","😸","😹","😺","😻","😼","😽","😾","😿","🙀","🙁","🙂","🙃","🙄","🙅","🙆","🙇","🙈","🙉","🙊","🙋","🙌","🙍","🙎","🙏","🚀","🚁","🚂","🚃","🚄","🚅","🚆","🚇","🚈","🚉","🚊","🚋","🚌","🚍","🚎","🚏","🚐","🚑","🚒","🚓","🚔","🚕","🚖","🚗","🚘","🚙","🚚","🚛","🚜","🚝","🚞","🚟","🚠","🚡","🚢","🚣","🚤","🚥","🚦","🚧","🚨","🚩","🚪","🚫","🚬","🚭","🚮","🚯","🚰","🚱","🚲","🚳","🚴","🚵","🚶","🚷","🚸","🚹","🚺","🚻","🚼","🚽","🚾","🚿","🛀","🛁","🛂","🛃","🛄","🛅","🛌","🛐","🛫","🛬","🤐","🤑","🤒","🤓","🤔","🤕","🤖","🤗","🤘","🦀","🦁","🦂","🦃","🦄","🧀","🇦🇨","🇦🇩","🇦🇪","🇦🇫","🇦🇬","🇦🇮","🇦🇱","🇦🇲","🇦🇴","🇦🇶","🇦🇷","🇦🇸","🇦🇹","🇦🇺","🇦🇼","🇦🇽","🇦🇿","🇧🇦","🇧🇧","🇧🇩","🇧🇪","🇧🇫","🇧🇬","🇧🇭","🇧🇮","🇧🇯","🇧🇱","🇧🇲","🇧🇳","🇧🇴","🇧🇶","🇧🇷","🇧🇸","🇧🇹","🇧🇻","🇧🇼","🇧🇾","🇧🇿","🇨🇦","🇨🇨","🇨🇩","🇨🇫","🇨🇬","🇨🇭","🇨🇮","🇨🇰","🇨🇱","🇨🇲","🇨🇳","🇨🇴","🇨🇵","🇨🇷","🇨🇺","🇨🇻","🇨🇼","🇨🇽","🇨🇾","🇨🇿","🇩🇪","🇩🇬","🇩🇯","🇩🇰","🇩🇲","🇩🇴","🇩🇿","🇪🇦","🇪🇨","🇪🇪","🇪🇬","🇪🇭","🇪🇷","🇪🇸","🇪🇹","🇪🇺","🇫🇮","🇫🇯","🇫🇰","🇫🇲","🇫🇴","🇫🇷","🇬🇦","🇬🇧","🇬🇩","🇬🇪","🇬🇫","🇬🇬","🇬🇭","🇬🇮","🇬🇱","🇬🇲","🇬🇳","🇬🇵","🇬🇶","🇬🇷","🇬🇸","🇬🇹","🇬🇺","🇬🇼","🇬🇾","🇭🇰","🇭🇲","🇭🇳","🇭🇷","🇭🇹","🇭🇺","🇮🇨","🇮🇩","🇮🇪","🇮🇱","🇮🇲","🇮🇳","🇮🇴","🇮🇶","🇮🇷","🇮🇸","🇮🇹","🇯🇪","🇯🇲","🇯🇴","🇯🇵","🇰🇪","🇰🇬","🇰🇭","🇰🇮","🇰🇲","🇰🇳","🇰🇵","🇰🇷","🇰🇼","🇰🇾","🇰🇿","🇱🇦","🇱🇧","🇱🇨","🇱🇮","🇱🇰","🇱🇷","🇱🇸","🇱🇹","🇱🇺","🇱🇻","🇱🇾","🇲🇦","🇲🇨","🇲🇩","🇲🇪","🇲🇫","🇲🇬","🇲🇭","🇲🇰","🇲🇱","🇲🇲","🇲🇳","🇲🇴","🇲🇵","🇲🇶","🇲🇷","🇲🇸","🇲🇹","🇲🇺","🇲🇻","🇲🇼","🇲🇽","🇲🇾","🇲🇿","🇳🇦","🇳🇨","🇳🇪","🇳🇫","🇳🇬","🇳🇮","🇳🇱","🇳🇴","🇳🇵","🇳🇷","🇳🇺","🇳🇿","🇴🇲","🇵🇦","🇵🇪","🇵🇫","🇵🇬","🇵🇭","🇵🇰","🇵🇱","🇵🇲","🇵🇳","🇵🇷","🇵🇸","🇵🇹","🇵🇼","🇵🇾","🇶🇦","🇷🇪","🇷🇴","🇷🇸","🇷🇺","🇷🇼","🇸🇦","🇸🇧","🇸🇨","🇸🇩","🇸🇪","🇸🇬","🇸🇭","🇸🇮","🇸🇯","🇸🇰","🇸🇱","🇸🇲","🇸🇳","🇸🇴","🇸🇷","🇸🇸","🇸🇹","🇸🇻","🇸🇽","🇸🇾","🇸🇿","🇹🇦","🇹🇨","🇹🇩","🇹🇫","🇹🇬","🇹🇭","🇹🇯","🇹🇰","🇹🇱","🇹🇲","🇹🇳","🇹🇴","🇹🇷","🇹🇹","🇹🇻","🇹🇼","🇹🇿","🇺🇦","🇺🇬","🇺🇲","🇺🇸","🇺🇾","🇺🇿","🇻🇦","🇻🇨","🇻🇪","🇻🇬","🇻🇮","🇻🇳","🇻🇺","🇼🇫","🇼🇸","🇽🇰","🇾🇪","🇾🇹","🇿🇦","🇿🇲","🇿🇼"]');
pref('services.sync.prefs.sync.zen.workspaces.icons', true);
pref('services.sync.engine.workspaces', false);
pref('zen.essentials.enabled', true);
pref('zen.workspaces.container-specific-essentials-enabled', false);

// Zen Watermark
#ifdef MOZILLA_OFFICIAL
pref('zen.watermark.enabled', true, sticky);
#else
pref('zen.watermark.enabled', false, sticky);
#endif

// Smooth scrolling
pref('apz.overscroll.enabled', true); // not DEFAULT on Linux
pref('general.smoothScroll', true); // DEFAULT

// Privacy
pref('dom.private-attribution.submission.enabled', false);
pref('dom.security.https_only_mode', true);

pref('media.eme.enabled', true);

// Enable importers for other browsers
pref('browser.migrate.vivaldi.enabled', true);
pref('browser.migrate.opera-gx.enabled', true);
pref('browser.migrate.opera.enabled', true);

// DNS
// pref('network.trr.mode', 5);

// security: They must enable this themselves, to avoid people downloading malware
//pref('xpinstall.signatures.required', false);

// Experimental Zen Features
// Strategy to use for bytecode cache (Thanks https://github.com/gunir)
pref('dom.script_loader.bytecode_cache.strategy', 2);
pref("dom.text_fragments.enabled", true);

// Enable private suggestions
pref('browser.search.suggest.enabled', true);
pref('browser.search.suggest.enabled.private', true);

pref("extensions.enabledScopes", 5); // [HIDDEN PREF]

// Enable JXL support
pref('image.jxl.enabled', true);

#if defined(XP_WIN)
  pref("dom.ipc.processPriorityManager.backgroundUsesEcoQoS", false);
#endif

pref('browser.sessionstore.restore_pinned_tabs_on_demand', true);
pref('browser.newtabpage.activity-stream.system.showWeather', true);

pref("browser.toolbars.bookmarks.visibility", "never");

// Enable experimental settings page (Used for Zen Labs)
pref('browser.preferences.experimental', true);

#include better-fox.js

// Betterfox overrides (Stay below the include directive)

// Jang's personal speedups (Thanks to Jang for these!)

// Prefetching:
pref("network.dns.disablePrefetch", false);
pref("network.prefetch-next", true);
pref("network.predictor.enabled", true);
pref("network.dns.disablePrefetchFromHTTPS", false);
pref("network.predictor.enable-hover-on-ssl", true);
pref("network.http.speculative-parallel-limit", 10);
pref("network.http.rcwn.enabled", false);

// Enable Browser Toolbox, Ctrl+Shift+Alt+I for debugging and modifying UI
pref("devtools.debugger.remote-enabled", false);
pref("devtools.chrome.enabled", true);

// Disable firefox's revamp
pref("sidebar.revamp", false, locked);
pref("sidebar.verticalTabs", false, locked);

// Better Windows theming
pref("widget.non-native-theme.scrollbar.style", 2);
pref("widget.non-native-theme.use-theme-accent", true);

// Expose Letterboxing https://github.com/zen-browser/desktop/issues/475
pref("privacy.resistFingerprinting.letterboxing", false);
pref("privacy.resistFingerprinting.letterboxing.dimensions", "");

// Remove Inspect Accessibity Properties menu
pref("devtools.accessibility.enabled", false);

// Enable GPU by default
//pref('gfx.webrender.all', true);
pref("gfx.canvas.accelerated", true);
pref("media.hardware-video-decoding.enabled", true);
pref("layers.gpu-process.enabled", true);

// VAAPI/FFMPEG is Linux only
#ifdef XP_UNIX
pref('media.ffmpeg.vaapi.enabled', true);
pref('media.ffmpeg.encoder.enabled', true);
#endif

// Fix buffering issues: Youtube, Archive bugzilla.mozilla.org/show_bug.cgi?id=1854077
pref("network.fetchpriority.enabled", true);

// No Proxy should be default, Use system proxy allows antivirus, virus or system proxy to MITM or slowing down Zen
pref("network.proxy.type", 0);

// for the new layout:
pref('browser.download.autohideButton', false);

// Enable transparent background for macos
#ifdef XP_MACOSX
pref('widget.macos.titlebar-blend-mode.behind-window', true);
#endif
