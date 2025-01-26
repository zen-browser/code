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

#ifdef XP_WIN
pref("browser.privateWindowSeparation.enabled", false);
#endif

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
pref('browser.urlbar.suggest.calculator', true);

// new tab page
pref('browser.newtabpage.activity-stream.feeds.topsites', false);
pref('browser.newtabpage.activity-stream.feeds.section.topstories', false);
pref("browser.topsites.contile.enabled", true);

// Pdf
pref('browser.download.open_pdf_attachments_inline', true);
pref('pdfjs.enableHighlightEditor', true);
pref('pdfjs.enableHighlightFloatingButton', true);

pref("alerts.showFavicons", true);

// Toolbars
pref("browser.tabs.closeWindowWithLastTab", false);
pref("browser.tabs.loadBookmarksInTabs", false);
pref('browser.toolbars.bookmarks.visibility', 'never');
pref("browser.bookmarks.openInTabClosesMenu", false);
pref("browser.menu.showViewImageInfo", true);
pref("findbar.highlightAll", true);
pref("layout.word_select.eat_space_to_next_word", false);

// Enable Do Not Track and GPC by default.
pref("privacy.donottrackheader.enabled", false);
pref("privacy.globalprivacycontrol.enabled", true);

pref("app.update.checkInstallTime.days", 6);

// CUSTOM ZEN PREFS

pref('zen.welcome-screen.enabled', true, sticky);
pref('zen.welcome-screen.seen', false);

pref('zen.tabs.vertical', true);
pref('zen.tabs.vertical.right-side', false);
pref('zen.theme.accent-color', "#ffb787");
pref('zen.theme.content-element-separation', 6); // In pixels
pref('zen.theme.pill-button', false);
pref('zen.theme.gradient', true);
pref('zen.theme.essentials-favicon-bg', false);

pref('zen.tabs.show-newtab-vertical', true);
pref('zen.view.show-newtab-button-border-top', true);
pref('zen.view.show-newtab-button-top', false);

#ifdef MOZILLA_OFFICIAL
pref('zen.rice.api.url', 'https://share.zen-browser.app', locked);
pref('zen.injections.match-urls', 'https://zen-browser.app/*,https://share.zen-browser.app/*', locked);
#else
pref('zen.rice.api.url', "http://localhost", locked);
pref('zen.injections.match-urls', 'http://localhost/*', locked);
#endif
pref('zen.rice.share.notice.accepted', false);

#ifdef XP_MACOSX
pref('zen.theme.border-radius', 12); // In pixels
#else
#ifdef XP_WIN
pref('zen.theme.border-radius', 12); // In pixels
#else
pref('zen.theme.border-radius', 8); // In pixels
#endif
#endif

pref('zen.theme.color-prefs.use-workspace-colors', true);
pref('zen.theme.color-prefs.amoled', false);
pref('zen.theme.color-prefs.colorful', false);

pref('zen.view.compact.hide-tabbar', true);
pref('zen.view.compact.hide-toolbar', false);
pref('zen.view.compact.toolbar-flash-popup', true);
pref('zen.view.compact.toolbar-flash-popup.duration', 800);
pref('zen.view.compact.toolbar-hide-after-hover.duration', 1000);
pref('zen.view.compact.color-toolbar', true);
pref('zen.view.compact.color-sidebar', true);
pref('zen.view.compact.animate-sidebar', true);

pref('zen.urlbar.behavior', 'floating-on-type'); // default, floating-on-type, float

#ifdef XP_MACOSX
// Disable for macos in the meantime until @HarryHeres finds a solution for hight DPI screens
pref('zen.view.experimental-rounded-view', false);
#else
pref('zen.view.experimental-rounded-view', true);
#endif

// Glance
pref('zen.glance.enabled', true);
pref('zen.glance.hold-duration', 300); // in ms
pref('zen.glance.open-essential-external-links', true);
pref('zen.glance.activation-method', 'alt'); // ctrl, alt, shift, none, hold

pref('zen.view.sidebar-height-throttle', 200); // in ms
pref('zen.view.sidebar-expanded.max-width', 500);

