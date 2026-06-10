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

  // Provider operations
  provider: {
    create: (data: any) => ipcRenderer.invoke('provider:create', data),
    findById: (id: number) => ipcRenderer.invoke('provider:findById', id),
    findByName: (name: string) => ipcRenderer.invoke('provider:findByName', name),
    findAll: (includeInactive?: boolean) => 
      ipcRenderer.invoke('provider:findAll', includeInactive),
    update: (id: number, data: any) => ipcRenderer.invoke('provider:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('provider:delete', id),
    toggleActive: (id: number) => ipcRenderer.invoke('provider:toggleActive', id),
    getStatistics: () => ipcRenderer.invoke('provider:getStatistics'),
  },

  // Model operations
  model: {
    create: (data: any) => ipcRenderer.invoke('model:create', data),
    findById: (id: number) => ipcRenderer.invoke('model:findById', id),
    findByProviderAndName: (providerId: number, name: string) => 
      ipcRenderer.invoke('model:findByProviderAndName', providerId, name),
    findAll: (options?: any) => ipcRenderer.invoke('model:findAll', options),
    findByProviderId: (providerId: number, includeInactive?: boolean) => 
      ipcRenderer.invoke('model:findByProviderId', providerId, includeInactive),
    findByType: (modelType: string, includeInactive?: boolean) => 
      ipcRenderer.invoke('model:findByType', modelType, includeInactive),
    findEmbeddingModels: (includeInactive?: boolean) => 
      ipcRenderer.invoke('model:findEmbeddingModels', includeInactive),
    findChatModels: (includeInactive?: boolean) => 
      ipcRenderer.invoke('model:findChatModels', includeInactive),
    update: (id: number, data: any) => ipcRenderer.invoke('model:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('model:delete', id),
    toggleActive: (id: number) => ipcRenderer.invoke('model:toggleActive', id),
    getStatistics: () => ipcRenderer.invoke('model:getStatistics'),
  },
};

console.log('[Preload] API object created:', Object.keys(api));
console.log('[Preload] Provider API methods:', Object.keys(api.provider));
console.log('[Preload] Model API methods:', Object.keys(api.model));

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    console.log('[Preload] Context is isolated, using contextBridge');
    contextBridge.exposeInMainWorld('electron', electronAPI);
    contextBridge.exposeInMainWorld('api', api);
    console.log('[Preload] Successfully exposed api to main world');
  } catch (error) {
    console.error('[Preload] Error exposing APIs:', error);
  }
} else {
  console.log('[Preload] Context is not isolated, adding to window');
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.api = api;
}
