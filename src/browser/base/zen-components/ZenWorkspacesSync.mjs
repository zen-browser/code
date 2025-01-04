var { Tracker, Store, SyncEngine } = ChromeUtils.importESModule('resource://services-sync/engines.sys.mjs');
var { CryptoWrapper } = ChromeUtils.importESModule('resource://services-sync/record.sys.mjs');
var { Utils } = ChromeUtils.importESModule('resource://services-sync/util.sys.mjs');
var { SCORE_INCREMENT_XLARGE } = ChromeUtils.importESModule('resource://services-sync/constants.sys.mjs');

// Define ZenWorkspaceRecord
function ZenWorkspaceRecord(collection, id) {
  CryptoWrapper.call(this, collection, id);
}

ZenWorkspaceRecord.prototype = Object.create(CryptoWrapper.prototype);
ZenWorkspaceRecord.prototype.constructor = ZenWorkspaceRecord;

ZenWorkspaceRecord.prototype._logName = 'Sync.Record.ZenWorkspace';

Utils.deferGetSet(ZenWorkspaceRecord, 'cleartext', [
  'name',
  'icon',
  'default',
  'containerTabId',
  'position',
  'theme_type',
  'theme_colors',
  'theme_opacity',
  'theme_rotation',
  'theme_texture',
]);

// Define ZenWorkspacesStore
function ZenWorkspacesStore(name, engine) {
  Store.call(this, name, engine);
}

ZenWorkspacesStore.prototype = Object.create(Store.prototype);
ZenWorkspacesStore.prototype.constructor = ZenWorkspacesStore;

/**
 * Initializes the store by loading the current changeset.
 */
ZenWorkspacesStore.prototype.initialize = async function () {
  await Store.prototype.initialize.call(this);
  // Additional initialization if needed
};

/**
 * Retrieves all workspace IDs from the storage.
 * @returns {Object} An object mapping workspace UUIDs to true.
 */
ZenWorkspacesStore.prototype.getAllIDs = async function () {
  try {
    const workspaces = await ZenWorkspacesStorage.getWorkspaces();
    const ids = {};
    for (const workspace of workspaces) {
      ids[workspace.uuid] = true;
    }
    return ids;
  } catch (error) {
    this._log.error('Error fetching all workspace IDs', error);
    throw error;
  }
};

/**
 * Handles changing the ID of a workspace.
 * @param {String} oldID - The old UUID.
 * @param {String} newID - The new UUID.
 */
ZenWorkspacesStore.prototype.changeItemID = async function (oldID, newID) {
  try {
    const workspaces = await ZenWorkspacesStorage.getWorkspaces();
    const workspace = workspaces.find((ws) => ws.uuid === oldID);
    if (workspace) {
      workspace.uuid = newID;
      await ZenWorkspacesStorage.saveWorkspace(workspace, false);
      // Mark the new ID as changed for sync
      await ZenWorkspacesStorage.markChanged(newID);
    }
  } catch (error) {
    this._log.error(`Error changing workspace ID from ${oldID} to ${newID}`, error);
    throw error;
  }
};

/**
 * Checks if a workspace exists.
 * @param {String} id - The UUID of the workspace.
 * @returns {Boolean} True if the workspace exists, false otherwise.
 */
ZenWorkspacesStore.prototype.itemExists = async function (id) {
  try {
    const workspaces = await ZenWorkspacesStorage.getWorkspaces();
    return workspaces.some((ws) => ws.uuid === id);
  } catch (error) {
    this._log.error(`Error checking if workspace exists with ID ${id}`, error);
    throw error;
  }
};

/**
 * Creates a record for a workspace.
 * @param {String} id - The UUID of the workspace.
 * @param {String} collection - The collection name.
 * @returns {ZenWorkspaceRecord} The workspace record.
 */
ZenWorkspacesStore.prototype.createRecord = async function (id, collection) {
  try {
    const workspaces = await ZenWorkspacesStorage.getWorkspaces();
    const workspace = workspaces.find((ws) => ws.uuid === id);
    const record = new ZenWorkspaceRecord(collection, id);

    if (workspace) {
      record.name = workspace.name;
      record.icon = workspace.icon;
      record.default = workspace.default;
      record.containerTabId = workspace.containerTabId;
      record.position = workspace.position;
      if (workspace.theme) {
        record.theme_type = workspace.theme.type;
        record.theme_colors = JSON.stringify(workspace.theme.gradientColors);
        record.theme_opacity = workspace.theme.opacity;
        record.theme_rotation = workspace.theme.rotation;
        record.theme_texture = workspace.theme.texture;
      }
      record.deleted = false;
    } else {
      record.deleted = true;
    }

    return record;
  } catch (error) {
    this._log.error(`Error creating record for workspace ID ${id}`, error);
    throw error;
  }
};

/**
 * Creates a new workspace.
 * @param {ZenWorkspaceRecord} record - The workspace record to create.
 */