#ifdef XP_MACOSX
pref('zen.view.mac.show-three-dot-menu', false);
#endif
pref('zen.view.show-bottom-border', false);
pref('zen.view.use-single-toolbar', true);
pref('zen.view.sidebar-expanded', true);
pref('zen.view.sidebar-collapsed.hide-mute-button', true);
pref('zen.view.experimental-force-window-controls-left', false);

#ifdef XP_MACOSX
pref('zen.view.grey-out-inactive-windows', false);
#else
pref('zen.view.grey-out-inactive-windows', true);
#endif

pref('zen.view.hide-window-controls', true);
pref('zen.view.experimental-no-window-controls', false);

pref('zen.tabs.dim-pending', true);
pref('zen.tabs.newtab-on-middle-click', true);

pref('zen.keyboard.shortcuts.enabled', true);
pref('zen.keyboard.shortcuts.version', 0); // Empty string means default shortcuts
pref('zen.keyboard.shortcuts.disable-mainkeyset-clear', false); // for debugging

pref('zen.themes.updated-value-observer', false);

pref('zen.tab-unloader.enabled', true);
pref('zen.tab-unloader.timeout-minutes', 40);
pref('zen.tab-unloader.excluded-urls', "example.com,example.org");

pref('zen.pinned-tab-manager.debug', false);
pref('zen.pinned-tab-manager.restore-pinned-tabs-to-pinned-url', false);
pref('zen.pinned-tab-manager.close-shortcut-behavior', 'switch');

// Pref to enable the new profiles (TODO: Check this out!)
//pref("browser.profiles.enabled", true);

// Zen webpanels (calling it sidebar due to legacy reasons)
pref('zen.sidebar.data', "{\"data\":\n {\"p1\":{\n   \"url\":\"https://www.wikipedia.org/\"\n  },\n\"p2\":{\n   \"url\":\"https://m.twitter.com/\",\n\"ua\": true\n  },\n\"p3\": {\n   \"url\": \"https://www.youtube.com/\",\n\"ua\": true\n},\n\"p4\": {\n   \"url\": \"https://translate.google.com/\",\n\"ua\": true\n},\n\"p5\": {\n   \"url\": \"https://todoist.com/\",\n\"ua\": true\n}},\n\"index\":[\"p1\",\"p2\",\"p3\",\"p4\",\"p5\"]}");
pref('zen.sidebar.enabled', true);
pref('zen.sidebar.close-on-blur', true);
pref('zen.sidebar.max-webpanels', 8);

// Zen Split View
pref('zen.splitView.working', false);
pref('zen.splitView.min-resize-width', 7);
pref('zen.splitView.change-on-hover', false);
pref('zen.splitView.rearrange-hover-size', 24);

// Startup flags
pref('zen.startup.smooth-scroll-in-tabs', true);

// Zen Workspaces
pref('zen.workspaces.disabled_for_testing', false);
pref('zen.workspaces.hide-deactivated-workspaces', false);
pref('zen.workspaces.hide-default-container-indicator', true);
pref('zen.workspaces.individual-pinned-tabs', true);
pref('zen.workspaces.show-icon-strip', true);
pref('zen.workspaces.force-container-workspace', false);
pref('zen.workspaces.open-new-tab-if-last-unpinned-tab-is-closed', true);
pref('zen.workspaces.show-workspace-indicator', true);
pref('zen.workspaces.swipe-actions', true);
pref('zen.workspaces.wrap-around-navigation', true);
pref('zen.workspaces.natural-scroll', false);
pref('zen.workspaces.scroll-modifier-key','ctrl'); // can be ctrl, alt, shift, or a meta key
pref('services.sync.engine.workspaces', false);
pref('zen.workspaces.container-specific-essentials-enabled', false);

// Essentials
pref('zen.essentials.enabled', true);

// Zen Watermark
#ifdef MOZILLA_OFFICIAL
pref('zen.watermark.enabled', true, sticky);
#else
pref('zen.watermark.enabled', false, sticky);
#endif

// Privacy
pref('dom.private-attribution.submission.enabled', false);
pref('dom.security.https_only_mode', true);

