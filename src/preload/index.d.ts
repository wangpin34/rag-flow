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
    };
  }
}
