# Plan: Modern Sync Architecture for Obsidian Episteme

## Target Requirements

- **Scale:** 10,000+ cards - Memory and performance critical
- **Sync:** Multiple services (iCloud, Obsidian Sync, Dropbox, OneDrive) - Universal conflict handling
- **History:** Cross-card queries needed - Separate reviews table required

---

## Current Solution Analysis

### Your Current Approach (`sharded-store.service.ts`)

- **256 sharded JSON files** (00.json to ff.json) in `.episteme/store/`
- Cards assigned to shards by first 2 chars of UUID
- In-memory cache for O(1) lookups
- Dirty tracking for minimal I/O
- Debounced writes (2 seconds) to reduce sync conflicts
- Last-review-wins conflict resolution

### Problems with Current Approach

1. **Still 256 files to sync** - Cloud sync struggles with many small files
2. **No ACID guarantees** - JSON files can get corrupted during writes
3. **Basic conflict resolution** - Last-review-wins can lose data
4. **Manual merge logic** - You're maintaining custom sync code
5. **No real-time sync** - Polling/reload required for multi-device

---

## Recommended Solution: SQLite with File-Based Sync

**Why SQLite is perfect for your use case:**

| Benefit               | Why it matters for you                              |
| --------------------- | --------------------------------------------------- |
| **Single .db file**   | Syncs perfectly with Obsidian Sync, iCloud, Dropbox |
| **Cross-platform**    | Works on Electron (desktop), iOS, Android, Web      |
| **ACID transactions** | No corrupted data, even if app crashes mid-write    |
| **Fast queries**      | Index on `due` date makes queue building instant    |
| **Proven technology** | Used by Anki (10M+ users), Adobe Lightroom, Bento   |
| **Easy migration**    | One-time conversion from your 256 JSON files        |

**Recommended Library: `sql.js`**

Why `sql.js` over `better-sqlite3`:

- Pure JavaScript (no native compilation needed)
- Works everywhere: Electron, iOS, Android, Browser
- Same SQLite engine you know and love
- Loads entire DB into memory, exports to single file

**Important: sql.js Behavior**

sql.js is a WASM build that:
- Loads the entire database into memory on startup
- All operations happen in memory
- You export the full database to a single `.db` file when saving
- **Does NOT create WAL/SHM files** (unlike native SQLite)

---

## Performance Targets (10K+ cards)

| Operation | Target |
|-----------|--------|
| Initial load (10K cards) | < 2 seconds |
| Query due cards | < 100ms |
| Save to disk | < 500ms |
| Conflict merge | < 3 seconds |
| Memory usage | < 100 MB |

**Memory Estimates:**
- Cards table: ~5-10 MB (500-1000 bytes/card for 10K cards)
- Reviews loaded on-demand (not cached in memory)
- Total in-memory: **~10-20 MB** (cards only)

---

## Phase 0: Test Plugin (Realistic Scale)

**Goal:** Verify sql.js sync works across devices at production scale.

**Location:** `test/sqlite-test-plugin/`

### Test Plugin Must Include

1. **Generate 10,000 test cards** with random UUIDs
2. **Generate 50,000 review entries** (5 per card average)
3. **Measure and report:**
   - Database file size
   - Load time (memory population)
   - Query time (due cards, review history)
   - Export/save time
   - Memory usage

4. **Conflict file detection test:**
   - Manually create conflict files (see patterns below)
   - Verify detection and merge works

### Conflict File Patterns by Service

| Service | Conflict Pattern |
|---------|-----------------|
| iCloud | `filename (conflict).ext` |
| Dropbox | `filename (conflicted copy YYYY-MM-DD).ext` |
| OneDrive | `filename-DEVICE.ext` |
| Obsidian Sync | Handles internally (usually no conflict files) |

**Universal detection function:**
```typescript
function isConflictFile(filename: string): boolean {
  const patterns = [
    /\(conflict\)/i,           // iCloud
    /\(conflicted copy/i,      // Dropbox
    /-[A-Z0-9]{8,}\./,         // OneDrive device suffix
  ];
  return patterns.some(p => p.test(filename));
}
```

### Testing Checklist

1. **Desktop tests (macOS):**
   - [ ] Plugin loads without errors
   - [ ] 10K cards load in < 2 seconds
   - [ ] Query due cards in < 100ms
   - [ ] Save to disk in < 500ms
   - [ ] Memory usage < 100 MB

