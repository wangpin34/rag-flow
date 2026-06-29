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

    // Only drop and recreate if the OLD broken schema exists (had a named
    // document_id PRIMARY KEY column). Do NOT drop unconditionally — that
    // would wipe all stored embeddings on every app restart.
    const existingDef = (this.db.prepare(
      "SELECT sql FROM sqlite_master WHERE name = 'vec_embeddings' AND type = 'table'"
    ).get() as { sql: string } | undefined)?.sql ?? '';

    if (existingDef.includes('document_id')) {
      // Old schema — tear everything down so we can start fresh.
      this.db.exec('DROP TABLE IF EXISTS vec_embeddings');
      this.db.exec('DROP TABLE IF EXISTS vec_embeddings_map');
      console.log('⚠ Dropped old vec_embeddings schema (had named document_id column)');
    }

    // sqlite-vec 0.1.x vec0: only plain INSERT supported (no explicit rowid,
    // no UPSERT, no ON CONFLICT). We map document_id → vec rowid ourselves.
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS vec_embeddings USING vec0(
        embedding FLOAT[768]
      );
    `);

    // Companion table that maps Prisma document IDs to vec_embeddings rowids.
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS vec_embeddings_map (
        document_id INTEGER PRIMARY KEY,
        vec_rowid   INTEGER NOT NULL
      );
    `);
  }

  /**
   * Insert or update a vector embedding for a document.
   */
  insertEmbedding(documentId: number, embedding: number[]): void {
    if (!this.db) throw new Error('Database not connected');

    const embJson = JSON.stringify(embedding);

    // If a row already exists, delete the old vec row first.
    const existing = this.db.prepare(
      'SELECT vec_rowid FROM vec_embeddings_map WHERE document_id = ?'
    ).get(documentId) as { vec_rowid: number } | undefined;

    if (existing) {
      this.db.prepare('DELETE FROM vec_embeddings WHERE rowid = ?').run(existing.vec_rowid);
      this.db.prepare('DELETE FROM vec_embeddings_map WHERE document_id = ?').run(documentId);
    }

    // Plain INSERT — no explicit rowid, no conflict clause.
    this.db.prepare('INSERT INTO vec_embeddings(embedding) VALUES (?)').run(embJson);
    const vecRowid = (this.db.prepare('SELECT last_insert_rowid() AS r').get() as { r: number }).r;
    this.db.prepare('INSERT INTO vec_embeddings_map(document_id, vec_rowid) VALUES (?, ?)').run(documentId, vecRowid);
  }

  /**
   * Batch insert multiple embeddings
   */
  insertEmbeddingsBatch(embeddings: Array<{ documentId: number; embedding: number[] }>): void {
    if (!this.db) throw new Error('Database not connected');

    const getMap = this.db.prepare('SELECT vec_rowid FROM vec_embeddings_map WHERE document_id = ?');
    const delVec = this.db.prepare('DELETE FROM vec_embeddings WHERE rowid = ?');
    const delMap = this.db.prepare('DELETE FROM vec_embeddings_map WHERE document_id = ?');
    const insVec = this.db.prepare('INSERT INTO vec_embeddings(embedding) VALUES (?)');
    const lastId = this.db.prepare('SELECT last_insert_rowid() AS r');
    const insMap = this.db.prepare('INSERT INTO vec_embeddings_map(document_id, vec_rowid) VALUES (?, ?)');

    const transaction = this.db.transaction((items: typeof embeddings) => {
      for (const item of items) {
        const existing = getMap.get(item.documentId) as { vec_rowid: number } | undefined;
        if (existing) {
          delVec.run(existing.vec_rowid);
          delMap.run(item.documentId);
        }
        insVec.run(JSON.stringify(item.embedding));
        const vecRowid = (lastId.get() as { r: number }).r;
        insMap.run(item.documentId, vecRowid);
      }
    });

    transaction(embeddings);
  }

  /**
   * Search for similar documents using vector similarity
   */
  searchSimilar(
    queryEmbedding: number[],
    limit: number = 10,
    maxDistance?: number
  ): Array<{ document_id: number; distance: number }> {
    if (!this.db) throw new Error('Database not connected');

    // vec0 KNN queries MUST be a simple SELECT on the virtual table alone —
    // JOINs inside the KNN query prevent the optimizer from using the index
    // and return empty results. Run KNN first, then resolve document_ids.
    const knnRows = this.db.prepare(`
      SELECT rowid, distance
      FROM vec_embeddings
      WHERE embedding MATCH ?
        AND k = ?
    `).all(JSON.stringify(queryEmbedding), limit) as Array<{ rowid: number; distance: number }>;

    if (!knnRows.length) return [];

    const mapStmt = this.db.prepare(
      'SELECT document_id FROM vec_embeddings_map WHERE vec_rowid = ?'
    );

    const results: Array<{ document_id: number; distance: number }> = [];
    for (const row of knnRows) {
      if (maxDistance !== undefined && row.distance > maxDistance) continue;
      const mapped = mapStmt.get(row.rowid) as { document_id: number } | undefined;
      if (mapped) results.push({ document_id: mapped.document_id, distance: row.distance });
    }
    return results;
  }

  /**
   * Get embedding for a specific document
   */
  getEmbedding(documentId: number): any {
    if (!this.db) throw new Error('Database not connected');

    return this.db.prepare(`
      SELECT m.document_id, v.embedding
      FROM vec_embeddings v
      JOIN vec_embeddings_map m ON m.vec_rowid = v.rowid
      WHERE m.document_id = ?
    `).get(documentId);
  }

  /**
   * Check if a document has an embedding
   */
  hasEmbedding(documentId: number): boolean {
    if (!this.db) throw new Error('Database not connected');

    return this.db.prepare(
      'SELECT 1 FROM vec_embeddings_map WHERE document_id = ? LIMIT 1'
    ).get(documentId) !== undefined;
  }

  /**
   * Delete an embedding
   */
  deleteEmbedding(documentId: number): void {
    if (!this.db) throw new Error('Database not connected');

    const row = this.db.prepare(
      'SELECT vec_rowid FROM vec_embeddings_map WHERE document_id = ?'
    ).get(documentId) as { vec_rowid: number } | undefined;

    if (row) {
      this.db.prepare('DELETE FROM vec_embeddings WHERE rowid = ?').run(row.vec_rowid);
      this.db.prepare('DELETE FROM vec_embeddings_map WHERE document_id = ?').run(documentId);
    }
  }

  /**
   * Delete multiple embeddings
   */
  deleteEmbeddingsBatch(documentIds: number[]): void {
    if (!this.db) throw new Error('Database not connected');

    const getMap = this.db.prepare('SELECT vec_rowid FROM vec_embeddings_map WHERE document_id = ?');
    const delVec = this.db.prepare('DELETE FROM vec_embeddings WHERE rowid = ?');
    const delMap = this.db.prepare('DELETE FROM vec_embeddings_map WHERE document_id = ?');

    const transaction = this.db.transaction((ids: number[]) => {
      for (const id of ids) {
        const row = getMap.get(id) as { vec_rowid: number } | undefined;
        if (row) {
          delVec.run(row.vec_rowid);
          delMap.run(id);
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
