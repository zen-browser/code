// ... (previous content)

_handleTabDrag(event) {
  // ... (existing code)

  if (draggedTab.pinned) {
    // Create a new tab with the pinned tab's URL
    let newTab = gBrowser.addTab(draggedTab.linkedBrowser.currentURI.spec, {
      triggeringPrincipal: draggedTab.linkedBrowser.contentPrincipal,
    });
    gBrowser.selectTab(newTab);
    return;
  }

  // ... (rest of the existing _handleTabDrag method)
},

// ... (rest of the file content)
