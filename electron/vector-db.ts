import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';
import * as sqliteVec from 'sqlite-vec';

export class VectorDatabase {
  private db: Database.Database;

  constructor(dbPath?: string) {
    // Use app's userData path for database in production
    const defaultPath = path.join(app.getPath('userData'), 'vector.db');
    this.db = new Database(dbPath || defaultPath);
    
    // Load sqlite-vec extension
    sqliteVec.load(this.db);
    
    // Initialize database schema
    this.initializeSchema();
  }

  private initializeSchema() {
    // Create a table for storing documents with their embeddings
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE VIRTUAL TABLE IF NOT EXISTS vec_documents USING vec0(
        id INTEGER PRIMARY KEY,
        embedding FLOAT[768]
      );
    `);
  }

  /**
   * Insert a document with its vector embedding
   * @param content - The document content
   * @param embedding - The vector embedding (array of floats)
   * @param metadata - Optional metadata as JSON string or object
   */
  insertDocument(content: string, embedding: number[], metadata?: string | object) {
    const metadataStr = typeof metadata === 'object' ? JSON.stringify(metadata) : metadata;
    
    const insert = this.db.prepare(
      'INSERT INTO documents (content, metadata) VALUES (?, ?)'
    );
    const result = insert.run(content, metadataStr);
    const docId = result.lastInsertRowid;
    
    // Insert the vector embedding
    const vecInsert = this.db.prepare(
      'INSERT INTO vec_documents (id, embedding) VALUES (?, ?)'
    );
    vecInsert.run(docId, JSON.stringify(embedding));
    
    return docId;
  }

  /**
   * Search for similar documents using vector similarity
   * @param queryEmbedding - The query vector embedding
   * @param limit - Maximum number of results to return
   * @returns Array of matching documents with similarity scores
   */
  searchSimilar(queryEmbedding: number[], limit: number = 10) {
    const query = this.db.prepare(`
      SELECT 
        d.id,
        d.content,
        d.metadata,
        d.created_at,
        vec_distance_L2(v.embedding, ?) as distance
      FROM vec_documents v
      JOIN documents d ON d.id = v.id
      ORDER BY distance
      LIMIT ?
    `);
    
    return query.all(JSON.stringify(queryEmbedding), limit);
  }

  /**
   * Get a document by ID
   */
  getDocument(id: number) {
    const query = this.db.prepare(
      'SELECT * FROM documents WHERE id = ?'
    );
    return query.get(id);
  }

  /**
   * Delete a document and its embedding
   */
  deleteDocument(id: number) {
    const deleteDoc = this.db.prepare('DELETE FROM documents WHERE id = ?');
    const deleteVec = this.db.prepare('DELETE FROM vec_documents WHERE id = ?');
    
    deleteDoc.run(id);
    deleteVec.run(id);
  }

  /**
   * Get total document count
   */
  getDocumentCount(): number {
    const result = this.db.prepare('SELECT COUNT(*) as count FROM documents').get() as { count: number };
    return result.count;
  }

  /**
   * Close the database connection
   */
  close() {
    this.db.close();
  }
}
