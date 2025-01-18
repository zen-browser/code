var ZenWorkspacesStorage = {
  lazy: {},

  async init() {
    ChromeUtils.defineESModuleGetters(this.lazy, {
      PlacesUtils: 'resource://gre/modules/PlacesUtils.sys.mjs',
      Weave: 'resource://services-sync/main.sys.mjs',
    });

    await this._ensureTable();
    await ZenWorkspaceBookmarksStorage.init();
  },

  async _ensureTable() {
    await this.lazy.PlacesUtils.withConnectionWrapper('ZenWorkspacesStorage._ensureTable', async (db) => {
      // Create the main workspaces table if it doesn't exist
      await db.execute(`
        CREATE TABLE IF NOT EXISTS zen_workspaces (
          id INTEGER PRIMARY KEY,
          uuid TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          icon TEXT,
          is_default INTEGER NOT NULL DEFAULT 0,
          container_id INTEGER,
          position INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `);

      // Add new columns if they don't exist
      // SQLite doesn't have a direct "ADD COLUMN IF NOT EXISTS" syntax,
      // so we need to check if the columns exist first
      const columns = await db.execute(`PRAGMA table_info(zen_workspaces)`);
      const columnNames = columns.map((row) => row.getResultByName('name'));

      // Helper function to add column if it doesn't exist
      const addColumnIfNotExists = async (columnName, definition) => {
        if (!columnNames.includes(columnName)) {
          await db.execute(`ALTER TABLE zen_workspaces ADD COLUMN ${columnName} ${definition}`);
        }
      };

      // Add each new column if it doesn't exist
      await addColumnIfNotExists('theme_type', 'TEXT');
      await addColumnIfNotExists('theme_colors', 'TEXT');
      await addColumnIfNotExists('theme_opacity', 'REAL');
      await addColumnIfNotExists('theme_rotation', 'INTEGER');
      await addColumnIfNotExists('theme_texture', 'REAL');

      // Create an index on the uuid column
      await db.execute(`
        CREATE INDEX IF NOT EXISTS idx_zen_workspaces_uuid ON zen_workspaces(uuid)
      `);

      // Create the changes tracking table if it doesn't exist
      await db.execute(`
        CREATE TABLE IF NOT EXISTS zen_workspaces_changes (
          uuid TEXT PRIMARY KEY,
          timestamp INTEGER NOT NULL
        )
      `);

      // Create an index on the uuid column for changes tracking table
      await db.execute(`
        CREATE INDEX IF NOT EXISTS idx_zen_workspaces_changes_uuid ON zen_workspaces_changes(uuid)
      `);

      if (!this.lazy.Weave.Service.engineManager.get('workspaces')) {
        this.lazy.Weave.Service.engineManager.register(ZenWorkspacesEngine);
        await ZenWorkspacesStorage.migrateWorkspacesFromJSON();
      }

      ZenWorkspaces._resolveDBInitialized();
    });
  },

  async migrateWorkspacesFromJSON() {
    const oldWorkspacesPath = PathUtils.join(PathUtils.profileDir, 'zen-workspaces', 'Workspaces.json');
    if (await IOUtils.exists(oldWorkspacesPath)) {
      console.info('ZenWorkspacesStorage: Migrating workspaces from JSON...');
      const oldWorkspaces = await IOUtils.readJSON(oldWorkspacesPath);
      if (oldWorkspaces.workspaces) {
        for (const workspace of oldWorkspaces.workspaces) {
          await this.saveWorkspace(workspace);
        }
      }
      await IOUtils.remove(oldWorkspacesPath);
    }
  },

  /**
   * Private helper method to notify observers with a list of changed UUIDs.
   * @param {string} event - The observer event name.
   * @param {Array<string>} uuids - Array of changed workspace UUIDs.
   */
  _notifyWorkspacesChanged(event, uuids) {
    if (uuids.length === 0) return; // No changes to notify

    // Convert the array of UUIDs to a JSON string
    const data = JSON.stringify(uuids);

    Services.obs.notifyObservers(null, event, data);
  },

  async saveWorkspace(workspace, notifyObservers = true) {
    const changedUUIDs = new Set();

    await this.lazy.PlacesUtils.withConnectionWrapper('ZenWorkspacesStorage.saveWorkspace', async (db) => {
      await db.executeTransaction(async () => {
        const now = Date.now();

        // Handle default workspace
        if (workspace.default) {
          await db.execute(`UPDATE zen_workspaces SET is_default = 0 WHERE uuid != :uuid`, { uuid: workspace.uuid });
          const unsetDefaultRows = await db.execute(`SELECT uuid FROM zen_workspaces WHERE is_default = 0 AND uuid != :uuid`, {
            uuid: workspace.uuid,
          });
          for (const row of unsetDefaultRows) {
            changedUUIDs.add(row.getResultByName('uuid'));
          }
        }

        let newPosition;
        if ('position' in workspace && Number.isFinite(workspace.position)) {
          newPosition = workspace.position;
        } else {
          // Get the maximum position
          const maxPositionResult = await db.execute(`SELECT MAX("position") as max_position FROM zen_workspaces`);
          const maxPosition = maxPositionResult[0].getResultByName('max_position') || 0;
          newPosition = maxPosition + 1000; // Add a large increment to avoid frequent reordering
        }

        // Insert or replace the workspace
        await db.executeCached(
          `
          INSERT OR REPLACE INTO zen_workspaces (
          uuid, name, icon, is_default, container_id, created_at, updated_at, "position",
          theme_type, theme_colors, theme_opacity, theme_rotation, theme_texture
        ) VALUES (
          :uuid, :name, :icon, :is_default, :container_id,
          COALESCE((SELECT created_at FROM zen_workspaces WHERE uuid = :uuid), :now),
          :now,
          :position,
          :theme_type, :theme_colors, :theme_opacity, :theme_rotation, :theme_texture
        )
        `,
          {
            uuid: workspace.uuid,
            name: workspace.name,
            icon: workspace.icon || null,
            is_default: workspace.default ? 1 : 0,
            container_id: workspace.containerTabId || null,
            now,
            position: newPosition,
            theme_type: workspace.theme?.type || null,
            theme_colors: workspace.theme ? JSON.stringify(workspace.theme.gradientColors) : null,
            theme_opacity: workspace.theme?.opacity || null,
            theme_rotation: workspace.theme?.rotation || null,
            theme_texture: workspace.theme?.texture || null,
          }
        );

        // Record the change
        await db.execute(
          `
          INSERT OR REPLACE INTO zen_workspaces_changes (uuid, timestamp)
        VALUES (:uuid, :timestamp)
        `,
          {
            uuid: workspace.uuid,
            timestamp: Math.floor(now / 1000),
          }
        );

        changedUUIDs.add(workspace.uuid);

        await this.updateLastChangeTimestamp(db);
      });
    });

    if (notifyObservers) {
      this._notifyWorkspacesChanged('zen-workspace-updated', Array.from(changedUUIDs));
    }
  },

  async getWorkspaces() {
    const db = await this.lazy.PlacesUtils.promiseDBConnection();
    const rows = await db.executeCached(`
      SELECT * FROM zen_workspaces ORDER BY created_at ASC
    `);
    return rows.map((row) => ({
      uuid: row.getResultByName('uuid'),
      name: row.getResultByName('name'),
      icon: row.getResultByName('icon'),
      default: !!row.getResultByName('is_default'),
      containerTabId: row.getResultByName('container_id'),
      position: row.getResultByName('position'),
      theme: row.getResultByName('theme_type')
        ? {
            type: row.getResultByName('theme_type'),
            gradientColors: JSON.parse(row.getResultByName('theme_colors')),
            opacity: row.getResultByName('theme_opacity'),
            rotation: row.getResultByName('theme_rotation'),
            texture: row.getResultByName('theme_texture'),
          }
        : null,
    }));
  },

  async removeWorkspace(uuid, notifyObservers = true) {
    const changedUUIDs = [uuid];

    await this.lazy.PlacesUtils.withConnectionWrapper('ZenWorkspacesStorage.removeWorkspace', async (db) => {
      await db.execute(
        `
            DELETE FROM zen_workspaces WHERE uuid = :uuid
          `,
        { uuid }
      );

      // Record the removal as a change
      const now = Date.now();
      await db.execute(
        `
        INSERT OR REPLACE INTO zen_workspaces_changes (uuid, timestamp)
        VALUES (:uuid, :timestamp)
      `,
        {
          uuid,
          timestamp: Math.floor(now / 1000),
        }
      );

      await this.updateLastChangeTimestamp(db);
    });

    if (notifyObservers) {
      this._notifyWorkspacesChanged('zen-workspace-removed', changedUUIDs);
    }
  },

  async wipeAllWorkspaces() {
    await this.lazy.PlacesUtils.withConnectionWrapper('ZenWorkspacesStorage.wipeAllWorkspaces', async (db) => {
      await db.execute(`DELETE FROM zen_workspaces`);
      await db.execute(`DELETE FROM zen_workspaces_changes`);
      await this.updateLastChangeTimestamp(db);
    });
  },

  async setDefaultWorkspace(uuid, notifyObservers = true) {
    const changedUUIDs = [];

    await this.lazy.PlacesUtils.withConnectionWrapper('ZenWorkspacesStorage.setDefaultWorkspace', async (db) => {
      await db.executeTransaction(async () => {
        const now = Date.now();
        // Unset the default flag for all other workspaces
        await db.execute(`UPDATE zen_workspaces SET is_default = 0 WHERE uuid != :uuid`, { uuid });

        // Collect UUIDs of workspaces that were unset as default
        const unsetDefaultRows = await db.execute(`SELECT uuid FROM zen_workspaces WHERE is_default = 0 AND uuid != :uuid`, {
          uuid,
        });
        for (const row of unsetDefaultRows) {
          changedUUIDs.push(row.getResultByName('uuid'));
        }

        // Set the default flag for the specified workspace
        await db.execute(`UPDATE zen_workspaces SET is_default = 1 WHERE uuid = :uuid`, { uuid });

        // Record the change for the specified workspace
        await db.execute(
          `
          INSERT OR REPLACE INTO zen_workspaces_changes (uuid, timestamp)
          VALUES (:uuid, :timestamp)
        `,
          {
            uuid,
            timestamp: Math.floor(now / 1000),
          }
        );

        // Add the main workspace UUID to the changed set
        changedUUIDs.push(uuid);

        await this.updateLastChangeTimestamp(db);
      });
    });

    if (notifyObservers) {
      this._notifyWorkspacesChanged('zen-workspace-updated', changedUUIDs);
    }
  },

  async markChanged(uuid) {
    await this.lazy.PlacesUtils.withConnectionWrapper('ZenWorkspacesStorage.markChanged', async (db) => {
      const now = Date.now();
      await db.execute(
        `
        INSERT OR REPLACE INTO zen_workspaces_changes (uuid, timestamp)
        VALUES (:uuid, :timestamp)
      `,
        {
          uuid,
          timestamp: Math.floor(now / 1000),
        }
      );
    });
  },

  async saveWorkspaceTheme(uuid, theme, notifyObservers = true) {
    const changedUUIDs = [uuid];
    await this.lazy.PlacesUtils.withConnectionWrapper('saveWorkspaceTheme', async (db) => {
      await db.execute(
        `
        UPDATE zen_workspaces
        SET
          theme_type = :type,
          theme_colors = :colors,
          theme_opacity = :opacity,
          theme_rotation = :rotation,
          theme_texture = :texture,
          updated_at = :now
        WHERE uuid = :uuid
      `,
        {
          type: theme.type,
          colors: JSON.stringify(theme.gradientColors),
          opacity: theme.opacity,
          rotation: theme.rotation,
          texture: theme.texture,
          now: Date.now(),
          uuid,
        }
      );

      await this.markChanged(uuid);
      await this.updateLastChangeTimestamp(db);
    });

    if (notifyObservers) {
      this._notifyWorkspacesChanged('zen-workspace-updated', changedUUIDs);
    }
  },

  async getChangedIDs() {
    const db = await this.lazy.PlacesUtils.promiseDBConnection();
    const rows = await db.execute(`
      SELECT uuid, timestamp FROM zen_workspaces_changes
    `);
    const changes = {};
    for (const row of rows) {
      changes[row.getResultByName('uuid')] = row.getResultByName('timestamp');
    }
    return changes;
  },

  async clearChangedIDs() {
    await this.lazy.PlacesUtils.withConnectionWrapper('ZenWorkspacesStorage.clearChangedIDs', async (db) => {
      await db.execute(`DELETE FROM zen_workspaces_changes`);
    });
  },

  shouldReorderWorkspaces(before, current, after) {
    const minGap = 1; // Minimum allowed gap between positions
    return (before !== null && current - before < minGap) || (after !== null && after - current < minGap);
  },

  async reorderAllWorkspaces(db, changedUUIDs) {
    const workspaces = await db.execute(`
      SELECT uuid
      FROM zen_workspaces
      ORDER BY "position" ASC
    `);

    for (let i = 0; i < workspaces.length; i++) {
      const newPosition = (i + 1) * 1000; // Use large increments
      await db.execute(
        `
        UPDATE zen_workspaces
        SET "position" = :newPosition
        WHERE uuid = :uuid
      `,
        { newPosition, uuid: workspaces[i].getResultByName('uuid') }
      );
      changedUUIDs.add(workspaces[i].getResultByName('uuid'));
    }
  },

  async updateLastChangeTimestamp(db) {
    const now = Date.now();
    await db.execute(
      `
      INSERT OR REPLACE INTO moz_meta (key, value)
    VALUES ('zen_workspaces_last_change', :now)
    `,
      { now }
    );
  },

  async getLastChangeTimestamp() {
    const db = await this.lazy.PlacesUtils.promiseDBConnection();
    const result = await db.executeCached(`
      SELECT value FROM moz_meta WHERE key = 'zen_workspaces_last_change'
    `);
    return result.length ? parseInt(result[0].getResultByName('value'), 10) : 0;
  },

  async updateWorkspacePositions(workspaces) {
    const changedUUIDs = new Set();

    await this.lazy.PlacesUtils.withConnectionWrapper('ZenWorkspacesStorage.updateWorkspacePositions', async (db) => {
      await db.executeTransaction(async () => {
        const now = Date.now();

        for (let i = 0; i < workspaces.length; i++) {
          const workspace = workspaces[i];
          const newPosition = (i + 1) * 1000;

          await db.execute(
            `
          UPDATE zen_workspaces
          SET "position" = :newPosition
          WHERE uuid = :uuid
        `,
            { newPosition, uuid: workspace.uuid }
          );

          changedUUIDs.add(workspace.uuid);

          // Record the change
          await db.execute(
            `
          INSERT OR REPLACE INTO zen_workspaces_changes (uuid, timestamp)
          VALUES (:uuid, :timestamp)
        `,
            {
              uuid: workspace.uuid,
              timestamp: Math.floor(now / 1000),
            }
          );
        }

        await this.updateLastChangeTimestamp(db);
      });
    });

    this._notifyWorkspacesChanged('zen-workspace-updated', Array.from(changedUUIDs));
  },
};

