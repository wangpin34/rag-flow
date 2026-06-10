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

    // Create vector embedding table
    // Links to Prisma's documents table via document_id
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS vec_embeddings USING vec0(
        document_id INTEGER PRIMARY KEY,
        embedding FLOAT[768]
      );
    `);
  }

  /**
   * Insert or update a vector embedding for a document
   */
  insertEmbedding(documentId: number, embedding: number[]): void {
    if (!this.db) throw new Error('Database not connected');

    const stmt = this.db.prepare(`
      INSERT INTO vec_embeddings (document_id, embedding) 
      VALUES (?, ?)
      ON CONFLICT(document_id) DO UPDATE SET embedding = excluded.embedding
    `);
    
    stmt.run(documentId, JSON.stringify(embedding));
  }

  /**
   * Batch insert multiple embeddings
   */
  insertEmbeddingsBatch(embeddings: Array<{ documentId: number; embedding: number[] }>): void {
    if (!this.db) throw new Error('Database not connected');

    const insert = this.db.prepare(`
      INSERT INTO vec_embeddings (document_id, embedding) VALUES (?, ?)
      ON CONFLICT(document_id) DO UPDATE SET embedding = excluded.embedding
    `);
    
    const transaction = this.db.transaction((items) => {
      for (const item of items) {
        insert.run(item.documentId, JSON.stringify(item.embedding));
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

    let query = `
      SELECT 
        document_id,
        vec_distance_L2(embedding, ?) as distance
      FROM vec_embeddings
    `;
    
    const params: any[] = [JSON.stringify(queryEmbedding)];
    
    if (maxDistance !== undefined) {
      query += ` WHERE vec_distance_L2(embedding, ?) <= ?`;
      params.push(JSON.stringify(queryEmbedding), maxDistance);
    }
    
    query += ` ORDER BY distance LIMIT ?`;
    params.push(limit);
    
    const stmt = this.db.prepare(query);
    return stmt.all(...params) as Array<{ document_id: number; distance: number }>;
  }

  /**
   * Get embedding for a specific document
   */
  getEmbedding(documentId: number): any {
    if (!this.db) throw new Error('Database not connected');

    const stmt = this.db.prepare(
      'SELECT document_id, embedding FROM vec_embeddings WHERE document_id = ?'
    );
    return stmt.get(documentId);
  }

  /**
   * Check if a document has an embedding
   */
  hasEmbedding(documentId: number): boolean {
    if (!this.db) throw new Error('Database not connected');

    const stmt = this.db.prepare(
      'SELECT 1 FROM vec_embeddings WHERE document_id = ? LIMIT 1'
    );
    return stmt.get(documentId) !== undefined;
  }

  /**
   * Delete an embedding
   */
  deleteEmbedding(documentId: number): void {
    if (!this.db) throw new Error('Database not connected');

    const stmt = this.db.prepare('DELETE FROM vec_embeddings WHERE document_id = ?');
    stmt.run(documentId);
  }

  /**
   * Delete multiple embeddings
   */
  deleteEmbeddingsBatch(documentIds: number[]): void {
    if (!this.db) throw new Error('Database not connected');

    const placeholders = documentIds.map(() => '?').join(',');
    const stmt = this.db.prepare(
      `DELETE FROM vec_embeddings WHERE document_id IN (${placeholders})`
    );
    stmt.run(...documentIds);
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
