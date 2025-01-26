{
  class ZenThemePicker extends ZenMultiWindowFeature {
    static GRADIENT_IMAGE_URL = 'chrome://browser/content/zen-images/gradient.png';
    static GRADIENT_DISPLAY_URL = 'chrome://browser/content/zen-images/gradient-display.png';
    static MAX_DOTS = 5;

    currentOpacity = 0.5;
    currentRotation = 45;

    numberOfDots = 0;

    constructor() {
      super();
      if (!Services.prefs.getBoolPref('zen.theme.gradient', true) || !ZenWorkspaces.shouldHaveWorkspaces) {
        return;
      }
      this.dragStartPosition = null;

      ChromeUtils.defineLazyGetter(this, 'panel', () => document.getElementById('PanelUI-zen-gradient-generator'));
      ChromeUtils.defineLazyGetter(this, 'toolbox', () => document.getElementById('TabsToolbar'));
      ChromeUtils.defineLazyGetter(this, 'customColorInput', () =>
        document.getElementById('PanelUI-zen-gradient-generator-custom-input')
      );
      ChromeUtils.defineLazyGetter(this, 'customColorList', () =>
        document.getElementById('PanelUI-zen-gradient-generator-custom-list')
      );

      XPCOMUtils.defineLazyPreferenceGetter(
        this,
        'allowWorkspaceColors',
        'zen.theme.color-prefs.use-workspace-colors',
        true,
        this.onDarkModeChange.bind(this)
      );

      this.initRotation();
      this.initCanvas();
      this.initCustomColorInput();

      ZenWorkspaces.addChangeListeners(this.onWorkspaceChange.bind(this));
      window.matchMedia('(prefers-color-scheme: dark)').addListener(this.onDarkModeChange.bind(this));
    }

    get isDarkMode() {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    async onDarkModeChange(event, skipUpdate = false) {
      const currentWorkspace = await ZenWorkspaces.getActiveWorkspace();
      this.onWorkspaceChange(currentWorkspace, skipUpdate);
    }

    initContextMenu() {
      const menu = window.MozXULElement.parseXULToFragment(`
        <menuitem id="zenToolbarThemePicker"
                  data-lazy-l10n-id="zen-workspaces-change-gradient"
                  oncommand="gZenThemePicker.openThemePicker(event);"/>
      `);
      document.getElementById('toolbar-context-customize').before(menu);
    }

    openThemePicker(event) {
      PanelMultiView.openPopup(this.panel, this.toolbox, {
        position: 'topright topleft',
        triggerEvent: event,
      });
    }

    initCanvas() {
      this.image = new Image();
      this.image.src = ZenThemePicker.GRADIENT_IMAGE_URL;

      this.canvas = document.createElement('canvas');
      this.panel.appendChild(this.canvas);
      this.canvasCtx = this.canvas.getContext('2d');

      // wait for the image to load
      this.image.onload = this.onImageLoad.bind(this);
    }

    onImageLoad() {
      // resize the image to fit the panel
      const imageSize = 300 - 20; // 20 is the padding (10px)
      const scale = imageSize / Math.max(this.image.width, this.image.height);
      this.image.width *= scale;
      this.image.height *= scale;

      this.canvas.width = this.image.width;
      this.canvas.height = this.image.height;
      this.canvasCtx.drawImage(this.image, 0, 0);

      this.canvas.setAttribute('hidden', 'true');

      // Call the rest of the initialization
      this.initContextMenu();
      this.initThemePicker();

      this._hasInitialized = true;
      this.onDarkModeChange(null);
    }

    initRotation() {
      this.rotationInput = document.getElementById('PanelUI-zen-gradient-degrees');
      this.rotationInputDot = this.rotationInput.querySelector('.dot');
      this.rotationInputText = this.rotationInput.querySelector('.text');
      this.rotationInputDot.addEventListener('mousedown', this.onRotationMouseDown.bind(this));
      this.rotationInput.addEventListener('wheel', this.onRotationWheel.bind(this));
    }

    onRotationWheel(event) {
      event.preventDefault();
      const delta = event.deltaY;
      const degrees = this.currentRotation + (delta > 0 ? 10 : -10);
      this.setRotationInput(degrees);
      this.updateCurrentWorkspace();
    }

    onRotationMouseDown(event) {
      event.preventDefault();
      this.rotationDragging = true;
      this.rotationInputDot.style.zIndex = 2;
      this.rotationInputDot.classList.add('dragging');
      document.addEventListener('mousemove', this.onRotationMouseMove.bind(this));
      document.addEventListener('mouseup', this.onRotationMouseUp.bind(this));
    }

    onRotationMouseUp(event) {
      this.rotationDragging = false;
      this.rotationInputDot.style.zIndex = 1;
      this.rotationInputDot.classList.remove('dragging');
      document.removeEventListener('mousemove', this.onRotationMouseMove.bind(this));
      document.removeEventListener('mouseup', this.onRotationMouseUp.bind(this));
    }

    onRotationMouseMove(event) {
      if (this.rotationDragging) {
        event.preventDefault();
        const rect = this.rotationInput.getBoundingClientRect();
        // Make the dot follow the mouse in a circle, it can't go outside or inside the circle
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const angle = Math.atan2(event.clientY - centerY, event.clientX - centerX);
        const distance = Math.sqrt((event.clientX - centerX) ** 2 + (event.clientY - centerY) ** 2);
        const radius = rect.width / 2;
        let x = centerX + Math.cos(angle) * radius;
        let y = centerY + Math.sin(angle) * radius;
        if (distance > radius) {
          x = event.clientX;
          y = event.clientY;
        }
        const degrees = Math.round((Math.atan2(y - centerY, x - centerX) * 180) / Math.PI);
        this.setRotationInput(degrees);
        this.updateCurrentWorkspace();
      }
    }

    setRotationInput(degrees) {
      let fixedRotation = degrees;
      while (fixedRotation < 0) {
        fixedRotation += 360;
      }
      while (fixedRotation >= 360) {
        fixedRotation -= 360;
      }
      this.currentRotation = degrees;
      this.rotationInputDot.style.transform = `rotate(${degrees - 20}deg)`;
      this.rotationInputText.textContent = `${fixedRotation}°`;
    }

    initCustomColorInput() {
      this.customColorInput.addEventListener('keydown', this.onCustomColorKeydown.bind(this));
    }

    onCustomColorKeydown(event) {
      //checks for enter key for custom colors
      if (event.key === 'Enter') {
        event.preventDefault();
        this.addCustomColor();
      }
    }

    initThemePicker() {
      const themePicker = this.panel.querySelector('.zen-theme-picker-gradient');
      themePicker.style.setProperty('--zen-theme-picker-gradient-image', `url(${ZenThemePicker.GRADIENT_DISPLAY_URL})`);
      themePicker.addEventListener('mousemove', this.onDotMouseMove.bind(this));
      themePicker.addEventListener('mouseup', this.onDotMouseUp.bind(this));
      themePicker.addEventListener('click', this.onThemePickerClick.bind(this));
    }

    calculateInitialPosition(color) {
      const [r, g, b] = color.c;
      const imageData = this.canvasCtx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      // Find all pixels that are at least 90% similar to the color
      const similarPixels = [];
      for (let i = 0; i < imageData.data.length; i += 4) {
        const pixelR = imageData.data[i];
        const pixelG = imageData.data[i + 1];
        const pixelB = imageData.data[i + 2];
        if (Math.abs(r - pixelR) < 25 && Math.abs(g - pixelG) < 25 && Math.abs(b - pixelB) < 25) {
          similarPixels.push(i);
        }
      }
      // Check if there's an exact match
      for (const pixel of similarPixels) {
        const x = (pixel / 4) % this.canvas.width;
        const y = Math.floor(pixel / 4 / this.canvas.width);
        const pixelColor = this.getColorFromPosition(x, y);
        if (pixelColor[0] === r && pixelColor[1] === g && pixelColor[2] === b) {
          return { x: x / this.canvas.width, y: y / this.canvas.height };
        }
      }
      // If there's no exact match, return the first similar pixel
      const pixel = similarPixels[0];
      const x = (pixel / 4) % this.canvas.width;
      const y = Math.floor(pixel / 4 / this.canvas.width);
      return { x: x / this.canvas.width, y: y / this.canvas.height };
    }

    getColorFromPosition(x, y) {
      // get the color from the x and y from the image
      const imageData = this.canvasCtx.getImageData(x, y, 1, 1);
      return imageData.data;
    }

    createDot(color, fromWorkspace = false) {
      const [r, g, b] = color.c;
      const dot = document.createElement('div');
      dot.classList.add('zen-theme-picker-dot');
      if (color.isCustom) {
        if (!color.c) {
          return;
        }
        dot.classList.add('custom');
        dot.style.opacity = 0;
        dot.style.setProperty('--zen-theme-picker-dot-color', color.c);
      } else {
        dot.style.setProperty('--zen-theme-picker-dot-color', `rgb(${r}, ${g}, ${b})`);
        const { x, y } = this.calculateInitialPosition(color);
        dot.style.left = `${x * 100}%`;
        dot.style.top = `${y * 100}%`;
        dot.addEventListener('mousedown', this.onDotMouseDown.bind(this));
      }
      this.panel.querySelector('.zen-theme-picker-gradient').appendChild(dot);
      if (!fromWorkspace) {
        this.updateCurrentWorkspace(true);
      }
    }

    onDotMouseDown(event) {
      event.preventDefault();
      if (event.button === 2) {
        return;
      }
      this.dragging = true;
      this.draggedDot = event.target;
      this.draggedDot.style.zIndex = 1;
      this.draggedDot.classList.add('dragging');

      // Store the starting position of the drag
      this.dragStartPosition = {
        x: event.clientX,
        y: event.clientY,
      };
    }

    onDotMouseMove(event) {
      if (this.dragging) {
        event.preventDefault();
        const rect = this.panel.querySelector('.zen-theme-picker-gradient').getBoundingClientRect();
        const padding = 90; // each side
        // do NOT let the ball be draged outside of an imaginary circle. You can drag it anywhere inside the circle
        // if the distance between the center of the circle and the dragged ball is bigger than the radius, then the ball
        // should be placed on the edge of the circle. If it's inside the circle, then the ball just follows the mouse

        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const radius = (rect.width - padding) / 2;
        let pixelX = event.clientX;
        let pixelY = event.clientY;
        const distance = Math.sqrt((pixelX - centerX) ** 2 + (pixelY - centerY) ** 2);
        if (distance > radius) {
          const angle = Math.atan2(pixelY - centerY, pixelX - centerX);
          pixelX = centerX + Math.cos(angle) * radius;
          pixelY = centerY + Math.sin(angle) * radius;
        }

        // set the location of the dot in pixels
        const relativeX = pixelX - rect.left;
        const relativeY = pixelY - rect.top;
        this.draggedDot.style.left = `${relativeX}px`;
        this.draggedDot.style.top = `${relativeY}px`;
        const color = this.getColorFromPosition(relativeX, relativeY);
        this.draggedDot.style.setProperty('--zen-theme-picker-dot-color', `rgb(${color[0]}, ${color[1]}, ${color[2]})`);
        this.updateCurrentWorkspace();
      }
    }

    addColorToCustomList(color) {
      const listItems = window.MozXULElement.parseXULToFragment(`
        <hbox class="zen-theme-picker-custom-list-item">
          <html:div class="zen-theme-picker-dot-custom"></html:div>
          <label class="zen-theme-picker-custom-list-item-label"></label>
          <toolbarbutton class="zen-theme-picker-custom-list-item-remove toolbarbutton-1" oncommand="gZenThemePicker.removeCustomColor(event);"></toolbarbutton>
        </hbox>
      `);
      listItems.querySelector('.zen-theme-picker-custom-list-item').setAttribute('data-color', color);
      listItems.querySelector('.zen-theme-picker-dot-custom').style.setProperty('--zen-theme-picker-dot-color', color);
      listItems.querySelector('.zen-theme-picker-custom-list-item-label').textContent = color;

      this.customColorList.appendChild(listItems);
    }

    async addCustomColor() {
      let color = this.customColorInput.value;

      if (!color) {
        return;
      }

      // Add '#' prefix if it's missing and the input appears to be a hex color
      if (!color.startsWith('#') && /^[0-9A-Fa-f]{3,6}$/.test(color)) {
        color = '#' + color;
      }

      // can be any color format, we just add it to the list as a dot, but hidden
      const dot = document.createElement('div');
      dot.classList.add('zen-theme-picker-dot', 'hidden', 'custom');
      dot.style.opacity = 0;
      dot.style.setProperty('--zen-theme-picker-dot-color', color);
      this.panel.querySelector('.zen-theme-picker-gradient').appendChild(dot);
      this.customColorInput.value = '';
      await this.updateCurrentWorkspace();
    }

    onThemePickerClick(event) {
      event.preventDefault();

      if (event.button !== 0 || this.dragging) return;

      const gradient = this.panel.querySelector('.zen-theme-picker-gradient');
      const rect = gradient.getBoundingClientRect();
      const padding = 90; // each side

      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const radius = (rect.width - padding) / 2;
      let pixelX = event.clientX;
      let pixelY = event.clientY;

      // Check if the click is within the circle
      const distance = Math.sqrt((pixelX - centerX) ** 2 + (pixelY - centerY) ** 2);
      if (distance > radius) {
        return;
      }

      const clickedElement = event.target;
      const isExistingDot = clickedElement.classList.contains('zen-theme-picker-dot');

      if (!isExistingDot && this.numberOfDots < ZenThemePicker.MAX_DOTS) {
        const relativeX = event.clientX - rect.left;
        const relativeY = event.clientY - rect.top;

        const color = this.getColorFromPosition(relativeX, relativeY);

        const dot = document.createElement('div');
        dot.classList.add('zen-theme-picker-dot');
        dot.addEventListener('mousedown', this.onDotMouseDown.bind(this));

        dot.style.left = `${relativeX}px`;
        dot.style.top = `${relativeY}px`;
        dot.style.setProperty('--zen-theme-picker-dot-color', `rgb(${color[0]}, ${color[1]}, ${color[2]})`);

        gradient.appendChild(dot);

        this.updateCurrentWorkspace(true);
      }
    }

    onDotMouseDown(event) {
      event.preventDefault();
      if (event.button === 2) {
        return;
      }
      this.dragging = true;
      this.draggedDot = event.target;
      this.draggedDot.style.zIndex = 1;
      this.draggedDot.classList.add('dragging');

      // Store the starting position of the drag
      this.dragStartPosition = {
        x: event.clientX,
        y: event.clientY,
      };
    }

    onDotMouseUp(event) {
      if (event.button === 2) {
        if (!event.target.classList.contains('zen-theme-picker-dot')) {
          return;
        }
        event.target.remove();
        this.updateCurrentWorkspace();
        this.numberOfDots--;
        return;
      }

      if (this.dragging) {
        event.preventDefault();
        event.stopPropagation();
        this.dragging = false;
        this.draggedDot.style.zIndex = 1;
        this.draggedDot.classList.remove('dragging');
        this.draggedDot = null;
        this.dragStartPosition = null; // Reset the drag start position
        return;
      }

      this.numberOfDots = this.panel.querySelectorAll('.zen-theme-picker-dot').length;
    }

    themedColors(colors) {
      const isDarkMode = this.isDarkMode;
      const factor = isDarkMode ? 0.5 : 1.1;
      return colors.map((color) => {
        return {
          c: color.isCustom
            ? color.c
            : [Math.min(255, color.c[0] * factor), Math.min(255, color.c[1] * factor), Math.min(255, color.c[2] * factor)],
          isCustom: color.isCustom,
        };
      });
    }

    onOpacityChange(event) {
      this.currentOpacity = event.target.value;
      this.updateCurrentWorkspace();
    }

    onTextureChange(event) {
      this.currentTexture = event.target.value;
      this.updateCurrentWorkspace();
    }

    getToolbarModifiedBase() {
      return this.isDarkMode
        ? 'color-mix(in srgb, var(--zen-themed-toolbar-bg) 80%, #fff 20%)'
        : 'color-mix(in srgb, var(--zen-themed-toolbar-bg) 95%, #000 5%)';
    }

    getSingleRGBColor(color, forToolbar = false) {
      if (color.isCustom) {
        return color.c;
      }
      const toolbarBg = forToolbar ? this.getToolbarModifiedBase() : 'var(--zen-themed-toolbar-bg-transparent)';
      return `color-mix(in srgb, rgb(${color.c[0]}, ${color.c[1]}, ${color.c[2]}) ${this.currentOpacity * 100}%, ${toolbarBg} ${(1 - this.currentOpacity) * 100}%)`;
    }

    getGradient(colors, forToolbar = false) {
      const themedColors = this.themedColors(colors);
      if (themedColors.length === 0) {
        return forToolbar ? 'var(--zen-themed-toolbar-bg)' : 'var(--zen-themed-toolbar-bg-transparent)';
      } else if (themedColors.length === 1) {
        return this.getSingleRGBColor(themedColors[0], forToolbar);
      }
      return `linear-gradient(${this.currentRotation}deg, ${themedColors.map((color) => this.getSingleRGBColor(color, forToolbar)).join(', ')})`;
    }

    static getTheme(colors = [], opacity = 0.5, rotation = 45, texture = 0) {
      return {
        type: 'gradient',
        gradientColors: colors ? colors.filter((color) => color) : [], // remove undefined
        opacity,
        rotation,
        texture,
      };
    }
    //TODO: add a better noise system that adds noise not just changes transparency
    updateNoise(texture) {
      const wrapper = document.getElementById('zen-main-app-wrapper');
      wrapper.style.setProperty('--zen-grainy-background-opacity', texture);
    }

    hexToRgb(hex) {
      if (hex.startsWith('#')) {
        hex = hex.substring(1);
      }
      if (hex.length === 3) {
        hex = hex
          .split('')
          .map((char) => char + char)
          .join('');
      }
      return [parseInt(hex.substring(0, 2), 16), parseInt(hex.substring(2, 4), 16), parseInt(hex.substring(4, 6), 16)];
    }

    pSBC = (p, c0, c1, l) => {
      let r,
        g,
        b,
        P,
        f,
        t,
        h,
        i = parseInt,
        m = Math.round,
        a = typeof c1 == 'string';
      if (typeof p != 'number' || p < -1 || p > 1 || typeof c0 != 'string' || (c0[0] != 'r' && c0[0] != '#') || (c1 && !a))
        return null;
      if (!this.pSBCr)
        this.pSBCr = (d) => {
          let n = d.length,
            x = {};
          if (n > 9) {
            ([r, g, b, a] = d = d.split(',')), (n = d.length);
            if (n < 3 || n > 4) return null;
            (x.r = i(r[3] == 'a' ? r.slice(5) : r.slice(4))), (x.g = i(g)), (x.b = i(b)), (x.a = a ? parseFloat(a) : -1);
          } else {
            if (n == 8 || n == 6 || n < 4) return null;
            if (n < 6) d = '#' + d[1] + d[1] + d[2] + d[2] + d[3] + d[3] + (n > 4 ? d[4] + d[4] : '');
            d = i(d.slice(1), 16);
            if (n == 9 || n == 5)
              (x.r = (d >> 24) & 255), (x.g = (d >> 16) & 255), (x.b = (d >> 8) & 255), (x.a = m((d & 255) / 0.255) / 1000);
            else (x.r = d >> 16), (x.g = (d >> 8) & 255), (x.b = d & 255), (x.a = -1);
          }
          return x;
        };
      (h = c0.length > 9),
        (h = a ? (c1.length > 9 ? true : c1 == 'c' ? !h : false) : h),
        (f = this.pSBCr(c0)),
        (P = p < 0),
        (t = c1 && c1 != 'c' ? this.pSBCr(c1) : P ? { r: 0, g: 0, b: 0, a: -1 } : { r: 255, g: 255, b: 255, a: -1 }),
        (p = P ? p * -1 : p),
        (P = 1 - p);
      if (!f || !t) return null;
      if (l) (r = m(P * f.r + p * t.r)), (g = m(P * f.g + p * t.g)), (b = m(P * f.b + p * t.b));
      else
        (r = m((P * f.r ** 2 + p * t.r ** 2) ** 0.5)),
          (g = m((P * f.g ** 2 + p * t.g ** 2) ** 0.5)),
          (b = m((P * f.b ** 2 + p * t.b ** 2) ** 0.5));
      (a = f.a), (t = t.a), (f = a >= 0 || t >= 0), (a = f ? (a < 0 ? t : t < 0 ? a : a * P + t * p) : 0);
      if (h) return 'rgb' + (f ? 'a(' : '(') + r + ',' + g + ',' + b + (f ? ',' + m(a * 1000) / 1000 : '') + ')';
      else
        return (
          '#' +
          (4294967296 + r * 16777216 + g * 65536 + b * 256 + (f ? m(a * 255) : 0)).toString(16).slice(1, f ? undefined : -2)
        );
    };

    getMostDominantColor(allColors) {
      const colors = this.themedColors(allColors);
      const themedColors = colors.filter((color) => !color.isCustom);
      if (themedColors.length === 0 || !this.allowWorkspaceColors) {
        return null;
      }
      // get the most dominant color in the gradient
      let dominantColor = themedColors[0].c;
      let dominantColorCount = 0;
      for (const color of themedColors) {
        const count = themedColors.filter(
          (c) => c.c[0] === color.c[0] && c.c[1] === color.c[1] && c.c[2] === color.c[2]
        ).length;
        if (count > dominantColorCount) {
          dominantColorCount = count;
          dominantColor = color.c;
        }
      }
      const result = this.pSBC(
        this.isDarkMode ? 0.2 : -0.5,
        `rgb(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]})`
      );
      return result?.match(/\d+/g).map(Number);
    }

    async onWorkspaceChange(workspace, skipUpdate = false, theme = null) {
      const uuid = workspace.uuid;
      // Use theme from workspace object or passed theme
      let workspaceTheme = theme || workspace.theme;

      await this.foreachWindowAsActive(async (browser) => {
        if (!browser.gZenThemePicker?._hasInitialized) {
          return;
        }
        // Do not rebuild if the workspace is not the same as the current one
        const windowWorkspace = await browser.ZenWorkspaces.getActiveWorkspace();
        if (windowWorkspace.uuid !== uuid && theme !== null) {
          return;
        }

        // get the theme from the window
        workspaceTheme = theme || windowWorkspace.theme;

        if (!skipUpdate) {
          for (const dot of browser.gZenThemePicker.panel.querySelectorAll('.zen-theme-picker-dot')) {
            dot.remove();
          }
        }

        const appWrapper = browser.document.getElementById('browser');
        if (!skipUpdate && !this._animatingBackground) {
          this._animatingBackground = true;
          appWrapper.removeAttribute('animating');
          browser.document.documentElement.style.setProperty(
            '--zen-main-browser-background-old',
            browser.document.documentElement.style.getPropertyValue('--zen-main-browser-background')
          );
          browser.window.requestAnimationFrame(() => {
            appWrapper.setAttribute('animating', 'true');
            setTimeout(() => {
              this._animatingBackground = false;
              appWrapper.removeAttribute('animating');
              appWrapper.setAttribute('post-animating', 'true');
              browser.document.documentElement.style.removeProperty('--zen-main-browser-background-old');
              setTimeout(() => {
                // Reactivate the transition after the animation
                appWrapper.removeAttribute('post-animating');
              }, 100);
            }, 500);
          });
        }

        browser.gZenThemePicker.resetCustomColorList();
        if (!workspaceTheme || workspaceTheme.type !== 'gradient') {
          const gradient = browser.gZenThemePicker.getGradient([]);
          const gradientToolbar = browser.gZenThemePicker.getGradient([], true);
          browser.document.documentElement.style.setProperty('--zen-main-browser-background', gradient);
          browser.document.documentElement.style.setProperty('--zen-main-browser-background-toolbar', gradientToolbar);
          browser.gZenThemePicker.updateNoise(0);
          browser.document.documentElement.style.setProperty('--zen-primary-color', this.getNativeAccentColor());
          return;
        }

        browser.gZenThemePicker.currentOpacity = workspaceTheme.opacity ?? 0.5;
        browser.gZenThemePicker.currentRotation = workspaceTheme.rotation ?? 45;
        browser.gZenThemePicker.currentTexture = workspaceTheme.texture ?? 0;

        browser.gZenThemePicker.numberOfDots = workspaceTheme.gradientColors.length;

        browser.document.getElementById('PanelUI-zen-gradient-generator-opacity').value =
          browser.gZenThemePicker.currentOpacity;
        browser.document.getElementById('PanelUI-zen-gradient-generator-texture').value =
          browser.gZenThemePicker.currentTexture;
        browser.gZenThemePicker.setRotationInput(browser.gZenThemePicker.currentRotation);

        const gradient = browser.gZenThemePicker.getGradient(workspaceTheme.gradientColors);
        const gradientToolbar = browser.gZenThemePicker.getGradient(workspaceTheme.gradientColors, true);
        browser.gZenThemePicker.updateNoise(workspaceTheme.texture);

        for (const dot of workspaceTheme.gradientColors) {
          if (dot.isCustom) {
            browser.gZenThemePicker.addColorToCustomList(dot.c);
          }
        }

        browser.document.documentElement.style.setProperty('--zen-main-browser-background-toolbar', gradientToolbar);
        browser.document.documentElement.style.setProperty('--zen-main-browser-background', gradient);

        const dominantColor = this.getMostDominantColor(workspaceTheme.gradientColors);
        if (dominantColor) {
          browser.document.documentElement.style.setProperty(
            '--zen-primary-color',
            `rgb(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]})`
          );
        }

        if (!skipUpdate) {
          browser.gZenThemePicker.recalculateDots(workspaceTheme.gradientColors);
        }
      });
    }

    get riceManager() {
      if (!this._riceManager) {
        this._riceManager = new window.ZenRiceManager();
      }
      return this._riceManager;
    }

    shareTheme() {
      const manager = this.riceManager;
      manager.openShareDialog();
    }

    getNativeAccentColor() {
      return Services.prefs.getStringPref('zen.theme.accent-color');
    }

    resetCustomColorList() {
      this.customColorList.innerHTML = '';
    }

    removeCustomColor(event) {
      const target = event.target.closest('.zen-theme-picker-custom-list-item');
      const color = target.getAttribute('data-color');
      const dots = this.panel.querySelectorAll('.zen-theme-picker-dot');
      for (const dot of dots) {
        if (dot.style.getPropertyValue('--zen-theme-picker-dot-color') === color) {
          dot.remove();
          break;
        }
      }
      target.remove();
      this.updateCurrentWorkspace();
    }

    recalculateDots(colors) {
      //THIS IS PART OF THE ISSUE
      for (const color of colors) {
        this.createDot(color, true);
      }
    }

    async updateCurrentWorkspace(skipSave = true) {
      this.updated = skipSave;
      const dots = this.panel.querySelectorAll('.zen-theme-picker-dot');
      const colors = Array.from(dots).map((dot) => {
        const color = dot.style.getPropertyValue('--zen-theme-picker-dot-color');
        if (color === 'undefined') {
          return;
        }
        const isCustom = dot.classList.contains('custom');
        return { c: isCustom ? color : color.match(/\d+/g).map(Number), isCustom };
      });
      const gradient = ZenThemePicker.getTheme(colors, this.currentOpacity, this.currentRotation, this.currentTexture);
      let currentWorkspace = await ZenWorkspaces.getActiveWorkspace();

      if (!skipSave) {
        await ZenWorkspacesStorage.saveWorkspaceTheme(currentWorkspace.uuid, gradient);
        await ZenWorkspaces._propagateWorkspaceData();
        ConfirmationHint.show(document.getElementById('PanelUI-menu-button'), 'zen-panel-ui-gradient-generator-saved-message');
        currentWorkspace = await ZenWorkspaces.getActiveWorkspace();
      }

      await this.onWorkspaceChange(currentWorkspace, true, skipSave ? gradient : null);
    }

    async handlePanelClose() {
      if (this.updated) {
        await this.updateCurrentWorkspace(false);
      }
    }
  }

  window.ZenThemePicker = ZenThemePicker;
}
