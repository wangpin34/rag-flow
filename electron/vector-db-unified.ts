import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';

/**
 * Unified VectorDatabase that can share the same SQLite file with Prisma
 * This version only manages vector embeddings, letting Prisma handle documents
 */
export class VectorDatabase {
  private db: Database.Database;
  private ownConnection: boolean;

  constructor(dbPathOrInstance?: string | Database.Database) {
    if (!dbPathOrInstance) {
      // Default: use same path as Prisma
      this.db = new Database('./dev.db');
      this.ownConnection = true;
    } else if (typeof dbPathOrInstance === 'string') {
      this.db = new Database(dbPathOrInstance);
      this.ownConnection = true;
    } else {
      // Reuse existing connection
      this.db = dbPathOrInstance;
      this.ownConnection = false;
    }
    
    // Load sqlite-vec extension
    sqliteVec.load(this.db);
    
    // Initialize vector tables only
    this.initializeSchema();
  }

  private initializeSchema() {
    // Create vector embedding table
    // Links to Prisma's documents table via document_id
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS vec_embeddings USING vec0(
        document_id INTEGER PRIMARY KEY,
        embedding FLOAT[768]
      );
      
      -- Optional: Create an index for faster lookups
      -- (vec0 tables already have efficient similarity search)
    `);
  }

  /**
   * Insert or update a vector embedding for a document
   * @param documentId - The ID from Prisma's documents table
   * @param embedding - The vector embedding (array of floats)
   */
  insertEmbedding(documentId: number, embedding: number[]) {
    const stmt = this.db.prepare(`
      INSERT INTO vec_embeddings (document_id, embedding) 
      VALUES (?, ?)
      ON CONFLICT(document_id) DO UPDATE SET embedding = excluded.embedding
    `);
    
    stmt.run(documentId, JSON.stringify(embedding));
    return documentId;
  }

  /**
   * Batch insert multiple embeddings
   */
  insertEmbeddingsBatch(embeddings: Array<{ documentId: number; embedding: number[] }>) {
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
   * Returns document IDs and distances (use Prisma to fetch full documents)
   * @param queryEmbedding - The query vector embedding
   * @param limit - Maximum number of results to return
   * @param maxDistance - Optional maximum distance threshold
   */
  searchSimilar(queryEmbedding: number[], limit: number = 10, maxDistance?: number) {
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
  getEmbedding(documentId: number) {
    const stmt = this.db.prepare(
      'SELECT document_id, embedding FROM vec_embeddings WHERE document_id = ?'
    );
    return stmt.get(documentId);
  }

  /**
   * Check if a document has an embedding
   */
  hasEmbedding(documentId: number): boolean {
    const stmt = this.db.prepare(
      'SELECT 1 FROM vec_embeddings WHERE document_id = ? LIMIT 1'
    );
    return stmt.get(documentId) !== undefined;
  }

  /**
   * Delete an embedding
   */
  deleteEmbedding(documentId: number) {
    const stmt = this.db.prepare('DELETE FROM vec_embeddings WHERE document_id = ?');
    stmt.run(documentId);
  }

  /**
   * Delete multiple embeddings
   */
  deleteEmbeddingsBatch(documentIds: number[]) {
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
    const result = this.db.prepare(
      'SELECT COUNT(*) as count FROM vec_embeddings'
    ).get() as { count: number };
    return result.count;
  }

  /**
   * Get all embeddings (for migration/backup)
   */
  getAllEmbeddings() {
    const stmt = this.db.prepare('SELECT document_id, embedding FROM vec_embeddings');
    return stmt.all();
  }

  /**
   * Clear all embeddings
   */
  clearAllEmbeddings() {
    this.db.exec('DELETE FROM vec_embeddings');
  }

  /**
   * Close the database connection (only if we own it)
   */
  close() {
    if (this.ownConnection) {
      this.db.close();
    }
  }

  /**
   * Get the underlying database instance (for advanced usage)
   */
  getDatabase(): Database.Database {
    return this.db;
  }
}

/**
 * Singleton instance using Prisma's database file
 */
let instance: VectorDatabase | null = null;

export function getVectorDatabase(): VectorDatabase {
  if (!instance) {
    instance = new VectorDatabase('./dev.db');
  }
  return instance;
}