// Integration of workspace-specific bookmarks into Places
var ZenWorkspaceBookmarksStorage = {
  async init() {
    await this._ensureTable();
  },

  async _ensureTable() {
    await ZenWorkspacesStorage.lazy.PlacesUtils.withConnectionWrapper('ZenWorkspaceBookmarksStorage.init', async (db) => {
      // Create table using GUIDs instead of IDs
      await db.execute(`
        CREATE TABLE IF NOT EXISTS zen_bookmarks_workspaces (
          id INTEGER PRIMARY KEY,
          bookmark_guid TEXT NOT NULL,
          workspace_uuid TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          UNIQUE(bookmark_guid, workspace_uuid),
          FOREIGN KEY(workspace_uuid) REFERENCES zen_workspaces(uuid) ON DELETE CASCADE,
          FOREIGN KEY(bookmark_guid) REFERENCES moz_bookmarks(guid) ON DELETE CASCADE
          )
      `);

      // Create index for fast lookups
      await db.execute(`
        CREATE INDEX IF NOT EXISTS idx_bookmarks_workspaces_lookup
          ON zen_bookmarks_workspaces(workspace_uuid, bookmark_guid)
      `);

      // Add changes tracking table
      await db.execute(`
        CREATE TABLE IF NOT EXISTS zen_bookmarks_workspaces_changes (
          id INTEGER PRIMARY KEY,
          bookmark_guid TEXT NOT NULL,
          workspace_uuid TEXT NOT NULL,
          change_type TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          UNIQUE(bookmark_guid, workspace_uuid),
          FOREIGN KEY(workspace_uuid) REFERENCES zen_workspaces(uuid) ON DELETE CASCADE,
          FOREIGN KEY(bookmark_guid) REFERENCES moz_bookmarks(guid) ON DELETE CASCADE
          )
      `);

      // Create index for changes tracking
      await db.execute(`
        CREATE INDEX IF NOT EXISTS idx_bookmarks_workspaces_changes
          ON zen_bookmarks_workspaces_changes(bookmark_guid, workspace_uuid)
      `);
    });
  },

  /**
   * Updates the last change timestamp in the metadata table.
   * @param {Object} db - The database connection.
   */
  async updateLastChangeTimestamp(db) {
    const now = Date.now();
    await db.execute(
      `
      INSERT OR REPLACE INTO moz_meta (key, value)
      VALUES ('zen_bookmarks_workspaces_last_change', :now)
    `,
      { now }
    );
  },

  /**
   * Gets the timestamp of the last change.
   * @returns {Promise<number>} The timestamp of the last change.
   */
  async getLastChangeTimestamp() {
    const db = await ZenWorkspacesStorage.lazy.PlacesUtils.promiseDBConnection();
    const result = await db.executeCached(`
      SELECT value FROM moz_meta WHERE key = 'zen_bookmarks_workspaces_last_change'
    `);
    return result.length ? parseInt(result[0].getResultByName('value'), 10) : 0;
  },

  async getBookmarkWorkspaces(bookmarkGuid) {
    const db = await ZenWorkspacesStorage.lazy.PlacesUtils.promiseDBConnection();

    const rows = await db.execute(
      `
      SELECT workspace_uuid
      FROM zen_bookmarks_workspaces
      WHERE bookmark_guid = :bookmark_guid
    `,
      { bookmark_guid: bookmarkGuid }
    );

    return rows.map((row) => row.getResultByName('workspace_uuid'));
  },

  /**
   * Get all bookmark GUIDs organized by workspace UUID.
   * @returns {Promise<Object>} A dictionary with workspace UUIDs as keys and arrays of bookmark GUIDs as values.
   * @example
   * // Returns:
   * {
   *   "workspace-uuid-1": ["bookmark-guid-1", "bookmark-guid-2"],
   *   "workspace-uuid-2": ["bookmark-guid-3"]
   * }
   */
  async getBookmarkGuidsByWorkspace() {
    const db = await ZenWorkspacesStorage.lazy.PlacesUtils.promiseDBConnection();

    const rows = await db.execute(`
      SELECT workspace_uuid, GROUP_CONCAT(bookmark_guid) as bookmark_guids
      FROM zen_bookmarks_workspaces
      GROUP BY workspace_uuid
    `);

    const result = {};
    for (const row of rows) {
      const workspaceUuid = row.getResultByName('workspace_uuid');
      const bookmarkGuids = row.getResultByName('bookmark_guids');
      result[workspaceUuid] = bookmarkGuids ? bookmarkGuids.split(',') : [];
    }

    return result;
  },

  /**
   * Get all changed bookmarks with their change types.
   * @returns {Promise<Object>} An object mapping bookmark+workspace pairs to their change data.
   */
  async getChangedIDs() {
    const db = await ZenWorkspacesStorage.lazy.PlacesUtils.promiseDBConnection();
    const rows = await db.execute(`
      SELECT bookmark_guid, workspace_uuid, change_type, timestamp
      FROM zen_bookmarks_workspaces_changes
    `);

    const changes = {};
    for (const row of rows) {
      const key = `${row.getResultByName('bookmark_guid')}:${row.getResultByName('workspace_uuid')}`;
      changes[key] = {
        type: row.getResultByName('change_type'),
        timestamp: row.getResultByName('timestamp'),
      };
    }
    return changes;
  },

  /**
   * Clear all recorded changes.
   */
  async clearChangedIDs() {
    await ZenWorkspacesStorage.lazy.PlacesUtils.withConnectionWrapper(
      'ZenWorkspaceBookmarksStorage.clearChangedIDs',
      async (db) => {
        await db.execute(`DELETE FROM zen_bookmarks_workspaces_changes`);
      }
    );
  },
};

ZenWorkspacesStorage.promiseDBInitialized = new Promise((resolve) => {
  ZenWorkspacesStorage._resolveDBInitialized = resolve;
  ZenWorkspacesStorage.init();
});
