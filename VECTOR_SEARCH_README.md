# SQLite Vector Search Setup

This project now includes SQLite with vector search capabilities using `better-sqlite3` and `sqlite-vec`.

## Installed Packages

- **better-sqlite3**: Fast SQLite3 binding for Node.js, compatible with Electron
- **sqlite-vec**: Vector similarity search extension for SQLite
- **@types/better-sqlite3**: TypeScript type definitions

## Usage

### 1. Basic Setup

```typescript
import { VectorDatabase } from './electron/vector-db';

// Initialize the database (stores in app's userData directory by default)
const vectorDb = new VectorDatabase();

// Or specify a custom path
const vectorDb = new VectorDatabase('./my-custom-path/vector.db');
```

### 2. Insert Documents with Embeddings

```typescript
// Generate embeddings using your preferred model (OpenAI, Cohere, local models, etc.)
const embedding = await generateEmbedding(documentText); // Returns number[]

// Insert document
const docId = vectorDb.insertDocument(
  'Your document content here',
  embedding,
  { source: 'example.pdf', page: 1 } // Optional metadata
);
```

### 3. Search for Similar Documents

```typescript
// Generate embedding for your query
const queryEmbedding = await generateEmbedding('What is machine learning?');

// Search for similar documents
const results = vectorDb.searchSimilar(queryEmbedding, 10); // top 10 results

results.forEach(doc => {
  console.log(`${doc.content} (distance: ${doc.distance})`);
});
```

### 4. Other Operations

```typescript
// Get document count
const count = vectorDb.getDocumentCount();

// Get specific document
const doc = vectorDb.getDocument(docId);

// Delete document
vectorDb.deleteDocument(docId);

// Close database connection
vectorDb.close();
```

## Integration with Electron

In your main process ([electron/main.ts](electron/main.ts)), you can expose the vector database to the renderer process using IPC:

```typescript
import { ipcMain } from 'electron';
import { VectorDatabase } from './vector-db';

const vectorDb = new VectorDatabase();

ipcMain.handle('vector-search', async (event, queryEmbedding, limit) => {
  return vectorDb.searchSimilar(queryEmbedding, limit);
});

ipcMain.handle('insert-document', async (event, content, embedding, metadata) => {
  return vectorDb.insertDocument(content, embedding, metadata);
});
```

## Generating Embeddings

You'll need to use an embedding model to convert text into vectors. Options include:

1. **OpenAI API**: `text-embedding-3-small` or `text-embedding-3-large`
2. **Local models**: Use libraries like `@xenova/transformers` for browser/Node.js
3. **Other APIs**: Cohere, Hugging Face, etc.

Example with a local model:
```bash
npm install @xenova/transformers
```

## Integration with Prisma ORM

This project also includes **Prisma** for managing structured data in SQLite. You can use both systems together:

- **Prisma**: For storing documents, metadata, chunks, and other structured data
- **Vector Database**: For storing embeddings and performing similarity searches

See [PRISMA_GUIDE.md](PRISMA_GUIDE.md) for detailed Prisma usage and integration patterns.

### Combined Usage Example

```typescript
import { documentService } from './electron/prisma-service';
import { VectorDatabase } from './electron/vector-db';

// 1. Store document metadata in Prisma
const doc = await documentService.createDocument({
  content: 'Document text',
  source: 'file.pdf'
});

// 2. Generate and store embedding in vector DB
const embedding = await generateEmbedding(doc.content);
vectorDb.insertDocument(doc.content, embedding, { prismaDocId: doc.id });

// 3. Search with vector similarity and enrich with Prisma data
const similarDocs = vectorDb.searchSimilar(queryEmbedding, 10);
const fullDocs = await Promise.all(
  similarDocs.map(d => documentService.getDocument(JSON.parse(d.metadata).prismaDocId))
);
```

## Notes

- The default embedding dimension is 768 (common for many models)
- Adjust the dimension in `vector-db.ts` if using a different model
- SQLite database is stored in the Electron app's userData directory by default
- The `vec_distance_L2` function uses L2 (Euclidean) distance for similarity
- For structured data operations, use Prisma (see [PRISMA_GUIDE.md](PRISMA_GUIDE.md))
