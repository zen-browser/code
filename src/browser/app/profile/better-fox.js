// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

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
 * version: 133                                                             *
 * url: https://github.com/yokoffing/Betterfox                              *
****************************************************************************/

/****************************************************************************
 * SECTION: FASTFOX                                                         *
****************************************************************************/
/** GENERAL ***/
pref("content.notify.interval", 100000);

/** GFX ***/
pref("gfx.canvas.accelerated.cache-items", 4096);
pref("gfx.canvas.accelerated.cache-size", 512);
pref("gfx.content.skia-font-cache-size", 20);

/** DISK CACHE ***/
pref("browser.cache.disk.enable", true);

/** MEDIA CACHE ***/
pref("media.memory_cache_max_size", 65536);
pref("media.cache_readahead_limit", 7200);
pref("media.cache_resume_threshold", 3600);

/** IMAGE CACHE ***/
pref("image.mem.decode_bytes_at_a_time", 32768);

/** NETWORK ***/
pref("network.http.max-connections", 1800);
pref("network.http.max-persistent-connections-per-server", 10);
pref("network.http.max-urgent-start-excessive-connections-per-host", 5);
pref("network.http.pacing.requests.enabled", false);
pref("network.dnsCacheExpiration", 3600);
pref("network.ssl_tokens_cache_capacity", 10240);

/** SPECULATIVE LOADING ***/
pref("network.dns.disablePrefetch", true);
pref("network.dns.disablePrefetchFromHTTPS", true);
pref("network.prefetch-next", false);
pref("network.predictor.enabled", false);
pref("network.predictor.enable-prefetch", false);

/** EXPERIMENTAL ***/
pref("layout.css.grid-template-masonry-value.enabled", true);
pref("dom.enable_web_task_scheduling", true);

/****************************************************************************
 * SECTION: SECUREFOX                                                       *
****************************************************************************/
/** TRACKING PROTECTION ***/
pref("browser.contentblocking.category", "strict");
pref("urlclassifier.trackingSkipURLs", "*.reddit.com, *.twitter.com, *.twimg.com, *.tiktok.com");
pref("urlclassifier.features.socialtracking.skipURLs", "*.instagram.com, *.twitter.com, *.twimg.com");
pref("browser.download.start_downloads_in_tmp_dir", true);
pref("browser.helperApps.deleteTempFileOnExit", true);
pref("browser.uitour.enabled", false);
pref("privacy.globalprivacycontrol.enabled", true);

/** OCSP & CERTS / HPKP ***/
pref("security.OCSP.enabled", 0);
pref("security.remote_settings.crlite_filters.enabled", true);
pref("security.pki.crlite_mode", 2);

/** SSL / TLS ***/
pref("security.ssl.treat_unsafe_negotiation_as_broken", true);
pref("browser.xul.error_pages.expert_bad_cert", true);
pref("security.tls.enable_0rtt_data", false);

/** DISK AVOIDANCE ***/
pref("browser.privatebrowsing.forceMediaMemoryCache", true);
pref("browser.sessionstore.interval", 60000);

/** SHUTDOWN & SANITIZING ***/
pref("browser.privatebrowsing.resetPBM.enabled", true);
pref("privacy.history.custom", true);

/** SEARCH / URL BAR ***/
pref("browser.urlbar.trimHttps", true);
pref("browser.urlbar.untrimOnUserInteraction.featureGate", true);
pref("browser.search.separatePrivateDefault.ui.enabled", true);
pref("browser.urlbar.update2.engineAliasRefresh", true);
pref("browser.search.suggest.enabled", false);
pref("browser.urlbar.quicksuggest.enabled", false);
pref("browser.urlbar.groupLabels.enabled", false);
pref("browser.formfill.enable", false);
pref("security.insecure_connection_text.enabled", true);
pref("security.insecure_connection_text.pbmode.enabled", true);
pref("network.IDN_show_punycode", true);

/** HTTPS-FIRST POLICY ***/
pref("dom.security.https_first", true);

/** PASSWORDS ***/
pref("signon.formlessCapture.enabled", false);
pref("signon.privateBrowsingCapture.enabled", false);
pref("network.auth.subresource-http-auth-allow", 1);
pref("editor.truncate_user_pastes", false);

/** MIXED CONTENT + CROSS-SITE ***/
pref("security.mixed_content.block_display_content", true);
pref("pdfjs.enableScripting", false);

/** EXTENSIONS ***/
pref("extensions.enabledScopes", 5);

