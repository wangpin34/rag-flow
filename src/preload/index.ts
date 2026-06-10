import { electronAPI } from '@electron-toolkit/preload';
import { contextBridge, ipcRenderer } from 'electron';

// Custom APIs for renderer
const api = {
  // Document operations
  document: {
    create: (data: any) => ipcRenderer.invoke('document:create', data),
    findById: (id: number) => ipcRenderer.invoke('document:findById', id),
    findMany: (page: number, pageSize: number) => 
      ipcRenderer.invoke('document:findMany', page, pageSize),
    search: (query: string) => ipcRenderer.invoke('document:search', query),
    update: (id: number, data: any) => ipcRenderer.invoke('document:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('document:delete', id),
    getStatistics: () => ipcRenderer.invoke('document:getStatistics'),
  },
  
  // Vector database operations
  vector: {
    insertEmbedding: (documentId: number, embedding: number[]) => 
      ipcRenderer.invoke('vector:insertEmbedding', documentId, embedding),
    searchSimilar: (queryEmbedding: number[], limit: number) => 
      ipcRenderer.invoke('vector:searchSimilar', queryEmbedding, limit),
    hasEmbedding: (documentId: number) => 
      ipcRenderer.invoke('vector:hasEmbedding', documentId),
    deleteEmbedding: (documentId: number) => 
      ipcRenderer.invoke('vector:deleteEmbedding', documentId),
    getEmbeddingCount: () => ipcRenderer.invoke('vector:getEmbeddingCount'),
  },
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI);
    contextBridge.exposeInMainWorld('api', api);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.api = api;
}