ZenWorkspacesStore.prototype.create = async function (record) {
  try {
    this._validateRecord(record);
    const workspace = {
      uuid: record.id,
      name: record.name,
      icon: record.icon,
      default: record.default,
      containerTabId: record.containerTabId,
      position: record.position,
      theme: record.theme_type
        ? {
            type: record.theme_type,
            gradientColors: JSON.parse(record.theme_colors),
            opacity: record.theme_opacity,
            rotation: record.theme_rotation,
            texture: record.theme_texture,
          }
        : null,
    };
    await ZenWorkspacesStorage.saveWorkspace(workspace, false);
  } catch (error) {
    this._log.error(`Error creating workspace with ID ${record.id}`, error);
    throw error;
  }
};

/**
 * Updates an existing workspace.
 * @param {ZenWorkspaceRecord} record - The workspace record to update.
 */
ZenWorkspacesStore.prototype.update = async function (record) {
  try {
    this._validateRecord(record);
    await this.create(record); // Reuse create for update
  } catch (error) {
    this._log.error(`Error updating workspace with ID ${record.id}`, error);
    throw error;
  }
};

/**
 * Removes a workspace.
 * @param {ZenWorkspaceRecord} record - The workspace record to remove.
 */
ZenWorkspacesStore.prototype.remove = async function (record) {
  try {
    await ZenWorkspacesStorage.removeWorkspace(record.id, false);
  } catch (error) {
    this._log.error(`Error removing workspace with ID ${record.id}`, error);
    throw error;
  }
};

/**
 * Wipes all workspaces from the storage.
 */
ZenWorkspacesStore.prototype.wipe = async function () {
  try {
    await ZenWorkspacesStorage.wipeAllWorkspaces();
  } catch (error) {
    this._log.error('Error wiping all workspaces', error);
    throw error;
  }
};

/**
 * Validates a workspace record.
 * @param {ZenWorkspaceRecord} record - The workspace record to validate.
 */
ZenWorkspacesStore.prototype._validateRecord = function (record) {
  if (!record.id || typeof record.id !== 'string') {
    throw new Error('Invalid workspace ID');
  }
  if (!record.name || typeof record.name !== 'string') {
    throw new Error(`Invalid workspace name for ID ${record.id}`);
  }
  if (typeof record.default !== 'boolean') {
    record.default = false;
  }
  if (record.icon != null && typeof record.icon !== 'string') {
    throw new Error(`Invalid icon for workspace ID ${record.id}`);
  }
  if (record.containerTabId != null && typeof record.containerTabId !== 'number') {
    throw new Error(`Invalid containerTabId for workspace ID ${record.id}`);
  }
  if (record.position != null && typeof record.position !== 'number') {
    throw new Error(`Invalid position for workspace ID ${record.id}`);
  }

  // Validate theme properties if they exist
  if (record.theme_type) {
    if (typeof record.theme_type !== 'string') {
      throw new Error(`Invalid theme_type for workspace ID ${record.id}`);
    }
    if (!record.theme_colors || typeof record.theme_colors !== 'string') {
      throw new Error(`Invalid theme_colors for workspace ID ${record.id}`);
    }
    try {
      JSON.parse(record.theme_colors);
    } catch (e) {
      throw new Error(`Invalid theme_colors JSON for workspace ID ${record.id}`);
    }
    if (record.theme_opacity != null && typeof record.theme_opacity !== 'number') {
      throw new Error(`Invalid theme_opacity for workspace ID ${record.id}`);
    }
    if (record.theme_rotation != null && typeof record.theme_rotation !== 'number') {
      throw new Error(`Invalid theme_rotation for workspace ID ${record.id}`);
    }
    if (record.theme_texture != null && typeof record.theme_texture !== 'number') {
      throw new Error(`Invalid theme_texture for workspace ID ${record.id}`);
    }
  }
};

/**
 * Retrieves changed workspace IDs since the last sync.
 * @returns {Object} An object mapping workspace UUIDs to their change timestamps.
 */
ZenWorkspacesStore.prototype.getChangedIDs = async function () {
  try {
    return await ZenWorkspacesStorage.getChangedIDs();
  } catch (error) {
    this._log.error('Error retrieving changed IDs from storage', error);
    throw error;
  }
};

/**
 * Clears all recorded changes after a successful sync.
 */
ZenWorkspacesStore.prototype.clearChangedIDs = async function () {
  try {
    await ZenWorkspacesStorage.clearChangedIDs();
  } catch (error) {
    this._log.error('Error clearing changed IDs in storage', error);
    throw error;
  }
};

/**
 * Marks a workspace as changed.
 * @param {String} uuid - The UUID of the workspace that changed.
 */
ZenWorkspacesStore.prototype.markChanged = async function (uuid) {
  try {
    await ZenWorkspacesStorage.markChanged(uuid);
  } catch (error) {
    this._log.error(`Error marking workspace ${uuid} as changed`, error);
    throw error;
  }
};

/**
 * Finalizes the store by ensuring all pending operations are completed.
 */
ZenWorkspacesStore.prototype.finalize = async function () {
  await Store.prototype.finalize.call(this);
};

