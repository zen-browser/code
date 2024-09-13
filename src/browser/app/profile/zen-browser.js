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

// Theme
pref('toolkit.legacyUserProfileCustomizations.stylesheets', true);
pref('browser.compactmode.show', true);

pref('browser.newtabpage.activity-stream.newtabWallpapers.enabled', true);
pref('browser.newtabpage.activity-stream.newtabWallpapers.v2.enabled', true);
pref('browser.translations.newSettingsUI.enable', true);

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

pref("browser.tabs.loadBookmarksInTabs", true);
pref('browser.toolbars.bookmarks.visibility', 'never');

// Enable Do Not Track and GPC by default.
pref("privacy.donottrackheader.enabled", true);
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
pref('zen.theme.accent-color', "#aac7ff");
pref('zen.theme.border-radius', 10); // In pixels
pref('zen.theme.content-element-separation', 4); // In pixels
pref('zen.theme.toolbar-themed', true);
pref('zen.theme.pill-button', false);
pref('zen.view.compact', false);
pref('zen.view.compact.hide-toolbar', false);

pref('zen.view.compact.toolbar-flash-popup', true);
pref('zen.view.compact.toolbar-flash-popup.duration', 800);

pref('zen.view.sidebar-height-throttle', 500); // in ms
pref('zen.view.sidebar-expanded', false);
pref('zen.view.sidebar-expanded.on-hover', false);
pref('zen.view.sidebar-expanded.show-button', true);
pref('zen.view.sidebar-expanded.max-width', 400);

pref('zen.view.sidebar-collapsed.hide-mute-button', true);

pref('zen.keyboard.shortcuts.enabled', true);
pref('zen.keyboard.shortcuts', ""); // Empty string means default shortcuts
pref('zen.keyboard.shortcuts.disable-firefox', false);
pref('zen.tabs.dim-pending', true);
pref('zen.themes.updated-value-observer', false);
pref('zen.themes.tabs.legacy-location', false);

// Pref to enable the new profiles (TODO: Check this out!)
//pref("browser.profiles.enabled", true);

// Zen Sidebar
pref('zen.sidebar.data', "{\"data\":\n {\"p1\":{\n   \"url\":\"https://www.wikipedia.org/\"\n  },\n\"p2\":{\n   \"url\":\"https://m.twitter.com/\",\n\"ua\": true\n  },\n\"p3\": {\n   \"url\": \"https://www.youtube.com/\",\n\"ua\": true\n},\n\"p4\": {\n   \"url\": \"https://translate.google.com/\",\n\"ua\": true\n},\n\"p5\": {\n   \"url\": \"https://todoist.com/\",\n\"ua\": true\n}},\n\"index\":[\"p1\",\"p2\",\"p3\",\"p4\",\"p5\"]}");
pref('zen.sidebar.enabled', true);
pref('zen.sidebar.close-on-blur', true);

// Zen Split View
pref('zen.splitView.working', false);

// Zen Workspaces
pref('zen.workspaces.enabled', true);
pref('zen.workspaces.hide-default-container-indicator', true);
pref('zen.workspaces.icons', '["🌐", "📁", "📎", "📝", "📅", "📊"]');

// Zen Watermark
pref('zen.watermark.enabled', true, sticky);

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
// pref('network.proxy.type', 0);
// pref('network.trr.mode', 5);

pref('xpinstall.signatures.required', false);

// Experimental Zen Features
// Strategy to use for bytecode cache (Thanks https://github.com/gunir)
pref('dom.script_loader.bytecode_cache.strategy', 2);

// Font rendering, not for MacOSX and Linux
#ifndef XP_UNIX
#ifndef XP_MACOSX
pref("gfx.font_rendering.directwrite.bold_simulation", 2);
pref("gfx.font_rendering.cleartype_params.enhanced_contrast", 25);
pref("gfx.font_rendering.cleartype_params.force_gdi_classic_for_families", "");
#endif
#endif

// Enable private suggestions
pref('browser.search.suggest.enabled', true);
pref('browser.search.suggest.enabled.private', true);

pref("extensions.enabledScopes", 5); // [HIDDEN PREF]

// Enable GPU by default
pref('gfx.webrender.all', true);
pref('layers.acceleration.force-enabled', true);
pref('media.ffmpeg.vaapi.enabled', true);

// Enable JXL support
pref('image.jxl.enabled', true);

#if defined(XP_WIN)
  pref("dom.ipc.processPriorityManager.backgroundUsesEcoQoS", false);
#endif

// Enable experimental settings page (Usef for Zen Labs)
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

pref("media.hardware-video-decoding.enabled", true);
pref("gfx.canvas.accelerated", true);