/** HEADERS / REFERERS ***/
pref("network.http.referer.XOriginTrimmingPolicy", 2);

/** CONTAINERS ***/
pref("privacy.userContext.ui.enabled", true);

/** SAFE BROWSING ***/
pref("browser.safebrowsing.downloads.remote.enabled", false);

/** MOZILLA ***/
pref("permissions.default.desktop-notification", 2);
pref("permissions.default.geo", 2);
pref("browser.search.update", false);
pref("permissions.manager.defaultsUrl", "");

/** TELEMETRY ***/
pref("datareporting.policy.dataSubmissionEnabled", false);
pref("datareporting.healthreport.uploadEnabled", false);
pref("toolkit.telemetry.unified", false);
pref("toolkit.telemetry.enabled", false);
pref("toolkit.telemetry.server", "data:,");
pref("toolkit.telemetry.archive.enabled", false);
pref("toolkit.telemetry.newProfilePing.enabled", false);
pref("toolkit.telemetry.shutdownPingSender.enabled", false);
pref("toolkit.telemetry.updatePing.enabled", false);
pref("toolkit.telemetry.bhrPing.enabled", false);
pref("toolkit.telemetry.firstShutdownPing.enabled", false);
pref("toolkit.telemetry.coverage.opt-out", true);
pref("toolkit.coverage.opt-out", true);
pref("toolkit.coverage.endpoint.base", "");
pref("browser.newtabpage.activity-stream.feeds.telemetry", false);
pref("browser.newtabpage.activity-stream.telemetry", false);

/** EXPERIMENTS ***/
pref("app.shield.optoutstudies.enabled", false);
pref("app.normandy.enabled", false);
pref("app.normandy.api_url", "");

/** CRASH REPORTS ***/
pref("breakpad.reportURL", "");
pref("browser.tabs.crashReporting.sendReport", false);

/** DETECTION ***/
pref("captivedetect.canonicalURL", "");
pref("network.captive-portal-service.enabled", false);
pref("network.connectivity-service.enabled", false);

/****************************************************************************
 * SECTION: PESKYFOX                                                        *
****************************************************************************/
/** MOZILLA UI ***/
pref("browser.privatebrowsing.vpnpromourl", "");
pref("extensions.getAddons.showPane", false);
pref("extensions.htmlaboutaddons.recommendations.enabled", false);
pref("browser.discovery.enabled", false);
pref("browser.shell.checkDefaultBrowser", false);
pref("browser.newtabpage.activity-stream.asrouter.userprefs.cfr.addons", false);
pref("browser.newtabpage.activity-stream.asrouter.userprefs.cfr.features", false);
pref("browser.preferences.moreFromMozilla", false);
pref("browser.aboutConfig.showWarning", false);
pref("browser.aboutwelcome.enabled", false);
pref("browser.profiles.enabled", true);

/** THEME ADJUSTMENTS ***/
pref("toolkit.legacyUserProfileCustomizations.stylesheets", true);
pref("browser.compactmode.show", true);
pref("browser.privateWindowSeparation.enabled", false); // WINDOWS

/** COOKIE BANNER HANDLING ***/
pref("cookiebanners.service.mode", 1);
pref("cookiebanners.service.mode.privateBrowsing", 1);

/** FULLSCREEN NOTICE ***/
pref("full-screen-api.transition-duration.enter", "0 0");
pref("full-screen-api.transition-duration.leave", "0 0");
pref("full-screen-api.warning.timeout", 0);

/** URL BAR ***/
pref("browser.urlbar.suggest.calculator", true);
pref("browser.urlbar.unitConversion.enabled", true);
pref("browser.urlbar.trending.featureGate", false);

/** NEW TAB PAGE ***/
pref("browser.newtabpage.activity-stream.feeds.topsites", false);
pref("browser.newtabpage.activity-stream.showWeather", false);
pref("browser.newtabpage.activity-stream.feeds.section.topstories", false);

/** POCKET ***/
pref("extensions.pocket.enabled", false);

/** DOWNLOADS ***/
pref("browser.download.manager.addToRecentDocs", false);

/** PDF ***/
pref("browser.download.open_pdf_attachments_inline", true);

/** TAB BEHAVIOR ***/
pref("browser.bookmarks.openInTabClosesMenu", false);
pref("browser.menu.showViewImageInfo", true);
pref("findbar.highlightAll", true);
pref("layout.word_select.eat_space_to_next_word", false);
