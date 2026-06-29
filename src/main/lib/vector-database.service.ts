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

    // Drop any old virtual table created with the broken named-primary-key schema.
    this.db.exec('DROP TABLE IF EXISTS vec_embeddings');

    // sqlite-vec 0.1.x vec0 tables:
    //  - Only support plain INSERT (no explicit rowid, no UPSERT, no ON CONFLICT).
    //  - Deletes work via `rowid`.
    //  - We track document_id → rowid in a companion regular table.
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS vec_embeddings USING vec0(
        embedding FLOAT[768]
      );
    `);

    // Companion table: maps Prisma document IDs to vec_embeddings rowids.
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

    // vec0 KNN syntax: WHERE embedding MATCH ? AND k = ?
    let query = `
      SELECT
        m.document_id,
        v.distance
      FROM vec_embeddings v
      JOIN vec_embeddings_map m ON m.vec_rowid = v.rowid
      WHERE v.embedding MATCH ?
        AND v.k = ?
    `;
    const params: any[] = [JSON.stringify(queryEmbedding), limit];

    if (maxDistance !== undefined) {
      query += ' AND v.distance <= ?';
      params.push(maxDistance);
    }

    return this.db.prepare(query).all(...params) as Array<{ document_id: number; distance: number }>;
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
