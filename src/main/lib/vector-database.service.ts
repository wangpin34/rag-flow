import Database from 'better-sqlite3';
import { app } from 'electron';
import { join } from 'path';
import * as sqliteVec from 'sqlite-vec';

/**
 * VectorDatabase service for managing vector embeddings
 * Uses the same SQLite database as Prisma for consistency
 */
class VectorDatabaseService {
  private db: Database.Database | null = null;
  private initialized = false;

  private getDatabasePath(): string {
    if (app.isPackaged) {
      return join(app.getPath('userData'), 'data.db');
    }
    return join(__dirname, '../../../dev.db');
  }

  async connect(): Promise<void> {
    if (this.db) return;

    const dbPath = this.getDatabasePath();
    this.db = new Database(dbPath);
    
    // Load sqlite-vec extension
    sqliteVec.load(this.db);
    
    // Initialize schema
    this.initializeSchema();
    this.initialized = true;
    
    console.log('✓ Vector database connected');
  }

  private initializeSchema(): void {
    if (!this.db) throw new Error('Database not connected');

    // Detect old schema variants and drop them so we can recreate cleanly.
    const mapDef = (this.db.prepare(
      "SELECT sql FROM sqlite_master WHERE name = 'vec_embeddings_map' AND type = 'table'"
    ).get() as { sql: string } | undefined)?.sql ?? '';

    const vecDef = (this.db.prepare(
      "SELECT sql FROM sqlite_master WHERE name = 'vec_embeddings' AND type = 'table'"
    ).get() as { sql: string } | undefined)?.sql ?? '';

    // Drop if old doc-level schema (has document_id but not chunk_id)
    const isOldSchema = vecDef.includes('document_id') || (mapDef && !mapDef.includes('chunk_id'));
    if (isOldSchema) {
      this.db.exec('DROP TABLE IF EXISTS vec_embeddings');
      this.db.exec('DROP TABLE IF EXISTS vec_embeddings_map');
      console.log('⚠ Dropped old vec_embeddings schema (migrating to per-chunk embeddings)');
    }

    // sqlite-vec 0.1.x vec0: only plain INSERT supported (no explicit rowid,
    // no UPSERT, no ON CONFLICT). We map chunk_id → vec rowid ourselves.
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS vec_embeddings USING vec0(
        embedding FLOAT[768]
      );
    `);

    // Companion table: maps Prisma Chunk IDs → vec_embeddings rowids.
    // document_id is stored for efficient bulk-delete when a document is removed.
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS vec_embeddings_map (
        chunk_id    INTEGER PRIMARY KEY,
        document_id INTEGER NOT NULL,
        vec_rowid   INTEGER NOT NULL
      );
    `);
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS vec_embeddings_map_doc_idx
        ON vec_embeddings_map(document_id);
    `);
  }

  /**
   * Insert or update a vector embedding for a chunk.
   */
  insertEmbedding(chunkId: number, embedding: number[], documentId: number): void {
    if (!this.db) throw new Error('Database not connected');

    const embJson = JSON.stringify(embedding);

    // If a row already exists, delete the old vec row first.
    const existing = this.db.prepare(
      'SELECT vec_rowid FROM vec_embeddings_map WHERE chunk_id = ?'
    ).get(chunkId) as { vec_rowid: number } | undefined;

    if (existing) {
      this.db.prepare('DELETE FROM vec_embeddings WHERE rowid = ?').run(existing.vec_rowid);
      this.db.prepare('DELETE FROM vec_embeddings_map WHERE chunk_id = ?').run(chunkId);
    }

    this.db.prepare('INSERT INTO vec_embeddings(embedding) VALUES (?)').run(embJson);
    const vecRowid = (this.db.prepare('SELECT last_insert_rowid() AS r').get() as { r: number }).r;
    this.db.prepare(
      'INSERT INTO vec_embeddings_map(chunk_id, document_id, vec_rowid) VALUES (?, ?, ?)'
    ).run(chunkId, documentId, vecRowid);
  }

  /**
   * Batch insert multiple chunk embeddings inside a single transaction.
   */
  insertEmbeddingsBatch(embeddings: Array<{ chunkId: number; documentId: number; embedding: number[] }>): void {
    if (!this.db) throw new Error('Database not connected');

    const getMap = this.db.prepare('SELECT vec_rowid FROM vec_embeddings_map WHERE chunk_id = ?');
    const delVec = this.db.prepare('DELETE FROM vec_embeddings WHERE rowid = ?');
    const delMap = this.db.prepare('DELETE FROM vec_embeddings_map WHERE chunk_id = ?');
    const insVec = this.db.prepare('INSERT INTO vec_embeddings(embedding) VALUES (?)');
    const lastId = this.db.prepare('SELECT last_insert_rowid() AS r');
    const insMap = this.db.prepare(
      'INSERT INTO vec_embeddings_map(chunk_id, document_id, vec_rowid) VALUES (?, ?, ?)'
    );

    const transaction = this.db.transaction((items: typeof embeddings) => {
      for (const item of items) {
        const existing = getMap.get(item.chunkId) as { vec_rowid: number } | undefined;
        if (existing) {
          delVec.run(existing.vec_rowid);
          delMap.run(item.chunkId);
        }
        insVec.run(JSON.stringify(item.embedding));
        const vecRowid = (lastId.get() as { r: number }).r;
        insMap.run(item.chunkId, item.documentId, vecRowid);
      }
    });

    transaction(embeddings);
  }

  /**
   * Search for similar chunks using vector similarity.
   * Returns chunk_id + document_id + distance for each hit.
   */
  searchSimilar(
    queryEmbedding: number[],
    limit: number = 10,
    maxDistance?: number
  ): Array<{ chunk_id: number; document_id: number; distance: number }> {
    if (!this.db) throw new Error('Database not connected');

    // vec0 KNN queries MUST be a simple SELECT on the virtual table alone.
    const knnRows = this.db.prepare(`
      SELECT rowid, distance
      FROM vec_embeddings
      WHERE embedding MATCH ?
        AND k = ?
    `).all(JSON.stringify(queryEmbedding), limit) as Array<{ rowid: number; distance: number }>;

    if (!knnRows.length) return [];

    const mapStmt = this.db.prepare(
      'SELECT chunk_id, document_id FROM vec_embeddings_map WHERE vec_rowid = ?'
    );

    const results: Array<{ chunk_id: number; document_id: number; distance: number }> = [];
    for (const row of knnRows) {
      if (maxDistance !== undefined && row.distance > maxDistance) continue;
      const mapped = mapStmt.get(row.rowid) as { chunk_id: number; document_id: number } | undefined;
      if (mapped) results.push({ chunk_id: mapped.chunk_id, document_id: mapped.document_id, distance: row.distance });
    }
    return results;
  }

  /**
   * Get embedding for a specific chunk.
   */
  getEmbedding(chunkId: number): any {
    if (!this.db) throw new Error('Database not connected');

    return this.db.prepare(`
      SELECT m.chunk_id, v.embedding
      FROM vec_embeddings v
      JOIN vec_embeddings_map m ON m.vec_rowid = v.rowid
      WHERE m.chunk_id = ?
    `).get(chunkId);
  }

  /**
   * Check if a chunk has an embedding.
   */
  hasEmbedding(chunkId: number): boolean {
    if (!this.db) throw new Error('Database not connected');

    return this.db.prepare(
      'SELECT 1 FROM vec_embeddings_map WHERE chunk_id = ? LIMIT 1'
    ).get(chunkId) !== undefined;
  }

  /**
   * Check if any chunk of a document has been embedded.
   */
  hasDocumentEmbedding(documentId: number): boolean {
    if (!this.db) throw new Error('Database not connected');

    return this.db.prepare(
      'SELECT 1 FROM vec_embeddings_map WHERE document_id = ? LIMIT 1'
    ).get(documentId) !== undefined;
  }

  /**
   * Delete embedding for a single chunk.
   */
  deleteEmbedding(chunkId: number): void {
    if (!this.db) throw new Error('Database not connected');

    const row = this.db.prepare(
      'SELECT vec_rowid FROM vec_embeddings_map WHERE chunk_id = ?'
    ).get(chunkId) as { vec_rowid: number } | undefined;

    if (row) {
      this.db.prepare('DELETE FROM vec_embeddings WHERE rowid = ?').run(row.vec_rowid);
      this.db.prepare('DELETE FROM vec_embeddings_map WHERE chunk_id = ?').run(chunkId);
    }
  }

  /**
   * Delete all chunk embeddings for one or more documents.
   */
  deleteEmbeddingsBatch(documentIds: number[]): void {
    if (!this.db) throw new Error('Database not connected');

    const getChunks = this.db.prepare(
      'SELECT chunk_id, vec_rowid FROM vec_embeddings_map WHERE document_id = ?'
    );
    const delVec = this.db.prepare('DELETE FROM vec_embeddings WHERE rowid = ?');
    const delMap = this.db.prepare('DELETE FROM vec_embeddings_map WHERE chunk_id = ?');

    const transaction = this.db.transaction((ids: number[]) => {
      for (const docId of ids) {
        const rows = getChunks.all(docId) as Array<{ chunk_id: number; vec_rowid: number }>;
        for (const row of rows) {
          delVec.run(row.vec_rowid);
          delMap.run(row.chunk_id);
        }
      }
    });
    transaction(documentIds);
  }

  /**
   * Get total embedding count
   */
  getEmbeddingCount(): number {
    if (!this.db) throw new Error('Database not connected');

    const result = this.db.prepare(
      'SELECT COUNT(*) as count FROM vec_embeddings'
    ).get() as { count: number };
    return result.count;
  }

  /**
   * Clear all embeddings
   */
  clearAllEmbeddings(): void {
    if (!this.db) throw new Error('Database not connected');
    this.db.exec('DELETE FROM vec_embeddings');
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initialized = false;
      console.log('✓ Vector database closed');
    }
  }
}

export const vectorDatabaseService = new VectorDatabaseService();