2. **Sync tests (all services):**
   - [ ] Modify on Desktop A
   - [ ] Sync via iCloud/Dropbox/Obsidian Sync
   - [ ] Load on Device B → changes visible
   - [ ] Conflict file detection works

3. **Conflict test:**
   - [ ] Create `episteme (conflict).db` manually
   - [ ] Plugin detects and merges it
   - [ ] Conflict file is deleted after merge

### Decision Point After Testing

**If sync works well:** Proceed with full SQLite implementation
**If issues:** Consider CRDT-based alternative

---

## Implementation Plan: SQLite Store

### File Structure

```
.episteme/
  episteme.db              # Single SQLite database (replaces 256 .json files)
  stats.json               # Keep daily stats separate (simpler, less conflict risk)
```

**Note:** sql.js does NOT create WAL/SHM files. Single `.db` file only.

---

### Phase 1: Add Dependencies

```bash
npm install sql.js
```

---

### Phase 2: Database Schema

```sql
-- Use PRAGMA for schema version (simpler than a table)
-- Check: PRAGMA user_version;
-- Set:   PRAGMA user_version = 1;

-- Main cards table
CREATE TABLE cards (
    id TEXT PRIMARY KEY,              -- UUID
    due TEXT NOT NULL,                -- ISO date string
    stability REAL,
    difficulty REAL,
    reps INTEGER,
    lapses INTEGER,
    state INTEGER,                    -- 0=New, 1=Learning, 2=Review, 3=Relearning
    last_review TEXT,                 -- ISO date string or NULL
    scheduled_days INTEGER,
    learning_step INTEGER,
    suspended INTEGER DEFAULT 0,      -- 0 or 1
    buried_until TEXT,
    created_at INTEGER,               -- Unix timestamp ms
    -- Sync/conflict resolution fields
    _device_id TEXT,                  -- Track which device last modified
    _modified_at INTEGER              -- Unix timestamp for conflict resolution
);

-- Separate reviews table (enables cross-card queries, lazy loading)
CREATE TABLE reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,       -- Unix ms
    rating INTEGER NOT NULL,          -- 1=Again, 2=Hard, 3=Good, 4=Easy
    scheduled_days INTEGER,
    elapsed_days INTEGER,
    FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
);

-- Performance indexes
CREATE INDEX idx_cards_due ON cards(due);
CREATE INDEX idx_cards_state ON cards(state);
CREATE INDEX idx_cards_suspended ON cards(suspended) WHERE suspended = 0;
CREATE INDEX idx_cards_modified ON cards(_modified_at);

CREATE INDEX idx_reviews_card ON reviews(card_id);
CREATE INDEX idx_reviews_timestamp ON reviews(timestamp);
CREATE INDEX idx_reviews_card_time ON reviews(card_id, timestamp);
```

**Why separate reviews table:**
- Query reviews across all cards (analytics)
- Lazy load history per card (memory savings)
- Efficient date-range queries
- Smaller cards table = faster sync

**Example queries enabled:**
```sql
-- All reviews from last week
SELECT * FROM reviews WHERE timestamp > ? ORDER BY timestamp;

-- Review count by day
SELECT date(timestamp/1000, 'unixepoch') as day, COUNT(*)
FROM reviews GROUP BY day;

-- Cards reviewed most
SELECT card_id, COUNT(*) as review_count
FROM reviews GROUP BY card_id ORDER BY review_count DESC LIMIT 10;

-- Get card with recent reviews
SELECT c.*, r.timestamp, r.rating
FROM cards c
LEFT JOIN reviews r ON c.id = r.card_id
WHERE c.id = ?
ORDER BY r.timestamp DESC LIMIT 20;
```

---

### Phase 3: Create SQLiteStoreService

**New file:** `src/services/persistence/sqlite-store.service.ts`

