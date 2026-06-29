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
    listModels: (providerId: number, apiKey?: string) => 
      ipcRenderer.invoke('provider:listModels', providerId, apiKey),
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

  // Chat operations
  chat: {
    create: (data: any) => ipcRenderer.invoke('chat:create', data),
    findById: (id: number) => ipcRenderer.invoke('chat:findById', id),
    findAll: (page?: number, pageSize?: number) => 
      ipcRenderer.invoke('chat:findAll', page, pageSize),
    update: (id: number, data: any) => ipcRenderer.invoke('chat:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('chat:delete', id),
    addMessage: (data: any) => ipcRenderer.invoke('chat:addMessage', data),
    getMessages: (chatId: number) => ipcRenderer.invoke('chat:getMessages', chatId),
    deleteMessage: (id: number) => ipcRenderer.invoke('chat:deleteMessage', id),
    getStatistics: () => ipcRenderer.invoke('chat:getStatistics'),
  },

  // Settings operations
  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: any) => ipcRenderer.invoke('settings:set', key, value),
    delete: (key: string) => ipcRenderer.invoke('settings:delete', key),
    getAll: () => ipcRenderer.invoke('settings:getAll'),
    getLastUsedModelId: () => ipcRenderer.invoke('settings:getLastUsedModelId'),
    setLastUsedModelId: (modelId: number) => 
      ipcRenderer.invoke('settings:setLastUsedModelId', modelId),
  },

  // Collection (Knowledge Base) operations
  collection: {
    create: (data: { name: string; description?: string }) =>
      ipcRenderer.invoke('collection:create', data),
    findAll: () => ipcRenderer.invoke('collection:findAll'),
    findById: (id: number) => ipcRenderer.invoke('collection:findById', id),
    getDocuments: (collectionId: number) =>
      ipcRenderer.invoke('collection:getDocuments', collectionId),
    addDocument: (collectionId: number, data: { content: string; fileName: string }) =>
      ipcRenderer.invoke('collection:addDocument', collectionId, data),
    removeDocument: (documentId: number) =>
      ipcRenderer.invoke('collection:removeDocument', documentId),
    getDocumentDetail: (documentId: number) =>
      ipcRenderer.invoke('collection:getDocumentDetail', documentId),
    getConfig: (collectionId: number) =>
      ipcRenderer.invoke('collection:getConfig', collectionId),
    setConfig: (collectionId: number, config: any) =>
      ipcRenderer.invoke('collection:setConfig', collectionId, config),
    getDocumentsWithStatus: (collectionId: number) =>
      ipcRenderer.invoke('collection:getDocumentsWithStatus', collectionId),
    parseDocument: (documentId: number, parserConfig: any) =>
      ipcRenderer.invoke('collection:parseDocument', documentId, parserConfig),
    embedDocument: (documentId: number, embeddingModelId: number) =>
      ipcRenderer.invoke('collection:embedDocument', documentId, embeddingModelId),
    processDocument: (documentId: number, collectionConfig: any) =>
      ipcRenderer.invoke('collection:processDocument', documentId, collectionConfig),
    processAll: (collectionId: number, collectionConfig: any) =>
      ipcRenderer.invoke('collection:processAll', collectionId, collectionConfig),
    delete: (id: number) => ipcRenderer.invoke('collection:delete', id),
    retrieve: (collectionId: number, query: string, topK: number) =>
      ipcRenderer.invoke('collection:retrieve', collectionId, query, topK),
    retrieveChunks: (collectionId: number, query: string, topK: number) =>
      ipcRenderer.invoke('collection:retrieveChunks', collectionId, query, topK),
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
