import { electronApp, is, optimizer } from '@electron-toolkit/utils';
import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { join } from 'path';
// import icon from '../../resources/icon.png?asset';
import { vectorDatabaseService } from './lib/vector-database.service';
import { documentService } from './repository/document.service';
import { prismaService } from './repository/prisma.service';

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
      sandbox: false
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
