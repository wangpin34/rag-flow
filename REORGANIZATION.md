# Code Reorganization Complete

The project has been successfully reorganized to follow the **electron-vite** architecture pattern from the email-assistant project.

## Key Changes

### 1. **Directory Structure**

**Before:**
```
simple-rag/
├── electron/
│   ├── main.ts
│   ├── preload.ts
│   ├── vector-db.ts
│   ├── prisma-client.ts
│   └── prisma-service.ts
├── src/
│   ├── App.vue
│   ├── main.ts
│   ├── components/
│   └── assets/
├── index.html
└── vite.config.ts
```

**After:**
```
simple-rag/
├── src/
│   ├── main/
│   │   ├── index.ts (main process entry)
│   │   ├── lib/
│   │   │   └── vector-database.service.ts
│   │   └── repository/
│   │       ├── prisma.service.ts
│   │       ├── document.service.ts
│   │       └── migrate.ts
│   ├── preload/
│   │   ├── index.ts
│   │   └── index.d.ts
│   ├── renderer/
│   │   ├── index.html
│   │   └── src/
│   │       ├── main.ts
│   │       ├── App.vue
│   │       ├── env.d.ts
│   │       ├── components/
│   │       └── assets/
│   ├── types/ (shared types)
│   └── generated/ (Prisma client)
├── prisma/
├── resources/ (app icons, etc.)
├── build/ (electron-builder assets)
└── electron.vite.config.ts
```

### 2. **Build System**

- **Replaced**: `vite` + `vite-plugin-electron` → **`electron-vite`**
- Better separation of concerns (main, preload, renderer)
- Optimized build process for Electron apps
- Proper HMR support for all processes

### 3. **Database Architecture**

#### Repository Pattern
All database operations now use service classes:

- **`prisma.service.ts`** - Database connection management
- **`document.service.ts`** - Document CRUD operations
- **`vector-database.service.ts`** - Vector embedding operations
- **`migrate.ts`** - Migration runner for production builds

#### Unified Database
Both Prisma and vector database share the same SQLite file:
- Development: `./dev.db`
- Production: `app.getPath('userData')/data.db`

### 4. **IPC Communication**

**Preload Script** (`src/preload/index.ts`):
```typescript
const api = {
  document: {
    create: (data) => ipcRenderer.invoke('document:create', data),
    findById: (id) => ipcRenderer.invoke('document:findById', id),
    // ...
  },
  vector: {
    insertEmbedding: (docId, embedding) => 
      ipcRenderer.invoke('vector:insertEmbedding', docId, embedding),
    searchSimilar: (query, limit) => 
      ipcRenderer.invoke('vector:searchSimilar', query, limit),
    // ...
  }
};
```

**Renderer Usage**:
```typescript
// In Vue components
const doc = await window.api.document.create({
  content: 'Document text',
  source: 'file.pdf'
});

const results = await window.api.vector.searchSimilar(embedding, 10);
```

### 5. **TypeScript Configuration**

Three separate tsconfig files for better type checking:

- **`tsconfig.json`** - Root config with project references
- **`tsconfig.node.json`** - Main & preload processes
- **`tsconfig.web.json`** - Renderer process (Vue)

Path aliases for cleaner imports:
- `@generated/*` - Prisma client
- `@shared/*` - Shared types
- `@renderer/*` - Renderer source

### 6. **Package Scripts**

**New npm scripts:**
```json
{
  "dev": "electron-vite dev",
  "build": "npm run typecheck && electron-vite build",
  "typecheck:node": "tsc --noEmit -p tsconfig.node.json",
  "typecheck:web": "tsc --noEmit -p tsconfig.web.json",
  "typecheck": "npm run typecheck:node && npm run typecheck:web",
  "build:win": "npm run build && electron-builder --win",
  "build:mac": "npm run build && electron-builder --mac",
  "build:linux": "npm run build && electron-builder --linux"
}
```

### 7. **Prisma Configuration**

**Updated schema** to generate client in new location:
```prisma
generator client {
  provider = "prisma-client-js"
  output   = "../src/generated/prisma/client"
}
```

**Prisma service** now:
- Uses `@prisma/adapter-better-sqlite3`
- Runs migrations automatically on startup
- Handles dev vs production database paths
- Provides singleton instance

### 8. **Electron Builder**

Replaced `electron-builder.json5` with `electron-builder.yml` following modern conventions:
- Includes migration files in bundle
- Excludes source files from production
- Proper ASAR unpacking for resources
- Cross-platform build targets

## Benefits of New Structure

### 🎯 **Separation of Concerns**
- Main process: Business logic, database, IPC handlers
- Preload: Secure API bridge
- Renderer: UI/UX with Vue

### 🔒 **Security**
- Context isolation enabled
- Proper IPC communication through preload
- No direct Node.js access in renderer

### ⚡ **Performance**
- Better HMR in development
- Optimized builds for production
- Lazy loading support

### 🛠️ **Developer Experience**
- Type-safe IPC calls
- Better IntelliSense
- Clearer error messages
- Easier testing

### 📦 **Maintainability**
- Repository pattern for database operations
- Service layer for business logic
- Clear file organization
- Scalable architecture

## Migration from Old Code

### Old Files (Can be deleted)
```
electron/          → Moved to src/main/
vite.config.ts     → Replaced by electron.vite.config.ts
index.html         → Moved to src/renderer/index.html
electron-builder.json5 → Replaced by electron-builder.yml
```

### Import Path Changes

**Before:**
```typescript
import { PrismaClient } from '@prisma/client';
import prisma from './electron/prisma-client';
```

**After:**
```typescript
import { PrismaClient } from '@generated/prisma/client';
import { prismaService } from './repository/prisma.service';
// Use: prismaService.db
```

## Development Workflow

### Starting Development
```bash
npm run dev
```
This starts electron-vite in dev mode with HMR for all processes.

### Type Checking
```bash
npm run typecheck
```
Validates TypeScript in both main and renderer processes.

### Building for Production
```bash
# Build only
npm run build

# Build and package
npm run build:mac    # macOS
npm run build:win    # Windows
npm run build:linux  # Linux
```

### Database Operations
```bash
npm run db:migrate   # Create migration
npm run db:generate  # Generate Prisma Client
npm run db:studio    # Open Prisma Studio
```

## Next Steps

1. **Add Icon** - Replace `resources/icon.png` with actual app icon
2. **Implement UI** - Build Vue components using window.api
3. **Add Embedding Model** - Integrate OpenAI or local embeddings
4. **Document Processing** - Add PDF, text, markdown parsers
5. **Search Interface** - Create RAG search UI
6. **Testing** - Add unit and integration tests

## Documentation

- **[DATABASE_SETUP.md](DATABASE_SETUP.md)** - Database architecture overview
- **[PRISMA_GUIDE.md](PRISMA_GUIDE.md)** - Prisma usage patterns
- **[VECTOR_SEARCH_README.md](VECTOR_SEARCH_README.md)** - Vector database guide
- **[DATABASE_ARCHITECTURE.md](DATABASE_ARCHITECTURE.md)** - Single vs dual database

## Resources

- [electron-vite Documentation](https://electron-vite.org/)
- [Electron IPC Guide](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [Prisma with Electron](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-electron)
- [Vue 3 + TypeScript](https://vuejs.org/guide/typescript/overview.html)
