// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
/* You may copy+paste this file and use it as it is.
 *
 * If you make changes to your about:config while the program is running, the
 * changes will be overwritten by the user.js when the application restarts.
 *
 * To make lasting changes to preferences, you will have to edit the user.js.
 */

/****************************************************************************
 * Betterfox                                                                *
 * "Ad meliora"                                                             *
 * version: 130                                                             *
 * url: https://github.com/yokoffing/Betterfox                              *
****************************************************************************/

/****************************************************************************
 * SECTION: FASTFOX                                                         *
****************************************************************************/
/** GENERAL ***/
//pref("content.notify.interval", 100000); // (.10s); alt=500000 (.50s)

/** GFX ***/
pref("gfx.canvas.accelerated.cache-items", 32768);
pref("gfx.canvas.accelerated.cache-size", 4096);
pref("gfx.content.skia-font-cache-size", 80);

/** DISK CACHE ***/
pref("browser.cache.jsbc_compression_level", 3);

/** MEDIA CACHE ***/
pref("media.memory_cache_max_size", 1048576);
pref("media.cache_readahead_limit", 9000);
pref("media.cache_resume_threshold", 3600);
pref("media.memory_caches_combined_limit_kb", 2560000);

/** IMAGE CACHE ***/
pref("image.mem.decode_bytes_at_a_time", 32768);

/** NETWORK ***/
pref("network.http.max-connections", 1800);
pref("network.http.max-persistent-connections-per-server", 10);
pref("network.http.max-urgent-start-excessive-connections-per-host", 5);
pref("network.http.pacing.requests.enabled", false);
pref("network.dnsCacheExpiration", 3600);
pref("network.http.max-persistent-connections-per-proxy", 48); // default=32
pref("network.websocket.max-connections", 400); // default=200
pref("network.ssl_tokens_cache_capacity", 32768);

/** MIXED CONTENT + CROSS-SITE ***/
pref("pdfjs.enableScripting", false);
pref("extensions.postDownloadThirdPartyPrompt", false);

/** EXPERIMENTAL ***/
pref("layout.css.grid-template-masonry-value.enabled", true);
pref("dom.enable_web_task_scheduling", true);
pref("dom.security.sanitizer.enabled", true);

/****************************************************************************
 * SECTION: SECUREFOX                                                       *
****************************************************************************/
/** TRACKING PROTECTION ***/
pref("urlclassifier.trackingSkipURLs", "*.reddit.com, *.twitter.com, *.twimg.com, *.tiktok.com");
pref("urlclassifier.features.socialtracking.skipURLs", "*.instagram.com, *.twitter.com, *.twimg.com");
pref("network.cookie.sameSite.noneRequiresSecure", true);
pref("browser.download.start_downloads_in_tmp_dir", true);
pref("browser.helperApps.deleteTempFileOnExit", true);
pref("browser.uitour.enabled", false);

/** SSL / TLS ***/
pref("security.ssl.treat_unsafe_negotiation_as_broken", true);
pref("browser.xul.error_pages.expert_bad_cert", true);
pref("security.tls.enable_0rtt_data", false);

/** DISK AVOIDANCE ***/
pref("browser.privatebrowsing.forceMediaMemoryCache", true);

/** SHUTDOWN & SANITIZING ***/
pref("privacy.history.custom", true);

/** SEARCH / URL BAR ***/
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

/** CONTAINERS ***/
pref("privacy.userContext.ui.enabled", true);

/** SAFE BROWSING ***/
pref("browser.safebrowsing.downloads.remote.enabled", false);

/** TELEMETRY ***/
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
pref("toolkit.telemetry.hybridContent.enabled", true, locked);
pref("toolkit.coverage.opt-out", true, locked);
pref("toolkit.coverage.endpoint.base", "", locked);
pref("browser.newtabpage.activity-stream.feeds.telemetry", false, locked);
pref("browser.newtabpage.activity-stream.telemetry", false, locked);

/** EXPERIMENTS ***/
pref("app.shield.optoutstudies.enabled", false, locked);
pref("app.normandy.enabled", false, locked);
pref("app.normandy.api_url", "", locked);

/** CRASH REPORTS ***/
pref("breakpad.reportURL", "");
pref("browser.tabs.crashReporting.sendReport", false);
pref("browser.crashReports.unsubmittedCheck.autoSubmit2", false);

/** DETECTION ***/
pref("dom.private-attribution.submission.enabled", false);

/****************************************************************************
 * SECTION: PESKYFOX                                                        *
****************************************************************************/
/** MOZILLA UI ***/
pref("browser.privatebrowsing.vpnpromourl", "", locked);
pref("extensions.getAddons.showPane", false);
pref("extensions.htmlaboutaddons.recommendations.enabled", false);
pref("browser.discovery.enabled", false);
pref("browser.shell.checkDefaultBrowser", false);
pref("browser.newtabpage.activity-stream.asrouter.userprefs.cfr.addons", false);
pref("browser.newtabpage.activity-stream.asrouter.userprefs.cfr.features", false);
pref("browser.preferences.moreFromMozilla", false);
pref("browser.aboutConfig.showWarning", false);
pref("browser.aboutwelcome.enabled", false);

/** THEME ADJUSTMENTS ***/
pref("toolkit.legacyUserProfileCustomizations.stylesheets", true);
pref("browser.compactmode.show", true);
pref("browser.display.focus_ring_on_anything", true);
pref("browser.display.focus_ring_style", 0);
pref("browser.display.focus_ring_width", 0);
pref("layout.css.prefers-color-scheme.content-override", 2);
pref("browser.privateWindowSeparation.enabled", false); // WINDOWS

/** FULLSCREEN NOTICE ***/
pref("full-screen-api.transition-duration.enter", "0 0");
pref("full-screen-api.transition-duration.leave", "0 0");
pref("full-screen-api.warning.delay", -1);
pref("full-screen-api.warning.timeout", 0);

/** URL BAR ***/
pref("browser.urlbar.suggest.calculator", true);
pref("browser.urlbar.unitConversion.enabled", true);
pref("browser.urlbar.trending.featureGate", false);

/** NEW TAB PAGE ***/
pref("browser.newtabpage.activity-stream.feeds.topsites", false);
pref("browser.newtabpage.activity-stream.feeds.section.topstories", false);

/** POCKET ***/
pref("extensions.pocket.enabled", false);

/** DOWNLOADS ***/
pref("browser.download.always_ask_before_handling_new_types", true);
pref("browser.download.manager.addToRecentDocs", false);

/** PDF ***/
pref("browser.download.open_pdf_attachments_inline", true);

/** TAB BEHAVIOR ***/
pref("browser.bookmarks.openInTabClosesMenu", false);
pref("browser.menu.showViewImageInfo", true);
pref("findbar.highlightAll", true);
pref("layout.word_select.eat_space_to_next_word", false);

/****************************************************************************
 * START: MY OVERRIDES                                                      *
****************************************************************************/
// visit https://github.com/yokoffing/Betterfox/wiki/Common-Overrides
// visit https://github.com/yokoffing/Betterfox/wiki/Optional-Hardening
// Enter your personal overrides below this line:

/****************************************************************************
 * SECTION: SMOOTHFOX                                                       *
****************************************************************************/
// visit https://github.com/yokoffing/Betterfox/blob/main/Smoothfox.js
// Enter your scrolling overrides below this line:

/****************************************************************************
 * END: BETTERFOX                                                           *
****************************************************************************/
