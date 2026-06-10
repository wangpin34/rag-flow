# Database Architecture: Single vs. Multiple Files

## Recommendation: Use a Single Database File ✅

For your SQLite-based RAG system, **using a single database file is strongly recommended**.

## Current Setup (Two Files)

```
dev.db           → Prisma (documents, chunks, collections, query_history)
vector.db        → Vector embeddings and search
```

## Recommended Setup (One File)

```
dev.db           → Everything (Prisma tables + vector extension tables)
```

## Why Single Database?

### 1. **Atomic Transactions**
Ensure data consistency across structured data and vectors:
```typescript
// Single database - atomic operation
db.transaction(() => {
  const doc = insertDocument(...);
  insertEmbedding(doc.id, embedding);
});
```

### 2. **Foreign Key Integrity**
Vector embeddings can reference document IDs with proper constraints:
```sql
CREATE TABLE vec_embeddings (
  id INTEGER PRIMARY KEY,
  document_id INTEGER NOT NULL,
  embedding BLOB,
  FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE
);
```

### 3. **Simplified Operations**
- One connection to manage
- Single backup/restore file
- Easier deployment in Electron
- One database file to sync or migrate

### 4. **Better Queries**
Direct joins between vector results and document metadata:
```sql
SELECT 
  d.content, 
  d.metadata,
  v.distance 
FROM documents d
JOIN vec_search v ON v.document_id = d.id
WHERE v.distance < 0.5
ORDER BY v.distance;
```

### 5. **Electron-Friendly**
Single file in `userData` directory is simpler to manage:
```typescript
const dbPath = path.join(app.getPath('userData'), 'app.db');
```

## Implementation

### Update VectorDatabase to Use Prisma's Database

**Modified electron/vector-db.ts:**
```typescript
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';

export class VectorDatabase {
  private db: Database.Database;

  // Accept existing database or path
  constructor(dbPathOrInstance: string | Database.Database) {
    if (typeof dbPathOrInstance === 'string') {
      this.db = new Database(dbPathOrInstance);
    } else {
      this.db = dbPathOrInstance;
    }
    
    sqliteVec.load(this.db);
    this.initializeSchema();
  }

  private initializeSchema() {
    // Only create vector tables, not documents table
    // (Prisma manages the documents table)
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS vec_embeddings USING vec0(
        document_id INTEGER PRIMARY KEY,
        embedding FLOAT[768]
      );
    `);
  }

  insertEmbedding(documentId: number, embedding: number[]) {
    const stmt = this.db.prepare(
      'INSERT INTO vec_embeddings (document_id, embedding) VALUES (?, ?)'
    );
    stmt.run(documentId, JSON.stringify(embedding));
  }

  searchSimilar(queryEmbedding: number[], limit: number = 10) {
    const query = this.db.prepare(`
      SELECT 
        document_id,
        vec_distance_L2(embedding, ?) as distance
      FROM vec_embeddings
      ORDER BY distance
      LIMIT ?
    `);
    
    return query.all(JSON.stringify(queryEmbedding), limit);
  }
}
```

**Usage with shared database:**
```typescript
import { PrismaClient } from '@prisma/client';
import Database from 'better-sqlite3';
import { VectorDatabase } from './vector-db';

// Get the database path from environment
const dbPath = './dev.db';

// Use same database for both
const sqliteDb = new Database(dbPath);
const vectorDb = new VectorDatabase(sqliteDb);

// Prisma can still work independently
const prisma = new PrismaClient();

// Now both use the same file
await prisma.document.create({ data: {...} });
vectorDb.insertEmbedding(docId, embedding);
```

## When to Use Separate Databases?

Use separate files **only** if:

1. **Very large scale**: Millions of vectors, need separate optimization
2. **Different servers**: Vector DB on GPU server, structured data locally
3. **Different technologies**: e.g., PostgreSQL + Pinecone
4. **Security**: Need different access controls for each

For a local Electron app with SQLite, **none of these apply**.

## Migration Strategy

If you want to consolidate your current two-file setup:

### Step 1: Export vector data
```typescript
const vectorDb = new VectorDatabase('./vector.db');
const allVectors = vectorDb.getAllEmbeddings();
```

### Step 2: Update vector-db.ts to use Prisma's database
```typescript
const vectorDb = new VectorDatabase('./dev.db'); // Same as Prisma
```

### Step 3: Import vector data
```typescript
allVectors.forEach(v => {
  vectorDb.insertEmbedding(v.documentId, v.embedding);
});
```

### Step 4: Remove old vector.db file

## Performance Considerations

**Single database is NOT slower:**
- SQLite is optimized for concurrent reads
- Vector operations are compute-bound (CPU), not I/O-bound
- Having separate files doesn't improve performance
- In fact, single file may be faster (less file handle overhead)

## Conclusion

For your Electron + SQLite RAG application:

✅ **Recommended**: Single database file  
❌ **Not recommended**: Two separate database files

**Benefits**:
- Simpler code
- Better data integrity  
- Transactional consistency
- Easier to deploy and backup
- Standard SQLite best practice

The only overhead is loading the `sqlite-vec` extension, which is negligible (~1ms).