```typescript
export class SQLiteStoreService {
    private db: Database;
    private deviceId: string;
    private cardCache: Map<string, FSRSCardData> = new Map();
    private dirty: boolean = false;
    private saveTimeout: NodeJS.Timeout | null = null;

    constructor(app: App) {
        this.deviceId = this.generateDeviceId();
    }

    async load(): Promise<void> {
        // 1. Check for conflict files first
        await this.detectAndMergeConflicts();

        // 2. Load SQLite database from .episteme/episteme.db
        // 3. Populate card cache (reviews NOT cached - queried on demand)
    }

    get(cardId: string): FSRSCardData | undefined {
        return this.cardCache.get(cardId);
    }

    set(cardId: string, data: FSRSCardData): void {
        this.cardCache.set(cardId, {
            ...data,
            _device_id: this.deviceId,
            _modified_at: Date.now()
        });
        this.scheduleSave();
    }

    // Reviews queried on-demand (not cached)
    getCardReviews(cardId: string, limit = 20): CardReviewLogEntry[] {
        const result = this.db.exec(
            `SELECT * FROM reviews WHERE card_id = ?
             ORDER BY timestamp DESC LIMIT ?`,
            [cardId, limit]
        );
        return this.parseReviews(result);
    }

    addReview(cardId: string, review: CardReviewLogEntry): void {
        this.db.run(
            `INSERT INTO reviews (card_id, timestamp, rating, scheduled_days, elapsed_days)
             VALUES (?, ?, ?, ?, ?)`,
            [cardId, review.t, review.r, review.s, review.e]
        );
        this.scheduleSave();
    }

    // Debounced save (2 seconds, like current system)
    private scheduleSave(): void {
        this.dirty = true;
        if (this.saveTimeout) clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => this.flush(), 2000);
    }

    async flush(): Promise<void> {
        if (!this.dirty) return;
        const data = this.db.export();
        await this.app.vault.adapter.writeBinary(
            '.episteme/episteme.db',
            data
        );
        this.dirty = false;
    }

    // Conflict detection and merge
    async detectAndMergeConflicts(): Promise<{ merged: number }> {
        const files = await this.listEpistemeFiles();
        const conflictFiles = files.filter(f => this.isConflictFile(f));

        let merged = 0;
        for (const conflictFile of conflictFiles) {
            merged += await this.mergeFromFile(conflictFile);
            await this.deleteFile(conflictFile);
        }
        return { merged };
    }

    private isConflictFile(filename: string): boolean {
        const patterns = [
            /\(conflict\)/i,
            /\(conflicted copy/i,
            /-[A-Z0-9]{8,}\./,
        ];
        return patterns.some(p => p.test(filename));
    }

    private async mergeFromFile(conflictPath: string): Promise<number> {
        const conflictDb = await this.loadDatabase(conflictPath);
        const conflictCards = this.getAllCardsFromDb(conflictDb);

        let merged = 0;
        for (const remoteCard of conflictCards) {
            const localCard = this.cardCache.get(remoteCard.id);
            if (!localCard || remoteCard._modified_at > localCard._modified_at) {
                this.cardCache.set(remoteCard.id, remoteCard);
                merged++;
            }
        }

        // Also merge reviews (dedupe by card_id + timestamp)
        await this.mergeReviews(conflictDb);

        conflictDb.close();
        return merged;
    }
}
```

---

### Phase 4: Migration Path

**New file:** `src/services/persistence/migration.service.ts`

```typescript
export class MigrationService {
    async migrateFromShardsToSQLite(
        shardService: ShardedStoreService,
        sqliteService: SQLiteStoreService
    ): Promise<void> {
        // 1. Create backup BEFORE migration
        await this.copyDir('.episteme/store', '.episteme/store.backup');

        try {
            // 2. Load all cards from sharded store
            const allCards = shardService.getAll();

            // 3. Begin SQLite transaction
            sqliteService.beginTransaction();

            // 4. Insert all cards
            for (const card of allCards) {
                sqliteService.insertCard(card);
                // Also migrate history to reviews table
                if (card.history) {
                    for (const review of card.history) {
                        sqliteService.addReview(card.id, review);
                    }
                }
            }

            // 5. Commit transaction
            sqliteService.commit();

            // 6. Verify: compare counts
            const sqliteCount = sqliteService.getCardCount();
            if (sqliteCount !== allCards.length) {
                throw new Error(`Migration count mismatch: ${allCards.length} → ${sqliteCount}`);
            }

            // 7. Save to disk
            await sqliteService.flush();

            // 8. Delete old shard files (keep backup)
            await this.deleteDir('.episteme/store');

        } catch (e) {
            // Rollback: restore from backup
            sqliteService.rollback();
            await this.deleteFile('.episteme/episteme.db');
            await this.moveDir('.episteme/store.backup', '.episteme/store');
            throw e;
        }
    }
}
```

**Migration workflow:**

1. Plugin startup detects old shard files exist
2. Prompt user: "Migrate to new storage? (recommended)"
3. Run migration with progress indicator
4. On success: remove old files, keep using SQLite
5. On failure: rollback, keep using shards
6. Backup kept at `.episteme/store.backup/` for 30 days

---

