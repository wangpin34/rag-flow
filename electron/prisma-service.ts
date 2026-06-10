import type { Chunk, Collection, Document, QueryHistory } from '@prisma/client';
import prisma from './prisma-client';

/**
 * Document Service for managing documents with Prisma
 */
export class DocumentService {
  /**
   * Create a new document with optional chunks
   */
  async createDocument(data: {
    content: string;
    metadata?: Record<string, any>;
    source?: string;
    chunks?: { content: string; chunkIndex: number; metadata?: Record<string, any> }[];
  }): Promise<Document> {
    return prisma.document.create({
      data: {
        content: data.content,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        source: data.source,
        chunks: data.chunks
          ? {
              create: data.chunks.map((chunk) => ({
                content: chunk.content,
                chunkIndex: chunk.chunkIndex,
                metadata: chunk.metadata ? JSON.stringify(chunk.metadata) : null,
              })),
            }
          : undefined,
      },
      include: {
        chunks: true,
      },
    });
  }

  /**
   * Get a document by ID with its chunks
   */
  async getDocument(id: number): Promise<(Document & { chunks: Chunk[] }) | null> {
    return prisma.document.findUnique({
      where: { id },
      include: { chunks: { orderBy: { chunkIndex: 'asc' } } },
    });
  }

  /**
   * Get all documents with pagination
   */
  async getDocuments(page: number = 1, pageSize: number = 10) {
    const skip = (page - 1) * pageSize;
    
    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { chunks: true },
      }),
      prisma.document.count(),
    ]);

    return {
      documents,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Search documents by content
   */
  async searchDocuments(query: string): Promise<Document[]> {
    return prisma.document.findMany({
      where: {
        OR: [
          { content: { contains: query } },
          { source: { contains: query } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Update document
   */
  async updateDocument(
    id: number,
    data: {
      content?: string;
      metadata?: Record<string, any>;
      source?: string;
    }
  ): Promise<Document> {
    return prisma.document.update({
      where: { id },
      data: {
        content: data.content,
        metadata: data.metadata ? JSON.stringify(data.metadata) : undefined,
        source: data.source,
      },
    });
  }

  /**
   * Delete a document and all its chunks (cascading delete)
   */
  async deleteDocument(id: number): Promise<Document> {
    return prisma.document.delete({
      where: { id },
    });
  }

  /**
   * Get document statistics
   */
  async getStatistics() {
    const [documentCount, chunkCount] = await Promise.all([
      prisma.document.count(),
      prisma.chunk.count(),
    ]);

    return {
      totalDocuments: documentCount,
      totalChunks: chunkCount,
      averageChunksPerDocument: documentCount > 0 ? chunkCount / documentCount : 0,
    };
  }
}

/**
 * Collection Service for organizing documents
 */
export class CollectionService {
  /**
   * Create a new collection
   */
  async createCollection(name: string, description?: string): Promise<Collection> {
    return prisma.collection.create({
      data: { name, description },
    });
  }

  /**
   * Get all collections
   */
  async getCollections(): Promise<Collection[]> {
    return prisma.collection.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get a collection by name
   */
  async getCollectionByName(name: string): Promise<Collection | null> {
    return prisma.collection.findUnique({
      where: { name },
    });
  }

  /**
   * Delete a collection
   */
  async deleteCollection(id: number): Promise<Collection> {
    return prisma.collection.delete({
      where: { id },
    });
  }
}

/**
 * Query History Service for tracking searches
 */
export class QueryHistoryService {
  /**
   * Save a query to history
   */
  async saveQuery(query: string, results?: any[]): Promise<QueryHistory> {
    return prisma.queryHistory.create({
      data: {
        query,
        results: results ? JSON.stringify(results) : null,
      },
    });
  }

  /**
   * Get recent queries
   */
  async getRecentQueries(limit: number = 10): Promise<QueryHistory[]> {
    return prisma.queryHistory.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Clear query history
   */
  async clearHistory(): Promise<void> {
    await prisma.queryHistory.deleteMany();
  }
}

// Export singleton instances
export const documentService = new DocumentService();
export const collectionService = new CollectionService();
export const queryHistoryService = new QueryHistoryService();
