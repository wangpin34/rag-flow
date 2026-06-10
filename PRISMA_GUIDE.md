# Prisma Database Management Guide

This project uses Prisma ORM to manage SQLite database operations for the RAG (Retrieval-Augmented Generation) system.

## Installed Packages

- **@prisma/client** - Prisma Client for database queries
- **prisma** - Prisma CLI for migrations and database management
- **dotenv** - Environment variable management

## Database Schema

The schema includes the following models:

### Document
Stores the main document content and metadata.
- `id`: Auto-incrementing primary key
- `content`: Full text content
- `metadata`: JSON string for flexible metadata storage
- `source`: Source file path or URL
- `createdAt` / `updatedAt`: Timestamps
- `chunks`: Relation to Chunk model

### Chunk
Splits documents into smaller pieces for better retrieval.
- `id`: Auto-incrementing primary key
- `documentId`: Foreign key to Document
- `content`: Chunk text content
- `chunkIndex`: Order within the document
- `metadata`: JSON string for chunk-specific metadata
- `createdAt`: Timestamp

### Collection
Organizes documents into logical groups.
- `id`: Auto-incrementing primary key
- `name`: Unique collection name
- `description`: Optional description
- `createdAt` / `updatedAt`: Timestamps

### QueryHistory
Tracks search queries and results.
- `id`: Auto-incrementing primary key
- `query`: Search query text
- `results`: JSON string for storing results
- `createdAt`: Timestamp

## Quick Start

### 1. Database Setup

The database is already initialized. To reset or create a new migration:

```bash
# Create a new migration after schema changes
npx prisma migrate dev --name description_of_changes

# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Generate Prisma Client after schema changes
npx prisma generate
```

### 2. Using Prisma Services

Import the service classes from [electron/prisma-service.ts](electron/prisma-service.ts):

```typescript
import { documentService, collectionService, queryHistoryService } from './electron/prisma-service';

// Create a document with chunks
const document = await documentService.createDocument({
  content: 'Full document text here',
  source: 'document.pdf',
  metadata: {
    author: 'John Doe',
    category: 'Technical',
    tags: ['AI', 'Machine Learning']
  },
  chunks: [
    { content: 'First chunk', chunkIndex: 0 },
    { content: 'Second chunk', chunkIndex: 1 }
  ]
});

// Search documents
const results = await documentService.searchDocuments('machine learning');

// Get document by ID
const doc = await documentService.getDocument(1);

// Get all documents with pagination
const { documents, total } = await documentService.getDocuments(1, 10);
```

### 3. Direct Prisma Client Usage

For more complex queries, use the Prisma Client directly:

```typescript
import prisma from './electron/prisma-client';

// Complex query example
const documentsWithChunks = await prisma.document.findMany({
  where: {
    createdAt: {
      gte: new Date('2024-01-01')
    }
  },
  include: {
    chunks: {
      where: {
        content: {
          contains: 'specific term'
        }
      }
    }
  },
  orderBy: {
    createdAt: 'desc'
  }
});

// Transaction example
const result = await prisma.$transaction(async (tx) => {
  const doc = await tx.document.create({
    data: { content: 'New document' }
  });
  
  await tx.chunk.createMany({
    data: [
      { documentId: doc.id, content: 'Chunk 1', chunkIndex: 0 },
      { documentId: doc.id, content: 'Chunk 2', chunkIndex: 1 }
    ]
  });
  
  return doc;
});
```

## Integration with Electron

### Main Process

In [electron/main.ts](electron/main.ts), expose database operations via IPC:

```typescript
import { ipcMain } from 'electron';
import { documentService, queryHistoryService } from './prisma-service';

// Create document
ipcMain.handle('db:create-document', async (event, data) => {
  return documentService.createDocument(data);
});

// Search documents
ipcMain.handle('db:search-documents', async (event, query) => {
  return documentService.searchDocuments(query);
});

// Get documents
ipcMain.handle('db:get-documents', async (event, page, pageSize) => {
  return documentService.getDocuments(page, pageSize);
});

// Save query
ipcMain.handle('db:save-query', async (event, query, results) => {
  return queryHistoryService.saveQuery(query, results);
});
```

### Renderer Process (Vue Components)

In your Vue components, call the IPC handlers:

```typescript
// In a Vue component
import { ipcRenderer } from 'electron';

// Create a document
const createDocument = async () => {
  const document = await ipcRenderer.invoke('db:create-document', {
    content: 'Document content',
    source: 'file.pdf',
    metadata: { category: 'Technical' }
  });
  console.log('Created:', document);
};

// Search documents
const searchDocuments = async (query: string) => {
  const results = await ipcRenderer.invoke('db:search-documents', query);
  return results;
};
```

## Common Operations

### Adding a New Model

1. Edit [prisma/schema.prisma](prisma/schema.prisma)
2. Run migration:
   ```bash
   npx prisma migrate dev --name add_new_model
   ```
3. Generate client:
   ```bash
   npx prisma generate
   ```

### Viewing Database

Use Prisma Studio to view and edit data:

```bash
npx prisma studio
```

This opens a web interface at http://localhost:5555

### Database Location

- Development: `./dev.db` (configured in .env)
- Production: Should be in Electron's userData directory

### Backup Database

```bash
# Copy the SQLite file
cp dev.db dev.db.backup

# Or use SQLite dump
sqlite3 dev.db .dump > backup.sql
```

## Combining Prisma with Vector Search

You can use Prisma for structured data and the VectorDatabase class for embeddings:

```typescript
import { documentService } from './prisma-service';
import { VectorDatabase } from './vector-db';

const prismaDb = documentService;
const vectorDb = new VectorDatabase();

// 1. Store document in Prisma
const doc = await prismaDb.createDocument({
  content: 'Document content',
  source: 'file.pdf'
});

// 2. Generate embedding (use your embedding model)
const embedding = await generateEmbedding(doc.content);

// 3. Store embedding in vector database
vectorDb.insertDocument(doc.content, embedding, {
  prismaDocId: doc.id
});

// 4. Search: First get similar docs from vector DB
const similarDocs = vectorDb.searchSimilar(queryEmbedding, 10);

// 5. Then enrich with Prisma data
const enrichedResults = await Promise.all(
  similarDocs.map(async (doc) => {
    const metadata = JSON.parse(doc.metadata);
    const prismaDoc = await prismaDb.getDocument(metadata.prismaDocId);
    return { ...doc, fullDocument: prismaDoc };
  })
);
```

## Best Practices

1. **Use Transactions**: For operations affecting multiple tables
2. **Handle Errors**: Always wrap database calls in try-catch
3. **Close Connections**: Ensure Prisma Client disconnects on app exit
4. **Validate Input**: Always validate user input before database operations
5. **Use Pagination**: For large result sets
6. **Index Properly**: Add database indexes for frequently queried fields
7. **JSON Metadata**: Use JSON strings for flexible metadata storage

## Troubleshooting

### Migration Issues
```bash
# Reset and reapply all migrations
npx prisma migrate reset

# Create a new migration from current schema
npx prisma migrate dev
```

### Type Errors
```bash
# Regenerate Prisma Client
npx prisma generate
```

### Database Locked
SQLite databases can lock. Ensure only one process accesses the database at a time.

## Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [Prisma Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
- [SQLite Best Practices](https://www.sqlite.org/bestpractice.html)
