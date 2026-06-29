import { electronApp, is, optimizer } from '@electron-toolkit/utils';
import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { join } from 'path';
// import icon from '../../resources/icon.png?asset';
import { documentProcessorService } from './lib/document-processor.service';
import { providerApiService } from './lib/provider-api.service';
import { vectorDatabaseService } from './lib/vector-database.service';
import { chatService } from './repository/chat.service';
import { collectionService } from './repository/collection.service';
import { documentService } from './repository/document.service';
import { modelService } from './repository/model.service';
import { prismaService } from './repository/prisma.service';
import { providerService } from './repository/provider.service';
import { seedDatabase } from './repository/seed';
import { settingsService } from './repository/settings.service';

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    // ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.ragflow');

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // Initialize databases
  await prismaService.connect();
  await vectorDatabaseService.connect();

  // Seed database with default providers and models
  await seedDatabase();

  // IPC handlers
  ipcMain.on('ping', () => console.log('pong'));

  // Document IPC handlers
  ipcMain.handle('document:create', async (_event, data) => {
    return documentService.create(data);
  });

  ipcMain.handle('document:findById', async (_event, id: number) => {
    return documentService.findById(id);
  });

  ipcMain.handle('document:findMany', async (_event, page: number, pageSize: number) => {
    return documentService.findMany(page, pageSize);
  });

  ipcMain.handle('document:search', async (_event, query: string) => {
    return documentService.search(query);
  });

  ipcMain.handle('document:update', async (_event, id: number, data) => {
    return documentService.update(id, data);
  });

  ipcMain.handle('document:delete', async (_event, id: number) => {
    return documentService.delete(id);
  });

  ipcMain.handle('document:getStatistics', async () => {
    return documentService.getStatistics();
  });

  // Vector database IPC handlers
  ipcMain.handle('vector:insertEmbedding', async (_event, documentId: number, embedding: number[]) => {
    return vectorDatabaseService.insertEmbedding(documentId, embedding);
  });

  ipcMain.handle('vector:searchSimilar', async (_event, queryEmbedding: number[], limit: number) => {
    return vectorDatabaseService.searchSimilar(queryEmbedding, limit);
  });

  ipcMain.handle('vector:hasEmbedding', async (_event, documentId: number) => {
    return vectorDatabaseService.hasEmbedding(documentId);
  });

  ipcMain.handle('vector:deleteEmbedding', async (_event, documentId: number) => {
    return vectorDatabaseService.deleteEmbedding(documentId);
  });

  ipcMain.handle('vector:getEmbeddingCount', async () => {
    return vectorDatabaseService.getEmbeddingCount();
  });

  // Provider IPC handlers
  ipcMain.handle('provider:create', async (_event, data) => {
    return providerService.create(data);
  });

  ipcMain.handle('provider:findById', async (_event, id: number) => {
    return providerService.findById(id);
  });

  ipcMain.handle('provider:findByName', async (_event, name: string) => {
    return providerService.findByName(name);
  });

  ipcMain.handle('provider:findAll', async (_event, includeInactive?: boolean) => {
    return providerService.findAll(includeInactive);
  });

  ipcMain.handle('provider:update', async (_event, id: number, data) => {
    return providerService.update(id, data);
  });

  ipcMain.handle('provider:delete', async (_event, id: number) => {
    return providerService.delete(id);
  });

  ipcMain.handle('provider:toggleActive', async (_event, id: number) => {
    return providerService.toggleActive(id);
  });

  ipcMain.handle('provider:getStatistics', async () => {
    return providerService.getStatistics();
  });

  ipcMain.handle('provider:listModels', async (_event, providerId: number, apiKey?: string) => {
    try {
      const provider = await providerService.findById(providerId);
      if (!provider) {
        throw new Error('Provider not found');
      }

      let models;
      if (provider.name.toLowerCase() === 'ollama') {
        models = await providerApiService.listOllamaModels(provider.apiEndpoint || 'http://localhost:11434/api');
      } else if (provider.name.toLowerCase() === 'openai') {
        if (!apiKey) {
          throw new Error('API key required for OpenAI');
        }
        models = await providerApiService.listOpenAIModels(provider.apiEndpoint || 'https://api.openai.com/v1', apiKey);
      } else {
        throw new Error(`Unsupported provider: ${provider.name}`);
      }

      // Add models to database if they don't exist
      const createdModels = [];
      for (const modelData of models) {
        const existing = await modelService.findByProviderAndName(providerId, modelData.name);
        if (!existing) {
          const created = await modelService.create({
            provider: { connect: { id: providerId } },
            name: modelData.name,
            displayName: modelData.displayName,
            modelType: modelData.modelType,
            contextWindow: modelData.contextWindow,
            embeddingDim: (modelData as any).embeddingDim || null,
            isActive: false,
          });
          createdModels.push(created);
        }
      }

      return {
        total: models.length,
        added: createdModels.length,
        models: createdModels,
      };
    } catch (error) {
      console.error('provider:listModels error:', error);
      throw error;
    }
  });

  // Model IPC handlers
  ipcMain.handle('model:create', async (_event, data) => {
    return modelService.create(data);
  });

  ipcMain.handle('model:findById', async (_event, id: number) => {
    return modelService.findById(id);
  });

  ipcMain.handle('model:findByProviderAndName', async (_event, providerId: number, name: string) => {
    return modelService.findByProviderAndName(providerId, name);
  });

  ipcMain.handle('model:findAll', async (_event, options?) => {
    return modelService.findAll(options);
  });

  ipcMain.handle('model:findByProviderId', async (_event, providerId: number, includeInactive?: boolean) => {
    return modelService.findByProviderId(providerId, includeInactive);
  });

  ipcMain.handle('model:findByType', async (_event, modelType: string, includeInactive?: boolean) => {
    return modelService.findByType(modelType, includeInactive);
  });

  ipcMain.handle('model:findEmbeddingModels', async (_event, includeInactive?: boolean) => {
    return modelService.findEmbeddingModels(includeInactive);
  });

  ipcMain.handle('model:findChatModels', async (_event, includeInactive?: boolean) => {
    return modelService.findChatModels(includeInactive);
  });

  ipcMain.handle('model:update', async (_event, id: number, data) => {
    return modelService.update(id, data);
  });

  ipcMain.handle('model:delete', async (_event, id: number) => {
    return modelService.delete(id);
  });

  ipcMain.handle('model:toggleActive', async (_event, id: number) => {
    return modelService.toggleActive(id);
  });

  ipcMain.handle('model:getStatistics', async () => {
    return modelService.getStatistics();
  });

  // Chat IPC handlers
  ipcMain.handle('chat:create', async (_event, data) => {
    return chatService.create(data);
  });

  ipcMain.handle('chat:findById', async (_event, id: number) => {
    return chatService.findById(id);
  });

  ipcMain.handle('chat:findAll', async (_event, page?: number, pageSize?: number) => {
    return chatService.findAll(page, pageSize);
  });

  ipcMain.handle('chat:update', async (_event, id: number, data) => {
    return chatService.update(id, data);
  });

  ipcMain.handle('chat:delete', async (_event, id: number) => {
    return chatService.delete(id);
  });

  ipcMain.handle('chat:addMessage', async (_event, data) => {
    return chatService.addMessage(data);
  });

  ipcMain.handle('chat:getMessages', async (_event, chatId: number) => {
    return chatService.getMessages(chatId);
  });

  ipcMain.handle('chat:deleteMessage', async (_event, id: number) => {
    return chatService.deleteMessage(id);
  });

  ipcMain.handle('chat:getStatistics', async () => {
    return chatService.getStatistics();
  });

  // Settings IPC handlers
  ipcMain.handle('settings:get', async (_event, key: string) => {
    return settingsService.get(key);
  });

  ipcMain.handle('settings:set', async (_event, key: string, value: any) => {
    return settingsService.set(key, value);
  });

  ipcMain.handle('settings:delete', async (_event, key: string) => {
    return settingsService.delete(key);
  });

  ipcMain.handle('settings:getAll', async () => {
    return settingsService.getAll();
  });

  ipcMain.handle('settings:getLastUsedModelId', async () => {
    return settingsService.getLastUsedModelId();
  });

  ipcMain.handle('settings:setLastUsedModelId', async (_event, modelId: number) => {
    return settingsService.setLastUsedModelId(modelId);
  });

  // Collection (Knowledge Base) IPC handlers
  ipcMain.handle('collection:create', async (_event, data) => {
    return collectionService.create(data);
  });

  ipcMain.handle('collection:findAll', async () => {
    return collectionService.findAll();
  });

  ipcMain.handle('collection:findById', async (_event, id: number) => {
    return collectionService.findById(id);
  });

  ipcMain.handle('collection:getDocuments', async (_event, collectionId: number) => {
    return collectionService.getDocuments(collectionId);
  });

  ipcMain.handle('collection:addDocument', async (_event, collectionId: number, data: { content: string; fileName: string }) => {
    return collectionService.addDocument(collectionId, data);
  });

  ipcMain.handle('collection:removeDocument', async (_event, documentId: number) => {
    return collectionService.removeDocument(documentId);
  });

  ipcMain.handle('collection:getDocumentDetail', async (_event, documentId: number) => {
    return collectionService.getDocumentDetail(documentId);
  });

  ipcMain.handle('collection:getConfig', async (_event, collectionId: number) => {
    return collectionService.getConfig(collectionId);
  });

  ipcMain.handle('collection:setConfig', async (_event, collectionId: number, config) => {
    return collectionService.setConfig(collectionId, config);
  });

  ipcMain.handle('collection:getDocumentsWithStatus', async (_event, collectionId: number) => {
    return collectionService.getDocumentsWithStatus(collectionId);
  });

  ipcMain.handle('collection:parseDocument', async (_event, documentId: number, parserConfig) => {
    return documentProcessorService.parseDocument(documentId, parserConfig);
  });

  ipcMain.handle('collection:embedDocument', async (_event, documentId: number, embeddingModelId: number) => {
    return documentProcessorService.embedDocument(documentId, embeddingModelId);
  });

  ipcMain.handle('collection:processDocument', async (_event, documentId: number, collectionConfig) => {
    return documentProcessorService.processDocument(documentId, collectionConfig);
  });

  ipcMain.handle('collection:processAll', async (_event, collectionId: number, collectionConfig) => {
    return documentProcessorService.processAll(collectionId, collectionConfig);
  });

  ipcMain.handle('collection:delete', async (_event, id: number) => {
    return collectionService.delete(id);
  });

  ipcMain.handle('collection:retrieve', async (
    _event,
    collectionId: number,
    query: string,
    topK: number,
  ) => {
    // 1. Load the KB config to find the embedding model
    const cfg = await collectionService.getConfig(collectionId);
    if (!cfg.embeddingModelId) throw new Error('No embedding model configured for this knowledge base');

    const model = await prismaService.db.model.findUnique({
      where: { id: cfg.embeddingModelId },
      include: { provider: true },
    });
    if (!model) throw new Error(`Embedding model ${cfg.embeddingModelId} not found`);

    // 2. Embed the query text
    const apiKey = model.provider.apiKeyName ? process.env[model.provider.apiKeyName] : undefined;
    const queryEmbedding = await providerApiService.generateEmbedding(
      { name: model.provider.name, apiEndpoint: model.provider.apiEndpoint },
      model.name,
      query,
      apiKey,
    );

    // 3. Vector search
    const hits = vectorDatabaseService.searchSimilar(queryEmbedding, topK);

    if (!hits.length) return [];

    // 4. Load chunk + document info for each hit.
    // Embeddings are stored per-document. Return all chunks so the UI can
    // show the full document context. Chunks are ordered by chunkIndex.
    const results = await Promise.all(
      hits.map(async (hit) => {
        const doc = await prismaService.db.document.findUnique({
          where: { id: hit.document_id },
          include: { chunks: { orderBy: { chunkIndex: 'asc' } } },
        });

        const meta = doc?.metadata ? (() => { try { return JSON.parse(doc.metadata as string); } catch { return {}; } })() : {};

        return {
          documentId: hit.document_id,
          score: hit.distance,
          source: doc?.source ?? null,
          chunkCount: doc?.chunks?.length ?? 0,
          chunks: (doc?.chunks ?? []).map((c) => ({ id: c.id, chunkIndex: c.chunkIndex, content: c.content })),
          // Fallback: if no chunks yet, return truncated raw content
          chunkContent: doc?.chunks?.length
            ? doc.chunks.map((c) => c.content).join('\n\n---\n\n')
            : (doc?.content?.slice(0, 500) ?? ''),
          collectionId: (meta as any).collectionId ?? null,
        };
      })
    );

    // Filter to only docs that belong to this collection.
    // collectionId is stored in document metadata when the document was added;
    // fall back to including the result if metadata is missing/unparseable.
    return results.filter((r) => r.collectionId === null || r.collectionId === collectionId);
  });

  // Lightweight retrieve for chat context: returns top-K chunks as plain text strings.
  ipcMain.handle('collection:retrieveChunks', async (
    _event,
    collectionId: number,
    query: string,
    topK: number,
  ) => {
    const cfg = await collectionService.getConfig(collectionId);
    if (!cfg.embeddingModelId) return [];

    const model = await prismaService.db.model.findUnique({
      where: { id: cfg.embeddingModelId },
      include: { provider: true },
    });
    if (!model) return [];

    const apiKey = model.provider.apiKeyName ? process.env[model.provider.apiKeyName] : undefined;
    const queryEmbedding = await providerApiService.generateEmbedding(
      { name: model.provider.name, apiEndpoint: model.provider.apiEndpoint },
      model.name,
      query,
      apiKey,
    );

    const hits = vectorDatabaseService.searchSimilar(queryEmbedding, topK);
    if (!hits.length) return [];

    const chunks: Array<{ source: string | null; chunkIndex: number; content: string; score: number }> = [];
    for (const hit of hits) {
      const doc = await prismaService.db.document.findUnique({
        where: { id: hit.document_id },
        include: { chunks: { orderBy: { chunkIndex: 'asc' } } },
      });
      if (!doc) continue;
      const meta = (() => { try { return JSON.parse(doc.metadata as string ?? '{}'); } catch { return {}; } })();
      if (meta.collectionId !== undefined && meta.collectionId !== collectionId) continue;
      // Return only the first chunk as the representative content for this document hit
      const firstChunk = doc.chunks[0];
      if (firstChunk) {
        chunks.push({ source: doc.source, chunkIndex: firstChunk.chunkIndex, content: firstChunk.content, score: hit.distance });
      }
    }
    return chunks;
  });

  createWindow();

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Cleanup on quit
app.on('before-quit', async () => {
  await prismaService.disconnect();
  vectorDatabaseService.close();
});
