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
    };
  }
}
