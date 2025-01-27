var gZenOperatingSystemCommonUtils = {
  kZenOSToSmallName: {
    WINNT: 'windows',
    Darwin: 'macos',
    Linux: 'linux',
  },

  get currentOperatingSystem() {
    let os = Services.appinfo.OS;
    return this.kZenOSToSmallName[os];
  },
};

class ZenMultiWindowFeature {
  constructor() {}

  static get browsers() {
    return Services.wm.getEnumerator('navigator:browser');
  }

  static get currentBrowser() {
    return Services.wm.getMostRecentWindow('navigator:browser');
  }

  static get isActiveWindow() {
    return ZenMultiWindowFeature.currentBrowser === window;
  }

  windowIsActive(browser) {
    return browser === ZenMultiWindowFeature.currentBrowser;
  }

  async foreachWindowAsActive(callback) {
    if (!ZenMultiWindowFeature.isActiveWindow) {
      return;
    }
    for (const browser of ZenMultiWindowFeature.browsers) {
      try {
        await callback(browser);
      } catch (e) {
        console.error(e);
      }
    }
  }
}

class ZenDOMOperatedFeature {
  constructor() {
    var initBound = this.init.bind(this);
    document.addEventListener('DOMContentLoaded', initBound, { once: true });
  }
}

class ZenPreloadedFeature {
  constructor() {
    var initBound = this.init.bind(this);
    document.addEventListener('MozBeforeInitialXULLayout', initBound, { once: true });
  }
}

var gZenCommonActions = {
  copyCurrentURLToClipboard() {
    const currentUrl = gBrowser.currentURI.spec;
    if (currentUrl) {
      let str = Cc['@mozilla.org/supports-string;1'].createInstance(Ci.nsISupportsString);
      str.data = currentUrl;
      let transferable = Cc['@mozilla.org/widget/transferable;1'].createInstance(Ci.nsITransferable);
      transferable.init(getLoadContext());
      transferable.addDataFlavor('text/plain');
      transferable.setTransferData('text/plain', str);
      Services.clipboard.setData(transferable, null, Ci.nsIClipboard.kGlobalClipboard);
      ConfirmationHint.show(document.getElementById('PanelUI-menu-button'), 'zen-copy-current-url-confirmation');
    }
  },

  throttle(f, delay) {
    let timer = 0;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => f.apply(this, args), delay);
    };
  },
};
