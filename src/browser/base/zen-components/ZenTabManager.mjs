class ZenBrowserTabManager extends ZenDOMOperatedFeature {
  _tabEdited = null;
  init() {
    this._insertItemsIntoTabContextMenu();

  }

  _insertItemsIntoTabContextMenu() {
    const element = window.MozXULElement.parseXULToFragment(`
      <menuitem id="context_zen-rename-tab"
                data-l10n-id="tab-context-zen-rename-tab"
                oncommand="gZenBrowserTabManager.contextRenameTab();" />
    `);
    document.getElementById('context_duplicateTabs').after(element);
    console.log("akjsdhfjkb")
  }

  contextRenameTab(event) {
    this.contextRenameTabStart(event);
  }

  contextRenameTabKeydown(event) {
    if (event.key === 'Enter') {
      let label = this._tabEdited.querySelector(".tab-label-container-editing");
      let input = this._tabEdited.querySelector('#tab-label-input');
      let newName = input.value;
      this._tabEdited.setAttribute('label', newName);
      this._tabEdited.querySelector('.tab-editor-container').remove();
      label.style.display = '';
      label.className = label.className.replace(' tab-label-container-editing', '');
      document.removeEventListener('click', this.contextRenameTabHalt.bind(this));
      this._tabEdited = null;
    } else if (event.key === "Escape") {
      let label = this._tabEdited.querySelector(".tab-label-container-editing");
      this._tabEdited.querySelector('.tab-editor-container').remove();

      label.style.display = '';
      label.className = label.className.replace(' tab-label-container-editing', '');
      document.removeEventListener('click', this.contextRenameTabHalt.bind(this));
      this._tabEdited = null;
    }
  }
  contextRenameTabStart(event) {
    const label = TabContextMenu.contextTab.querySelector(".tab-label-container")
    label.style.display = 'none';
    label.className += ' tab-label-container-editing';

    const container = window.MozXULElement.parseXULToFragment(`
      <vbox class="tab-label-container tab-editor-container" flex="1" align="start" pack="center"></vbox>
    `);
    label.after(container);
    const containerHtml = TabContextMenu.contextTab.querySelector('.tab-editor-container');
    const input = document.createElement('input');
    input.id = 'tab-label-input';
    input.value = TabContextMenu.contextTab.label;
    input.addEventListener('keydown', this.contextRenameTabKeydown.bind(this));
    input.style["white-space"] = "nowrap";
    input.style["overflow-x"] = "scroll";
    input.style["margin"] = "0";

    containerHtml.appendChild(input);
    input.focus();
    input.select()
    this._tabEdited = TabContextMenu.contextTab;

    document.addEventListener('click', this.contextRenameTabHalt.bind(this));

  }

  contextRenameTabHalt(event) {
    if (event.target.closest('#tab-label-input')) {
      return;
    }
    this._tabEdited.querySelector('.tab-editor-container').remove();
    const label = this._tabEdited.querySelector(".tab-label-container-editing");
    label.style.display = '';
    label.className = label.className.replace(' tab-label-container-editing', '');

    document.removeEventListener('click', this.contextRenameTabHalt.bind(this));
  }

}

window.gZenBrowserTabManager = new ZenBrowserTabManager();