### Phase 5: Conflict Resolution Strategy

**File-level conflicts occur when:**
- Device A and Device B both modify the database offline
- Both sync via iCloud/Obsidian Sync
- Sync service creates conflict files

**Our strategy:**

1. **On load:** Scan for conflict files before loading main database
2. **Merge logic:**
   - Compare `_modified_at` timestamps per card
   - Keep newer modification
   - Merge reviews (dedupe by card_id + timestamp)
3. **After merge:** Delete conflict file

**Card merge function:**
```typescript
private mergeCard(local: FSRSCardData, remote: FSRSCardData): FSRSCardData {
    // Keep the newer modification
    if (remote._modified_at > local._modified_at) {
        return remote;
    }
    return local;
}
```

**Review merge (dedupe):**
```typescript
private async mergeReviews(conflictDb: Database): Promise<void> {
    const remoteReviews = this.getAllReviewsFromDb(conflictDb);

    for (const review of remoteReviews) {
        // Check if review already exists (same card + timestamp)
        const exists = this.db.exec(
            `SELECT 1 FROM reviews WHERE card_id = ? AND timestamp = ?`,
            [review.card_id, review.timestamp]
        );

        if (!exists.length) {
            this.addReview(review.card_id, review);
        }
    }
}
```

---

### Phase 6: Files to Modify

**New files:**
- `src/services/persistence/sqlite-store.service.ts`
- `src/services/persistence/migration.service.ts`
- `src/services/persistence/sql-schema.ts` (SQL schema constants)

**Modified files:**
- `src/main.ts` - Initialize SQLiteStoreService instead of ShardedStoreService
- `src/services/flashcard/flashcard.service.ts` - Update to use SQLiteStoreService

**Keep unchanged:**
- `src/services/persistence/session-persistence.service.ts` - Keep stats.json separate

**Can be removed (after migration period):**
- `src/services/persistence/sharded-store.service.ts`

---

### Phase 7: Testing Checklist

1. **Single device:**
   - [ ] Create new cards
   - [ ] Review cards (FSRS updates)
   - [ ] Suspend/bury cards
   - [ ] Query reviews (last week, by card)
   - [ ] Load 10K cards in < 2 seconds

2. **Multi-device sync:**
   - [ ] Modify card on Device A
   - [ ] Sync via iCloud/Obsidian Sync
   - [ ] Load on Device B → changes visible
   - [ ] Conflict file created → merged correctly

3. **Migration:**
   - [ ] Old data migrates correctly
   - [ ] History → reviews table
   - [ ] No data loss
   - [ ] Rollback works on failure

4. **Performance (10K cards):**
   - [ ] Load time < 2 seconds
   - [ ] Due cards query < 100ms
   - [ ] Save to disk < 500ms
   - [ ] Memory < 100 MB

---

## Sources

### SQLite & sql.js

- [sql.js GitHub](https://github.com/sql-js/sql.js) - JavaScript library to run SQLite in the browser
- [Adding SQLite Database Integration to an Obsidian Plugin](https://forum.obsidian.md/t/adding-sqlite-database-integration-to-an-obsidian-plugin/88272)
- [obsidian-plugin-sql](https://github.com/yuhsak/obsidian-plugin-sql) - Sample plugin with SQL capabilities
- [SQLite DB Plugin](https://www.obsidianstats.com/plugins/sqlite-db) - SQLite integration for Obsidian
- [SQLite Wasm in the browser](https://developer.chrome.com/blog/sqlite-wasm-in-the-browser-backed-by-the-origin-private-file-system)

### Mobile Sync Solutions

- [Capacitor Database Guide - RxDB](https://rxdb.info/capacitor-database.html)
- [capacitor-sqlite Community Plugin](https://github.com/asello/capacitor-sqlite)
- [PowerSync 2025 Roadmap](https://www.powersync.com/blog/powersync-2025-roadmap-sqlite-web-speed-and-versatility)
- [Building Offline-First Apps with Sync Capabilities](https://medium.com/@Amanda0/advanced-react-native-development-in-2025-building-offline-first-apps-with-sync-capabilities-c44e760c4a9d)

### CRDT & Sync Libraries

- [PowerSync - Backend DB SQLite sync](https://www.powersync.com/)
- [SQLite.ai - CRDT-powered SQLite sync](https://www.sqlite.ai/)
- [Best CRDT Libraries 2025](https://velt.dev/blog/best-crdt-libraries-real-time-data-sync)
- [Offline-first frontend apps in 2025](https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/)
