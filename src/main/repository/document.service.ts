import type { Chunk, Document, Prisma } from '@prisma/client';
import { prismaService } from './prisma.service';

class DocumentService {
  /**
   * Create a new document with optional chunks
   */
  async create(data: {
    content: string;
    metadata?: Record<string, any>;
    source?: string;
    chunks?: { content: string; chunkIndex: number; metadata?: Record<string, any> }[];
  }): Promise<Document & { chunks: Chunk[] }> {
    return prismaService.db.document.create({
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
  async findById(id: number): Promise<(Document & { chunks: Chunk[] }) | null> {
    return prismaService.db.document.findUnique({
      where: { id },
      include: { chunks: { orderBy: { chunkIndex: 'asc' } } },
    });
  }

  /**
   * Get all documents with pagination
   */
  async findMany(page: number = 1, pageSize: number = 10) {
    const skip = (page - 1) * pageSize;
    
    const [documents, total] = await Promise.all([
      prismaService.db.document.findMany({
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { chunks: true },
      }),
      prismaService.db.document.count(),
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
  async search(query: string): Promise<Document[]> {
    return prismaService.db.document.findMany({
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
  async update(
    id: number,
    data: Prisma.DocumentUpdateInput
  ): Promise<Document> {
    return prismaService.db.document.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete a document and all its chunks (cascading delete)
   */
  async delete(id: number): Promise<Document> {
    return prismaService.db.document.delete({
      where: { id },
    });
  }

  /**
   * Get document statistics
   */
  async getStatistics() {
    const [documentCount, chunkCount] = await Promise.all([
      prismaService.db.document.count(),
      prismaService.db.chunk.count(),
    ]);

    return {
      totalDocuments: documentCount,
      totalChunks: chunkCount,
      averageChunksPerDocument: documentCount > 0 ? chunkCount / documentCount : 0,
    };
  }

  /**
   * Create many documents
   */
  async createMany(data: Prisma.DocumentCreateManyInput[]) {
    return prismaService.db.document.createMany({ data });
  }
}

export const documentService = new DocumentService();
