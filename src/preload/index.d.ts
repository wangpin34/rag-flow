import { ElectronAPI } from '@electron-toolkit/preload';

declare global {
  interface Window {
    electron: ElectronAPI;
    api: {
      document: {
        create: (data: any) => Promise<any>;
        findById: (id: number) => Promise<any>;
        findMany: (page: number, pageSize: number) => Promise<any>;
        search: (query: string) => Promise<any[]>;
        update: (id: number, data: any) => Promise<any>;
        delete: (id: number) => Promise<any>;
        getStatistics: () => Promise<any>;
      };
      vector: {
        insertEmbedding: (documentId: number, embedding: number[]) => Promise<void>;
        searchSimilar: (queryEmbedding: number[], limit: number) => Promise<Array<{ document_id: number; distance: number }>>;
        hasEmbedding: (documentId: number) => Promise<boolean>;
        deleteEmbedding: (documentId: number) => Promise<void>;
        getEmbeddingCount: () => Promise<number>;
      };
      provider: {
        create: (data: any) => Promise<any>;
        findById: (id: number) => Promise<any>;
        findByName: (name: string) => Promise<any>;
        findAll: (includeInactive?: boolean) => Promise<any[]>;
        update: (id: number, data: any) => Promise<any>;
        delete: (id: number) => Promise<any>;
        toggleActive: (id: number) => Promise<any>;
        getStatistics: () => Promise<any>;
        listModels: (providerId: number, apiKey?: string) => Promise<any>;
      };
      model: {
        create: (data: any) => Promise<any>;
        findById: (id: number) => Promise<any>;
        findByProviderAndName: (providerId: number, name: string) => Promise<any>;
        findAll: (options?: any) => Promise<any[]>;
        findByProviderId: (providerId: number, includeInactive?: boolean) => Promise<any[]>;
        findByType: (modelType: string, includeInactive?: boolean) => Promise<any[]>;
        findEmbeddingModels: (includeInactive?: boolean) => Promise<any[]>;
        findChatModels: (includeInactive?: boolean) => Promise<any[]>;
        update: (id: number, data: any) => Promise<any>;
        delete: (id: number) => Promise<any>;
        toggleActive: (id: number) => Promise<any>;
        getStatistics: () => Promise<any>;
      };
      chat: {
        create: (data: any) => Promise<any>;
        findById: (id: number) => Promise<any>;
        findAll: (page?: number, pageSize?: number) => Promise<any>;
        update: (id: number, data: any) => Promise<any>;
        delete: (id: number) => Promise<any>;
        addMessage: (data: any) => Promise<any>;
        getMessages: (chatId: number) => Promise<any[]>;
        deleteMessage: (id: number) => Promise<any>;
        getStatistics: () => Promise<any>;
      };
      settings: {
        get: (key: string) => Promise<any>;
        set: (key: string, value: any) => Promise<any>;
        delete: (key: string) => Promise<any>;
        getAll: () => Promise<Record<string, any>>;
        getLastUsedModelId: () => Promise<number | null>;
        setLastUsedModelId: (modelId: number) => Promise<any>;
      };
      collection: {
        create: (data: { name: string; description?: string }) => Promise<any>;
        findAll: () => Promise<Array<{ id: number; name: string; description: string | null; createdAt: string; updatedAt: string; documentCount: number }>>;
        findById: (id: number) => Promise<any>;
        getDocuments: (collectionId: number) => Promise<Array<{ id: number; source: string | null; createdAt: string }>>;
        addDocument: (collectionId: number, data: { content: string; fileName: string }) => Promise<any>;
        removeDocument: (documentId: number) => Promise<any>;
        getDocumentDetail: (documentId: number) => Promise<{
          id: number;
          content: string;
          source: string | null;
          metadata: string | null;
          createdAt: string;
          updatedAt: string;
          chunks: Array<{ id: number; chunkIndex: number; content: string; metadata: string | null; createdAt: string }>;
        } | null>;
        getConfig: (collectionId: number) => Promise<{
          parser: { strategy: 'paragraph' | 'fixed-size' | 'sentence'; chunkSize: number; chunkOverlap: number };
          embeddingModelId: number | null;
          rerankModelId: number | null;
          autoProcess: boolean;
        }>;
        setConfig: (collectionId: number, config: any) => Promise<void>;
        getDocumentsWithStatus: (collectionId: number) => Promise<Array<{
          id: number; source: string | null; createdAt: string;
          parsed: boolean; parsedAt: string | null; chunkCount: number;
          embedded: boolean; embeddedAt: string | null; error: string | null;
        }>>;
        parseDocument: (documentId: number, parserConfig: any) => Promise<{ chunkCount: number }>;
        embedDocument: (documentId: number, embeddingModelId: number) => Promise<void>;
        processDocument: (documentId: number, collectionConfig: any) => Promise<void>;
        processAll: (collectionId: number, collectionConfig: any) => Promise<{ processed: number; errors: number }>;
        delete: (id: number) => Promise<any>;
      };
    };
  }
}
