var ZenPinnedTabsStorage = {
  async init() {
    await this._ensureTable();
  },

  async _ensureTable() {
    await PlacesUtils.withConnectionWrapper('ZenPinnedTabsStorage._ensureTable', async (db) => {
      // Create the pins table if it doesn't exist
      await db.execute(`
        CREATE TABLE IF NOT EXISTS zen_pins (
      id INTEGER PRIMARY KEY,
      uuid TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      url TEXT,
      container_id INTEGER,
      workspace_uuid TEXT,
      position INTEGER NOT NULL DEFAULT 0,
      is_essential BOOLEAN NOT NULL DEFAULT 0,
      is_group BOOLEAN NOT NULL DEFAULT 0,
      parent_uuid TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (parent_uuid) REFERENCES zen_pins(uuid) ON DELETE SET NULL
          )
      `);

      // Create indices
      await db.execute(`
        CREATE INDEX IF NOT EXISTS idx_zen_pins_uuid ON zen_pins(uuid)
      `);

      await db.execute(`
        CREATE INDEX IF NOT EXISTS idx_zen_pins_parent_uuid ON zen_pins(parent_uuid)
      `);

      // Create the changes tracking table if it doesn't exist
      await db.execute(`
        CREATE TABLE IF NOT EXISTS zen_pins_changes (
          uuid TEXT PRIMARY KEY,
          timestamp INTEGER NOT NULL
        )
      `);

      // Create an index on the uuid column for changes tracking table
      await db.execute(`
        CREATE INDEX IF NOT EXISTS idx_zen_pins_changes_uuid ON zen_pins_changes(uuid)
      `);

      await SessionStore.promiseInitialized;
      this._resolveInitialized();
    });
  },

  /**
   * Private helper method to notify observers with a list of changed UUIDs.
   * @param {string} event - The observer event name.
   * @param {Array<string>} uuids - Array of changed workspace UUIDs.
   */
  _notifyPinsChanged(event, uuids) {
    if (uuids.length === 0) return; // No changes to notify

    // Convert the array of UUIDs to a JSON string
    const data = JSON.stringify(uuids);

    Services.obs.notifyObservers(null, event, data);
  },

  async savePin(pin, notifyObservers = true) {
    const changedUUIDs = new Set();

    await PlacesUtils.withConnectionWrapper('ZenPinnedTabsStorage.savePin', async (db) => {
      await db.executeTransaction(async () => {
        const now = Date.now();

        let newPosition;
        if ('position' in pin && Number.isFinite(pin.position)) {
          newPosition = pin.position;
        } else {
          // Get the maximum position within the same parent group (or null for root level)
          const maxPositionResult = await db.execute(
            `
            SELECT MAX("position") as max_position
            FROM zen_pins
            WHERE COALESCE(parent_uuid, '') = COALESCE(:parent_uuid, '')
          `,
            { parent_uuid: pin.parentUuid || null }
          );
          const maxPosition = maxPositionResult[0].getResultByName('max_position') || 0;
          newPosition = maxPosition + 1000;
        }

        // Insert or replace the pin
        await db.executeCached(
          `
          INSERT OR REPLACE INTO zen_pins (
            uuid, title, url, container_id, workspace_uuid, position,
            is_essential, is_group, parent_uuid, created_at, updated_at
          ) VALUES (
            :uuid, :title, :url, :container_id, :workspace_uuid, :position,
            :is_essential, :is_group, :parent_uuid,
            COALESCE((SELECT created_at FROM zen_pins WHERE uuid = :uuid), :now),
            :now
          )
        `,
          {
            uuid: pin.uuid,
            title: pin.title,
            url: pin.isGroup ? null : pin.url,
            container_id: pin.containerTabId || null,
            workspace_uuid: pin.workspaceUuid || null,
            position: newPosition,
            is_essential: pin.isEssential || false,
            is_group: pin.isGroup || false,
            parent_uuid: pin.parentUuid || null,
            now,
          }
        );

        await db.execute(
          `
          INSERT OR REPLACE INTO zen_pins_changes (uuid, timestamp)
          VALUES (:uuid, :timestamp)
        `,
          {
            uuid: pin.uuid,
            timestamp: Math.floor(now / 1000),
          }
        );

        changedUUIDs.add(pin.uuid);
        await this.updateLastChangeTimestamp(db);
      });
    });

    if (notifyObservers) {
      this._notifyPinsChanged('zen-pin-updated', Array.from(changedUUIDs));
    }
  },

  async getPins() {
    const db = await PlacesUtils.promiseDBConnection();
    const rows = await db.executeCached(`
      SELECT * FROM zen_pins
      ORDER BY parent_uuid NULLS FIRST, position ASC
    `);
    return rows.map((row) => ({
      uuid: row.getResultByName('uuid'),
      title: row.getResultByName('title'),
      url: row.getResultByName('url'),
      containerTabId: row.getResultByName('container_id'),
      workspaceUuid: row.getResultByName('workspace_uuid'),
      position: row.getResultByName('position'),
      isEssential: Boolean(row.getResultByName('is_essential')),
      isGroup: Boolean(row.getResultByName('is_group')),
      parentUuid: row.getResultByName('parent_uuid'),
    }));
  },

  async getGroupChildren(groupUuid) {
    const db = await PlacesUtils.promiseDBConnection();
    const rows = await db.executeCached(
      `
      SELECT * FROM zen_pins
      WHERE parent_uuid = :groupUuid
      ORDER BY position ASC
    `,
      { groupUuid }
    );

    return rows.map((row) => ({
      uuid: row.getResultByName('uuid'),
      title: row.getResultByName('title'),
      url: row.getResultByName('url'),
      containerTabId: row.getResultByName('container_id'),
      workspaceUuid: row.getResultByName('workspace_uuid'),
      position: row.getResultByName('position'),
      isEssential: Boolean(row.getResultByName('is_essential')),
      isGroup: Boolean(row.getResultByName('is_group')),
      parentUuid: row.getResultByName('parent_uuid'),
    }));
  },

  async removePin(uuid, notifyObservers = true) {
    const changedUUIDs = [uuid];

    await PlacesUtils.withConnectionWrapper('ZenPinnedTabsStorage.removePin', async (db) => {
      await db.executeTransaction(async () => {
        // Get all child UUIDs first for change tracking
        const children = await db.execute(`SELECT uuid FROM zen_pins WHERE parent_uuid = :uuid`, { uuid });

        // Add child UUIDs to changedUUIDs array
        for (const child of children) {
          changedUUIDs.push(child.getResultByName('uuid'));
        }

        // Delete all children in a single statement
        await db.execute(`DELETE FROM zen_pins WHERE parent_uuid = :uuid`, { uuid });

        // Delete the pin/group itself
        await db.execute(`DELETE FROM zen_pins WHERE uuid = :uuid`, { uuid });

        // Record the changes
        const now = Math.floor(Date.now() / 1000);
        for (const changedUuid of changedUUIDs) {
          await db.execute(
            `
            INSERT OR REPLACE INTO zen_pins_changes (uuid, timestamp)
            VALUES (:uuid, :timestamp)
          `,
            {
              uuid: changedUuid,
              timestamp: now,
            }
          );
        }

        await this.updateLastChangeTimestamp(db);
      });
    });

    if (notifyObservers) {
      this._notifyPinsChanged('zen-pin-removed', changedUUIDs);
    }
  },

  async wipeAllPins() {
    await PlacesUtils.withConnectionWrapper('ZenPinnedTabsStorage.wipeAllPins', async (db) => {
      await db.execute(`DELETE FROM zen_pins`);
      await db.execute(`DELETE FROM zen_pins_changes`);
      await this.updateLastChangeTimestamp(db);
    });
  },

  async markChanged(uuid) {
    await PlacesUtils.withConnectionWrapper('ZenPinnedTabsStorage.markChanged', async (db) => {
      const now = Date.now();
      await db.execute(
        `
        INSERT OR REPLACE INTO zen_pins_changes (uuid, timestamp)
        VALUES (:uuid, :timestamp)
      `,
        {
          uuid,
          timestamp: Math.floor(now / 1000),
        }
      );
    });
  },

  async getChangedIDs() {
    const db = await PlacesUtils.promiseDBConnection();
    const rows = await db.execute(`
      SELECT uuid, timestamp FROM zen_pins_changes
    `);
    const changes = {};
    for (const row of rows) {
      changes[row.getResultByName('uuid')] = row.getResultByName('timestamp');
    }
    return changes;
  },

  async clearChangedIDs() {
    await PlacesUtils.withConnectionWrapper('ZenPinnedTabsStorage.clearChangedIDs', async (db) => {
      await db.execute(`DELETE FROM zen_pins_changes`);
    });
  },

  shouldReorderPins(before, current, after) {
    const minGap = 1; // Minimum allowed gap between positions
    return (before !== null && current - before < minGap) || (after !== null && after - current < minGap);
  },

  async reorderAllPins(db, changedUUIDs) {
    const pins = await db.execute(`
      SELECT uuid
      FROM zen_pins
      ORDER BY position ASC
    `);

    for (let i = 0; i < pins.length; i++) {
      const newPosition = (i + 1) * 1000; // Use large increments
      await db.execute(
        `
        UPDATE zen_pins
        SET position = :newPosition
        WHERE uuid = :uuid
      `,
        { newPosition, uuid: pins[i].getResultByName('uuid') }
      );
      changedUUIDs.add(pins[i].getResultByName('uuid'));
    }
  },

  async updateLastChangeTimestamp(db) {
    const now = Date.now();
    await db.execute(
      `
      INSERT OR REPLACE INTO moz_meta (key, value)
      VALUES ('zen_pins_last_change', :now)
    `,
      { now }
    );
  },

  async getLastChangeTimestamp() {
    const db = await PlacesUtils.promiseDBConnection();
    const result = await db.executeCached(`
      SELECT value FROM moz_meta WHERE key = 'zen_pins_last_change'
    `);
    return result.length ? parseInt(result[0].getResultByName('value'), 10) : 0;
  },

  async updatePinPositions(pins) {
    const changedUUIDs = new Set();

    await PlacesUtils.withConnectionWrapper('ZenPinnedTabsStorage.updatePinPositions', async (db) => {
      await db.executeTransaction(async () => {
        const now = Date.now();

        for (let i = 0; i < pins.length; i++) {
          const pin = pins[i];
          const newPosition = (i + 1) * 1000;

          await db.execute(
            `
            UPDATE zen_pins
            SET position = :newPosition
            WHERE uuid = :uuid
          `,
            { newPosition, uuid: pin.uuid }
          );

          changedUUIDs.add(pin.uuid);

          // Record the change
          await db.execute(
            `
            INSERT OR REPLACE INTO zen_pins_changes (uuid, timestamp)
            VALUES (:uuid, :timestamp)
          `,
            {
              uuid: pin.uuid,
              timestamp: Math.floor(now / 1000),
            }
          );
        }

        await this.updateLastChangeTimestamp(db);
      });
    });

    this._notifyPinsChanged('zen-pin-updated', Array.from(changedUUIDs));
  },

  async __dropTables() {
    await PlacesUtils.withConnectionWrapper('ZenPinnedTabsStorage.__dropTables', async (db) => {
      await db.execute(`DROP TABLE IF EXISTS zen_pins`);
      await db.execute(`DROP TABLE IF EXISTS zen_pins_changes`);
    });
  },
};

ZenPinnedTabsStorage.promiseInitialized = new Promise((resolve) => {
  ZenPinnedTabsStorage._resolveInitialized = resolve;
  ZenPinnedTabsStorage.init();
});
