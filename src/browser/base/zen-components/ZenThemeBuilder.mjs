const kZenAccentColorConfigKey = 'zen.theme.accent-color';

var gZenThemeBuilder = {
  init() {
    return; // TODO:
    this._mouseMoveListener = this._handleThumbMouseMove.bind(this);
    setTimeout(() => {
      this._initBuilderUI();
    }, 500);
  },

  get _builderWrapper() {
    if (this.__builderWrapper) {
      return this.__builderWrapper;
    }
    this.__builderWrapper = document.getElementById('zen-theme-builder-wrapper');
    return this.__builderWrapper;
  },

  _initBuilderUI() {
    let wrapper = this._builderWrapper;
    if (!wrapper) {
      return;
    }

    console.info('gZenThemeBuilder: init builder UI');

    const kTemplate = `
      <html:div id="zen-theme-builder">
        <html:div id="zen-theme-builder-color-picker">
          <html:canvas id="zen-theme-builder-color-picker-canvas"></html:canvas>
          <html:div id="zen-theme-builder-color-picker-deck">
            <html:div id="zen-theme-builder-color-picker-thumb"></html:div>
          </html:div>
        </html:div>
      </html:div>
    `;
    wrapper.innerHTML = kTemplate;
    this._initColorPicker();
  },

  _getPositionFromColor(ctx, color) {
    var w = ctx.canvas.width,
      h = ctx.canvas.height,
      data = ctx.getImageData(0, 0, w, h), /// get image data
      buffer = data.data, /// and its pixel buffer
      len = buffer.length, /// cache length
      x,
      y = 0,
      p,
      px; /// for iterating
    /// iterating x/y instead of forward to get position the easy way
    for (; y < h; y++) {
      /// common value for all x
      p = y * 4 * w;
      for (x = 0; x < w; x++) {
        /// next pixel (skipping 4 bytes as each pixel is RGBA bytes)
        px = p + x * 4;
        /// if red component match check the others
        if (buffer[px] === color[0]) {
          if (buffer[px + 1] === color[1] && buffer[px + 2] === color[2]) {
            return [x, y];
          }
        }
      }
    }
    return null;
  },

  _hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)];
  },

  _componentToHex(c) {
    var hex = c.toString(16);
    return hex.length == 1 ? '0' + hex : hex;
  },

  _rgbToHex(r, g, b) {
    return '#' + this._componentToHex(r) + this._componentToHex(g) + this._componentToHex(b);
  },

  _initColorPicker() {
    const canvas = document.getElementById('zen-theme-builder-color-picker-canvas');
    const thumb = document.getElementById('zen-theme-builder-color-picker-thumb');

    // A all the main colors are all blended together towards the center.
    // But we also add some random gradients to make it look more interesting.
    // Instead of using a simple gradient, we use a radial gradient.
    const ctx = canvas.getContext('2d');
    const size = 180;
    canvas.width = size;
    canvas.height = size;
    const center = size / 2;
    const radius = size / 2;
    const gradient = ctx.createConicGradient(0, center, center);
    gradient.addColorStop(0, '#fff490');
    gradient.addColorStop(1 / 12, '#f9e380');
    gradient.addColorStop(2 / 12, '#fecc87');
    gradient.addColorStop(3 / 12, '#ffa894');
    gradient.addColorStop(4 / 12, '#f98089');
    gradient.addColorStop(5 / 12, '#f9b7c5');
    gradient.addColorStop(6 / 12, '#c193b8');
    gradient.addColorStop(7 / 12, '#a8b7e0');
    gradient.addColorStop(8 / 12, '#88d2f9');
    gradient.addColorStop(9 / 12, '#81e8e5');
    gradient.addColorStop(10 / 12, '#b7e5a5');
    gradient.addColorStop(11 / 12, '#eaefac');
    gradient.addColorStop(1, '#fff490');

    const radialGradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    radialGradient.addColorStop(0, 'rgba(255,255,255,1)');
    radialGradient.addColorStop(1, 'rgba(255,255,255,0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    //ctx.fillStyle = radialGradient;
    //ctx.fillRect(0, 0, size, size);

    // Add the thumb.
    const accentColor = Services.prefs.getStringPref(kZenAccentColorConfigKey, '#ffb787');
    const pos = this._getPositionFromColor(ctx, this._hexToRgb(accentColor));

    let x = pos ? pos[0] : center;
    let y = pos ? pos[1] : center;

    thumb.style.left = `${x}px`;
    thumb.style.top = `${y}px`;

    thumb.addEventListener('mousedown', this._handleThumbMouseDown.bind(this));
    document.addEventListener('mouseup', this._handleThumbMouseUp.bind(this));
  },

  _handleThumbMouseDown(e) {
    document.addEventListener('mousemove', this._mouseMoveListener);
  },

  _handleThumbMouseUp(e) {
    document.removeEventListener('mousemove', this._mouseMoveListener);
  },

  _handleThumbMouseMove(e) {
    const kThumbOffset = 15;
    const deck = document.getElementById('zen-theme-builder-color-picker-deck');

    const thumb = document.getElementById('zen-theme-builder-color-picker-thumb');
    const rect = deck.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;

    if (x > rect.width - kThumbOffset) {
      x = rect.width - kThumbOffset;
    }
    if (y > rect.height - kThumbOffset) {
      y = rect.height - kThumbOffset;
    }
    if (x < kThumbOffset) {
      x = kThumbOffset;
    }
    if (y < kThumbOffset) {
      y = kThumbOffset;
    }

    thumb.style.left = `${x}px`;
    thumb.style.top = `${y}px`;

    const canvas = document.getElementById('zen-theme-builder-color-picker-canvas');
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(x, y, 1, 1);

    // Update the accent color.
    Services.prefs.setStringPref(kZenAccentColorConfigKey, this._rgbToHex(...imageData.data));
  },
};
