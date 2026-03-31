export class RagSchemaManager {
    constructor(db) {
        this.db = db;
        this.fts5Available = false;
    }
    createTables() {
        this.db.run(`
			CREATE TABLE IF NOT EXISTS rag_chunks (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				source_type TEXT NOT NULL,
				source_id TEXT NOT NULL,
				chunk_index INTEGER NOT NULL,
				content TEXT NOT NULL,
				heading_breadcrumb TEXT DEFAULT '',
				token_count INTEGER DEFAULT 0,
				content_hash TEXT NOT NULL,
				embedding BLOB,
				created_at INTEGER NOT NULL,
				UNIQUE(source_type, source_id, chunk_index)
			)
		`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_rag_chunks_source ON rag_chunks(source_type, source_id)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_rag_chunks_embedded ON rag_chunks(embedding IS NOT NULL)`);
        this.db.run(`
			CREATE TABLE IF NOT EXISTS rag_index_meta (
				source_type TEXT NOT NULL,
				source_id TEXT NOT NULL,
				content_hash TEXT NOT NULL,
				mtime INTEGER NOT NULL,
				chunk_count INTEGER DEFAULT 0,
				indexed_at INTEGER NOT NULL,
				PRIMARY KEY(source_type, source_id)
			)
		`);
        this.createFts5();
    }
    createFts5() {
        try {
            this.db.run(`
				CREATE VIRTUAL TABLE IF NOT EXISTS rag_chunks_fts USING fts5(
					content, heading_breadcrumb,
					content='rag_chunks', content_rowid='id'
				)
			`);
            this.db.run(`
				CREATE TRIGGER IF NOT EXISTS rag_chunks_ai AFTER INSERT ON rag_chunks BEGIN
					INSERT INTO rag_chunks_fts(rowid, content, heading_breadcrumb)
					VALUES (new.id, new.content, new.heading_breadcrumb);
				END
			`);
            this.db.run(`
				CREATE TRIGGER IF NOT EXISTS rag_chunks_ad AFTER DELETE ON rag_chunks BEGIN
					INSERT INTO rag_chunks_fts(rag_chunks_fts, rowid, content, heading_breadcrumb)
					VALUES('delete', old.id, old.content, old.heading_breadcrumb);
				END
			`);
            this.db.run(`
				CREATE TRIGGER IF NOT EXISTS rag_chunks_au AFTER UPDATE ON rag_chunks BEGIN
					INSERT INTO rag_chunks_fts(rag_chunks_fts, rowid, content, heading_breadcrumb)
					VALUES('delete', old.id, old.content, old.heading_breadcrumb);
					INSERT INTO rag_chunks_fts(rowid, content, heading_breadcrumb)
					VALUES (new.id, new.content, new.heading_breadcrumb);
				END
			`);
            this.db.run(`INSERT INTO rag_chunks_fts(rag_chunks_fts) VALUES('rebuild')`);
            this.fts5Available = true;
        }
        catch (e) {
            console.error("[True Recall] RAG FTS5 setup failed — keyword search will be unavailable:", e);
        }
    }
}
