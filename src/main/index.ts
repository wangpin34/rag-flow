import { electronApp, is, optimizer } from '@electron-toolkit/utils';
import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { join } from 'path';
// import icon from '../../resources/icon.png?asset';
import { vectorDatabaseService } from './lib/vector-database.service';
import { documentService } from './repository/document.service';
import { modelService } from './repository/model.service';
import { prismaService } from './repository/prisma.service';
import { providerService } from './repository/provider.service';
import { seedDatabase } from './repository/seed';

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    // ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
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
  electronApp.setAppUserModelId('com.simple-rag');

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
    try {
      return await providerService.create(data);
    } catch (error) {
      console.error('provider:create error:', error);
      throw error;
    }
  });

  ipcMain.handle('provider:findById', async (_event, id: number) => {
    try {
      return await providerService.findById(id);
    } catch (error) {
      console.error('provider:findById error:', error);
      throw error;
    }
  });

  ipcMain.handle('provider:findByName', async (_event, name: string) => {
    try {
      return await providerService.findByName(name);
    } catch (error) {
      console.error('provider:findByName error:', error);
      throw error;
    }
  });

  ipcMain.handle('provider:findAll', async (_event, includeInactive?: boolean) => {
    try {
      console.log('provider:findAll called with includeInactive:', includeInactive);
      const result = await providerService.findAll(includeInactive);
      console.log('provider:findAll result:', result);
      return result;
    } catch (error) {
      console.error('provider:findAll error:', error);
      throw error;
    }
  });

  ipcMain.handle('provider:update', async (_event, id: number, data) => {
    try {
      return await providerService.update(id, data);
    } catch (error) {
      console.error('provider:update error:', error);
      throw error;
    }
  });

  ipcMain.handle('provider:delete', async (_event, id: number) => {
    try {
      return await providerService.delete(id);
    } catch (error) {
      console.error('provider:delete error:', error);
      throw error;
    }
  });

  ipcMain.handle('provider:toggleActive', async (_event, id: number) => {
    try {
      return await providerService.toggleActive(id);
    } catch (error) {
      console.error('provider:toggleActive error:', error);
      throw error;
    }
  });

  ipcMain.handle('provider:getStatistics', async () => {
    try {
      return await providerService.getStatistics();
    } catch (error) {
      console.error('provider:getStatistics error:', error);
      throw error;
    }
  });

  // Model IPC handlers
  ipcMain.handle('model:create', async (_event, data) => {
    try {
      return await modelService.create(data);
    } catch (error) {
      console.error('model:create error:', error);
      throw error;
    }
  });

  ipcMain.handle('model:findById', async (_event, id: number) => {
    try {
      return await modelService.findById(id);
    } catch (error) {
      console.error('model:findById error:', error);
      throw error;
    }
  });

  ipcMain.handle('model:findByProviderAndName', async (_event, providerId: number, name: string) => {
    try {
      return await modelService.findByProviderAndName(providerId, name);
    } catch (error) {
      console.error('model:findByProviderAndName error:', error);
      throw error;
    }
  });

  ipcMain.handle('model:findAll', async (_event, options?) => {
    try {
      console.log('model:findAll called with options:', options);
      const result = await modelService.findAll(options);
      console.log('model:findAll result:', result);
      return result;
    } catch (error) {
      console.error('model:findAll error:', error);
      throw error;
    }
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