// Define ZenWorkspacesTracker
function ZenWorkspacesTracker(name, engine) {
  Tracker.call(this, name, engine);
  this._ignoreAll = false;

  // Observe profile-before-change to stop the tracker gracefully
  Services.obs.addObserver(this.asyncObserver, 'profile-before-change');
}

ZenWorkspacesTracker.prototype = Object.create(Tracker.prototype);
ZenWorkspacesTracker.prototype.constructor = ZenWorkspacesTracker;

/**
 * Retrieves changed workspace IDs by delegating to the store.
 * @returns {Object} An object mapping workspace UUIDs to their change timestamps.
 */
ZenWorkspacesTracker.prototype.getChangedIDs = async function () {
  try {
    return await this.engine._store.getChangedIDs();
  } catch (error) {
    this._log.error('Error retrieving changed IDs from store', error);
    throw error;
  }
};

/**
 * Clears all recorded changes after a successful sync.
 */
ZenWorkspacesTracker.prototype.clearChangedIDs = async function () {
  try {
    await this.engine._store.clearChangedIDs();
  } catch (error) {
    this._log.error('Error clearing changed IDs in store', error);
    throw error;
  }
};

/**
 * Called when the tracker starts. Registers observers to listen for workspace changes.
 */
ZenWorkspacesTracker.prototype.onStart = function () {
  if (this._started) {
    return;
  }
  this._log.trace('Starting tracker');
  // Register observers for workspace changes
  Services.obs.addObserver(this.asyncObserver, 'zen-workspace-added');
  Services.obs.addObserver(this.asyncObserver, 'zen-workspace-removed');
  Services.obs.addObserver(this.asyncObserver, 'zen-workspace-updated');
  this._started = true;
};

/**
 * Called when the tracker stops. Unregisters observers.
 */
ZenWorkspacesTracker.prototype.onStop = function () {
  if (!this._started) {
    return;
  }
  this._log.trace('Stopping tracker');
  // Unregister observers for workspace changes
  Services.obs.removeObserver(this.asyncObserver, 'zen-workspace-added');
  Services.obs.removeObserver(this.asyncObserver, 'zen-workspace-removed');
  Services.obs.removeObserver(this.asyncObserver, 'zen-workspace-updated');
  this._started = false;
};

/**
 * Handles observed events and marks workspaces as changed accordingly.
 * @param {nsISupports} subject - The subject of the notification.
 * @param {String} topic - The topic of the notification.
 * @param {String} data - Additional data (JSON stringified array of UUIDs).
 */
ZenWorkspacesTracker.prototype.observe = async function (subject, topic, data) {
  if (this.ignoreAll) {
    return;
  }

  try {
    switch (topic) {
      case 'profile-before-change':
        await this.stop();
        break;
      case 'zen-workspace-removed':
      case 'zen-workspace-updated':
      case 'zen-workspace-added':
        let workspaceIDs;
        if (data) {
          try {
            workspaceIDs = JSON.parse(data);
            if (!Array.isArray(workspaceIDs)) {
              throw new Error('Parsed data is not an array');
            }
          } catch (parseError) {
            this._log.error(`Failed to parse workspace UUIDs from data: ${data}`, parseError);
            return;
          }
        } else {
          this._log.error(`No data received for event ${topic}`);
          return;
        }

        this._log.trace(`Observed ${topic} for UUIDs: ${workspaceIDs.join(', ')}`);

        // Process each UUID
        for (const workspaceID of workspaceIDs) {
          if (typeof workspaceID === 'string') {
            // Inform the store about the change
            await this.engine._store.markChanged(workspaceID);
          } else {
            this._log.warn(`Invalid workspace ID encountered: ${workspaceID}`);
          }
        }

        // Bump the score once after processing all changes
        if (workspaceIDs.length > 0) {
          this.score += SCORE_INCREMENT_XLARGE;
        }
        break;
    }
  } catch (error) {
    this._log.error(`Error handling ${topic} in observe method`, error);
  }
};

/**
 * Finalizes the tracker by ensuring all pending operations are completed.
 */
ZenWorkspacesTracker.prototype.finalize = async function () {
  await Tracker.prototype.finalize.call(this);
};

// Define ZenWorkspacesEngine
function ZenWorkspacesEngine(service) {
  SyncEngine.call(this, 'Workspaces', service);
}

ZenWorkspacesEngine.prototype = Object.create(SyncEngine.prototype);
ZenWorkspacesEngine.prototype.constructor = ZenWorkspacesEngine;

ZenWorkspacesEngine.prototype._storeObj = ZenWorkspacesStore;
ZenWorkspacesEngine.prototype._trackerObj = ZenWorkspacesTracker;
ZenWorkspacesEngine.prototype._recordObj = ZenWorkspaceRecord;
ZenWorkspacesEngine.prototype.version = 2;

ZenWorkspacesEngine.prototype.syncPriority = 10;
ZenWorkspacesEngine.prototype.allowSkippedRecord = false;

Object.setPrototypeOf(ZenWorkspacesEngine.prototype, SyncEngine.prototype);