// Enable EME
pref('media.eme.enabled', true);

// Crash reports
pref("breakpad.reportURL", "");
pref("browser.tabs.crashReporting.sendReport", false);
pref("browser.crashReports.unsubmittedCheck.autoSubmit2", false);

// TLS / SSL
pref("security.ssl.treat_unsafe_negotiation_as_broken", true);
pref("browser.xul.error_pages.expert_bad_cert", true);
pref("security.tls.enable_0rtt_data", false);
pref("network.http.http3.enable_0rtt", false);

// Network
pref("network.http.max-urgent-start-excessive-connections-per-host", 5);
pref("network.dnsCacheExpiration", 3600);
pref("network.http.max-persistent-connections-per-proxy", 48); // default=32
pref("network.websocket.max-connections", 400); // default=200
pref("network.ssl_tokens_cache_capacity", 32768);

// Enable importers for other browsers
pref('browser.migrate.vivaldi.enabled', true);
pref('browser.migrate.opera-gx.enabled', true);
pref('browser.migrate.opera.enabled', true);

// DNS
// pref('network.trr.mode', 5);

// security: They must enable this themselves, to avoid people downloading malware
pref('xpinstall.signatures.required', false);

// Experimental Zen Features
// Strategy to use for bytecode cache (Thanks https://github.com/gunir)
pref('dom.script_loader.bytecode_cache.strategy', 2);
pref("dom.text_fragments.enabled", true);

pref("layout.css.grid-template-masonry-value.enabled", true);
pref("dom.security.sanitizer.enabled", true);

// Pocket
pref("extensions.pocket.enabled", false);

// MIXED CONTENT + CROSS-SITE
pref("pdfjs.enableScripting", false);
pref("extensions.postDownloadThirdPartyPrompt", false);

// Downloads
pref("browser.download.always_ask_before_handling_new_types", true);
pref("browser.download.manager.addToRecentDocs", false);

// Tracking protection
pref("urlclassifier.trackingSkipURLs", "*.reddit.com, *.x.com, *.twimg.com, *.tiktok.com");
pref("urlclassifier.features.socialtracking.skipURLs", "*.instagram.com, *.x.com, *.twimg.com");
pref("network.cookie.sameSite.noneRequiresSecure", true);
pref("browser.helperApps.deleteTempFileOnExit", true);
pref("browser.uitour.enabled", false);

// Disable cache for private browsing
pref("browser.privatebrowsing.forceMediaMemoryCache", true);

// Enable private suggestions
pref('browser.search.suggest.enabled', true);
pref('browser.search.suggest.enabled.private', true);

pref("extensions.enabledScopes", 5); // [HIDDEN PREF]

// Media codecs
pref('image.jxl.enabled', true, locked);
pref("svg.context-properties.content.enabled", true);
pref("image.avif.enabled", true, locked);

// Smooth scrolling
#ifndef XP_MACOSX
pref("apz.overscroll.enabled", true);
pref("general.smoothScroll", true);
pref("general.smoothScroll.msdPhysics.enabled", true);
pref("general.smoothScroll.currentVelocityWeighting", "0.15");
pref("general.smoothScroll.stopDecelerationWeighting", "0.6");
pref("mousewheel.min_line_scroll_amount", 10);
pref("general.smoothScroll.mouseWheel.durationMinMS", 80);
pref("general.smoothScroll.msdPhysics.continuousMotionMaxDeltaMS", 12);
pref("general.smoothScroll.msdPhysics.motionBeginSpringConstant", 600);
pref("general.smoothScroll.msdPhysics.regularSpringConstant", 650);
pref("general.smoothScroll.msdPhysics.slowdownMinDeltaMS", 25);
pref("general.smoothScroll.msdPhysics.slowdownSpringConstant", 250);
pref("mousewheel.default.delta_multiplier_y", 200);
#endif

#if defined(XP_WIN)
  pref("dom.ipc.processPriorityManager.backgroundUsesEcoQoS", false);
#endif

pref('browser.sessionstore.restore_pinned_tabs_on_demand', true);
pref('browser.newtabpage.activity-stream.system.showWeather', true);

