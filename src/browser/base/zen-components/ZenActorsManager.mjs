// Utility to register JSWindowActors
var gZenActorsManager = {
  _actors: new Set(),

  addJSWindowActor(...args) {
    if (this._actors.has(args[0])) {
      // Actor already registered, nothing to do
      return;
    }

    try {
      ChromeUtils.registerWindowActor(...args);
      this._actors.add(args[0]);
    } catch (e) {
      console.warn(`Failed to register JSWindowActor: ${e}`);
    }
  },
};
