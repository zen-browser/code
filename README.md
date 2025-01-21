<img src="./docs/assets/zen-dark.svg" width="100px" align="left">

### `Zen Browser`

[![Downloads](https://img.shields.io/github/downloads/zen-browser/desktop/total.svg)](https://github.com/zen-browser/desktop/releases)
[![Crowdin](https://badges.crowdin.net/zen-browser/localized.svg)](https://crowdin.com/project/zen-browser)
[![Zen Release builds](https://github.com/zen-browser/desktop/actions/workflows/build.yml/badge.svg?branch=stable)](https://github.com/zen-browser/desktop/actions/workflows/build.yml)

✨ Experience tranquillity while browsing the web without people tracking you! Zen is a privacy-focused browser that blocks trackers, ads, and other unwanted content while offering the best browsing experience!

<div flex="true">
  <a href="https://zen-browser.app/download">
    Download
  </a>
  •
  <a href="https://zen-browser.app">
    Website
  </a>
  •
  <a href="https://docs.zen-browser.app">
    Documentation
  </a>
  •
  <a href="https://zen-browser.app/release-notes/latest">
    Release Notes
  </a>
</div>

## 🖥️ Compatibility

Zen is currently built using firefox version `134.0.2`! 🚀

- [`Zen Twilight`](https://zen-browser.app/download?twilight) - Is currently built using firefox version `RC 134.0.2`!
- Check out the latest [release notes](https://zen-browser.app/release-notes)!
- Part of our mission is to keep Zen up-to-date with the latest version of Firefox, so you can enjoy the latest features and security updates!

## 🤝 Contribution

Zen is an open-source project, and we welcome contributions from the community! Please take a look at the [contribution guidelines](./docs/contribute.md) before getting started!

### Issue metrics

We keep track of how many issues are closed at the end of the month in [docs/issue-metrics](./docs/issue-metrics). This is to keep track of how many issues are being closed, because who doesn't like to see progress? 📈

### Versioning

Zen uses [Semantic Versioning](https://semver.org/) for versioning. Meaning, versions are displayed as `a.bc.d` where:

- `a` is the major version
- `b` is the minor version
- `c` is the branch prefix
- `d` is the patch version

### Branches

Zen is divided into 2 main branches. We use `dev` for development and `stable` for stable releases. The `dev` branch is where all the new features are added and where `twilight` builds are generated. The `stable` branch is where the stable releases are generated.

We divide into 2 branches in case there's any really important security update (for example) that needs to be released before the next stable release. This allows us to do patches without releasing unstable versions to the public.

## ⚡ Performance

Zen is built with performance in mind, and we have optimized the browser to be as fast as possible! Checkout the latest [performance benchmarks](https://docs.zen-browser.app/benchmarks)!

## 📥 Installation

### Supported Operating Systems

Zen is available for Linux, macOS, and Windows. You can download the latest version from the official website at [zen-browser.app](https://zen-browser.app/download), or from the [GitHub Releases](https://github.com/zen-browser/desktop/releases) page.

If you dont see your OS listed below, that's because we already have it in our [downloads page](https://zen-browser.app/download)! Make sure to check it out!

#### Windows

##### Winget

```ps
winget install --id Zen-Team.Zen-Browser
```

#### macOS

- Requires macOS 10.15 or later
- Available for ARM and Intel architectures

You can also install Zen using Homebrew:

```
brew install --cask zen-browser
```

#### Linux

##### Arch-based distributions

```sh
yay -S zen-browser-bin
```

##### Other Linux distributions (AppImage with automated system integration)

- `native` tarball install:
  `bash <(curl -s https://updates.zen-browser.app/install.sh)`

- `zsync` is required for the Update feature of the script below

```sh
bash <(curl https://updates.zen-browser.app/appimage.sh)
```

- Again, if you don't see your OS listed above, that's because we already have it in our [downloads page](https://zen-browser.app/download)! 🔄

To upgrade the browser to a newer version, use the embedded update functionality in `About Zen`.

## 👨‍💻 Development and Contributing

Some components used by @zen-browser as an attempt to make firefox forks a better place, and for other to enjoy the beauty of OSS. You can find them [here](https://github.com/zen-browser/desktop/tree/dev/src/browser/base/zen-components).

#### `Run Locally`

In order to download and run zen locally, please follow [these instructions](https://docs.zen-browser.app/contribute/desktop).

#### `Special Thanks`

Special thanks to... EVERYONE 🎉! Checkout the team and contributors page [here](https://zen-browser.app/about)

#### `Third Party Code`

Zen couldn't be in its current state without the help of these amazing projects! 🙏

- Zen's default preferences are based on [BetterFox](https://github.com/yokoffing/Betterfox)
- Gradient image extracted from [Arc Palette](https://github.com/neurokitti/Arc_Palette)

### 🖥️ Comparison with other browsers

Thanks everyone for making zen stand out among these giants!

[![Star History Chart](https://api.star-history.com/svg?repos=zen-browser/desktop,chromium/chromium,brave/brave-browser&type=Date)](https://star-history.com/#zen-browser/desktop&chromium/chromium&brave/brave-browser&Date)

## 📄 License

Zen browser is under the [MPL LICENSE](./LICENSE). All the code is open-source and free to use! Attributions are appreciated but not required.
