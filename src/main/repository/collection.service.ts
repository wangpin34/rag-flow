import type { Collection } from '@prisma/client';
import { prismaService } from './prisma.service';

class CollectionService {
  async create(data: { name: string; description?: string | null }): Promise<Collection> {
    return prismaService.db.collection.create({
      data: { name: data.name, description: data.description ?? null },
    });
  }

  async findAll(): Promise<(Collection & { documentCount: number })[]> {
    const collections = await prismaService.db.collection.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return Promise.all(
      collections.map(async (col) => ({
        ...col,
        documentCount: await prismaService.db.document.count({
          where: { metadata: { contains: `"collectionId":${col.id}` } },
        }),
      }))
    );
  }

  async findById(id: number): Promise<Collection | null> {
    return prismaService.db.collection.findUnique({ where: { id } });
  }

  async getDocuments(collectionId: number) {
    return prismaService.db.document.findMany({
      where: { metadata: { contains: `"collectionId":${collectionId}` } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, source: true, createdAt: true },
    });
  }

  async addDocument(collectionId: number, data: { content: string; fileName: string }) {
    return prismaService.db.document.create({
      data: {
        content: data.content,
        source: data.fileName,
        metadata: JSON.stringify({ collectionId, fileName: data.fileName }),
      },
    });
  }

  async removeDocument(documentId: number) {
    return prismaService.db.document.delete({ where: { id: documentId } });
  }

  async delete(id: number): Promise<Collection> {
    // Remove linked documents first
    await prismaService.db.document.deleteMany({
      where: { metadata: { contains: `"collectionId":${id}` } },
    });
    return prismaService.db.collection.delete({ where: { id } });
  }
}

export const collectionService = new CollectionService();