// Enable experimental settings page (Used for Zen Labs)
pref('browser.preferences.experimental', true);

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
// pref('gfx.webrender.all', true);

// VAAPI/FFMPEG is Linux only
#ifdef MOZ_WIDGET_GTK
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

// Urlbar and autocomplete
pref("browser.urlbar.maxRichResults", 6);
pref("browser.urlbar.trimHttps", true);
pref("browser.search.separatePrivateDefault.ui.enabled", true);
pref("browser.urlbar.update2.engineAliasRefresh", true);
pref("browser.search.suggest.enabled", false);
pref("browser.urlbar.quicksuggest.enabled", false);
pref("browser.urlbar.suggest.quicksuggest.sponsored", false);
pref("browser.urlbar.suggest.quicksuggest.nonsponsored", false);
pref("browser.urlbar.groupLabels.enabled", false);
pref("browser.formfill.enable", false);
pref("security.insecure_connection_text.enabled", true);
pref("security.insecure_connection_text.pbmode.enabled", true);
pref("network.IDN_show_punycode", true);

// Telemetry
pref("datareporting.policy.dataSubmissionEnabled", false, locked);
pref("datareporting.healthreport.uploadEnabled", false, locked);
pref("toolkit.telemetry.unified", false, locked);
pref("toolkit.telemetry.enabled", false, locked);
pref("toolkit.telemetry.server", "data:,", locked);
pref("toolkit.telemetry.archive.enabled", false, locked);
pref("toolkit.telemetry.newProfilePing.enabled", false, locked);
pref("toolkit.telemetry.shutdownPingSender.enabled", false, locked);
pref("toolkit.telemetry.updatePing.enabled", false, locked);
pref("toolkit.telemetry.bhrPing.enabled", false, locked);
pref("toolkit.telemetry.firstShutdownPing.enabled", false, locked);
pref("toolkit.telemetry.coverage.opt-out", true, locked);
pref("toolkit.coverage.opt-out", true, locked);
pref("toolkit.coverage.endpoint.base", "", locked);
pref("browser.newtabpage.activity-stream.feeds.telemetry", false, locked);
pref("browser.newtabpage.activity-stream.telemetry", false, locked);
pref("browser.ping-centre.telemetry", false);
pref("browser.attribution.enabled", false);
pref("toolkit.telemetry.pioneer-new-studies-available", false);
pref("app.shield.optoutstudies.enabled", false, locked);
pref("app.normandy.enabled", false, locked);
pref("app.normandy.api_url", "", locked);

// Fullscreen notice
pref("full-screen-api.transition-duration.enter", "0 0");
pref("full-screen-api.transition-duration.leave", "0 0");
pref("full-screen-api.warning.delay", -1);
pref("full-screen-api.warning.timeout", 0);

// Common UI changes
pref("browser.privatebrowsing.vpnpromourl", "", locked);
pref("extensions.getAddons.showPane", false);
pref("extensions.htmlaboutaddons.recommendations.enabled", false);
pref("browser.discovery.enabled", false);
pref("browser.newtabpage.activity-stream.asrouter.userprefs.cfr.addons", false);
pref("browser.newtabpage.activity-stream.asrouter.userprefs.cfr.features", false);
pref("browser.preferences.moreFromMozilla", false, locked);
pref("browser.aboutwelcome.enabled", false);

// ---- Experimental settings to try make zen faster
pref("gfx.canvas.accelerated.cache-items", 32768);
pref("gfx.canvas.accelerated.cache-size", 4096);
pref("gfx.content.skia-font-cache-size", 80);

pref("media.memory_cache_max_size", 1048576);
pref("media.cache_readahead_limit", 9000);
pref("media.cache_resume_threshold", 3600);
pref("media.memory_caches_combined_limit_kb", 2560000);

pref("image.mem.decode_bytes_at_a_time", 32768);

// Enable GPU by default
pref("gfx.canvas.accelerated", true);
pref("media.hardware-video-decoding.enabled", true);
pref("layers.gpu-process.enabled", true);
