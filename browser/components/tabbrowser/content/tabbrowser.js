// ... (previous content)

get _numVisiblePinTabs() {
  let i = 0;
  for (let tab of this.tabs) {
    if (!tab.pinned) {
      break;
    }
    if (!tab.hidden) {
      i++;
    }
  }
  return i;
},

get _numPinnedTabs() {
  let i = 0;
  for (let tab of this.tabs) {
    if (!tab.pinned) {
      break;
    }
    i++;
  }
  return i;
},

// ... (rest of the file content)
