# Database Setup Summary

This document provides a quick overview of the database setup for the simple-rag project.

## Overview

This project uses **SQLite** with two complementary systems:

1. **Prisma ORM** - For structured data management (documents, metadata, chunks, collections)
2. **Vector Database (sqlite-vec)** - For vector embeddings and semantic similarity search

## Installed Packages

### Dependencies
- `@prisma/client` (v7.8.0) - Prisma Client for database queries
- `better-sqlite3` (v12.10.0) - High-performance SQLite binding
- `sqlite-vec` (v0.1.9) - Vector similarity search extension

### Dev Dependencies
- `prisma` (v7.8.0) - Prisma CLI for migrations and schema management
- `@types/better-sqlite3` (v7.6.13) - TypeScript types for better-sqlite3
- `dotenv` (v17.4.2) - Environment variable management

## Quick Start

### Database Scripts

Use these npm scripts for common database operations:

```bash
# Generate Prisma Client after schema changes
npm run db:generate

# Create a new migration
npm run db:migrate

# Open Prisma Studio (visual database editor)
npm run db:studio

# Reset database (WARNING: deletes all data)
npm run db:reset

# Push schema changes without migration
npm run db:push
```

### File Structure

```
simple-rag/
├── prisma/
│   ├── schema.prisma           # Database schema definition
│   └── migrations/             # Migration history
├── electron/
│   ├── prisma-client.ts        # Prisma Client singleton
│   ├── prisma-service.ts       # Service classes for data operations
│   ├── prisma-example.ts       # Prisma usage examples
│   ├── vector-db.ts            # Vector database class
│   ├── vector-db-example.ts    # Vector DB usage examples
│   └── integrated-example.ts   # Combined Prisma + Vector DB example
├── dev.db                      # SQLite database file (created after migration)
├── .env                        # Environment variables (DATABASE_URL)
├── PRISMA_GUIDE.md            # Comprehensive Prisma documentation
└── VECTOR_SEARCH_README.md    # Vector search documentation
```

## Database Schema

### Prisma Models (Structured Data)

- **Document**: Stores full document content and metadata
- **Chunk**: Document sections for efficient retrieval
- **Collection**: Groups related documents
- **QueryHistory**: Tracks search queries and results

### Vector Database

- Stores vector embeddings (default 768 dimensions)
- Enables semantic similarity search using L2 distance
- Links to Prisma documents via metadata

## Usage Examples

### Using Prisma

```typescript
import { documentService } from './electron/prisma-service';

// Create a document
const doc = await documentService.createDocument({
  content: 'Document text here',
  source: 'file.pdf',
  metadata: { category: 'Technical' }
});

// Search documents
const results = await documentService.searchDocuments('machine learning');

// Get document with chunks
const fullDoc = await documentService.getDocument(doc.id);
```

### Using Vector Database

```typescript
import { VectorDatabase } from './electron/vector-db';

const vectorDb = new VectorDatabase();

// Insert document with embedding
const embedding = await generateEmbedding(text); // Your embedding model
vectorDb.insertDocument(text, embedding, { category: 'AI' });

// Search for similar documents
const queryEmbedding = await generateEmbedding(query);
const similar = vectorDb.searchSimilar(queryEmbedding, 10);
```

### Integrated Usage (Recommended)

```typescript
import { documentService } from './electron/prisma-service';
import { VectorDatabase } from './electron/vector-db';

// 1. Store in Prisma
const doc = await documentService.createDocument({ content, metadata });

// 2. Generate and store embedding
const embedding = await generateEmbedding(doc.content);
vectorDb.insertDocument(doc.content, embedding, { prismaDocId: doc.id });

// 3. Search and enrich
const vectorResults = vectorDb.searchSimilar(queryEmbedding, 10);
const enriched = await Promise.all(
  vectorResults.map(r => documentService.getDocument(r.metadata.prismaDocId))
);
```

## Running Examples

### Prisma Example
```bash
npx tsx electron/prisma-example.ts
```

### Vector Database Example
```bash
npx tsx electron/vector-db-example.ts
```

### Integrated Example
```bash
npx tsx electron/integrated-example.ts
```

## Important Notes

### Environment Variables

The `.env` file contains:
```env
DATABASE_URL="file:./dev.db"
```

For production Electron apps, update the path to use `app.getPath('userData')`.

### Embedding Models

The examples use mock embeddings. For production, use a real embedding model:

- **OpenAI**: `text-embedding-3-small` or `text-embedding-3-large`
- **Local**: `@xenova/transformers` for in-browser/Node.js
- **Other APIs**: Cohere, Hugging Face, etc.

### Database Location

- **Development**: `./dev.db` (root directory)
- **Production**: Should be in Electron's userData directory for proper access and persistence

### Migration Workflow

1. Edit [prisma/schema.prisma](prisma/schema.prisma)
2. Run `npm run db:migrate` to create migration
3. Run `npm run db:generate` to update Prisma Client
4. Restart your app

## Documentation

- **[PRISMA_GUIDE.md](PRISMA_GUIDE.md)** - Complete Prisma usage guide with examples
- **[VECTOR_SEARCH_README.md](VECTOR_SEARCH_README.md)** - Vector search setup and usage

## Troubleshooting

### "Table already exists" error
```bash
npm run db:reset  # Resets and reapplies all migrations
```

### Type errors after schema changes
```bash
npm run db:generate  # Regenerate Prisma Client
```

### Database locked
Ensure only one process accesses the SQLite database at a time.

## Next Steps

1. **Choose an embedding model** - Integrate OpenAI API or a local model
2. **Implement document processing** - Add PDF, text, markdown parsing
3. **Create UI components** - Build Vue components for document management
4. **Add IPC handlers** - Expose database operations to renderer process
5. **Implement chunking logic** - Split documents intelligently for better retrieval
6. **Add search UI** - Create a search interface with results display

## Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [SQLite Vector Documentation](https://github.com/asg017/sqlite-vec)
- [Better SQLite3](https://github.com/WiseLibs/better-sqlite3)
- [Electron IPC](https://www.electronjs.org/docs/latest/tutorial/ipc)
