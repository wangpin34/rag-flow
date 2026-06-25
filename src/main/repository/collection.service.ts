import type { Collection } from '@prisma/client';
import { DEFAULT_COLLECTION_CONFIG, type CollectionConfig } from '../lib/document-processor.service';
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

  async getDocumentDetail(documentId: number) {
    return prismaService.db.document.findUnique({
      where: { id: documentId },
      include: {
        chunks: { orderBy: { chunkIndex: 'asc' } },
      },
    });
  }

  async delete(id: number): Promise<Collection> {
    // Remove linked documents first
    await prismaService.db.document.deleteMany({
      where: { metadata: { contains: `"collectionId":${id}` } },
    });
    // Clean up config setting
    await prismaService.db.settings.deleteMany({
      where: { key: `collection_config_${id}` },
    });
    return prismaService.db.collection.delete({ where: { id } });
  }

  async getConfig(collectionId: number): Promise<CollectionConfig> {
    const setting = await prismaService.db.settings.findUnique({
      where: { key: `collection_config_${collectionId}` },
    });
    if (!setting) return { ...DEFAULT_COLLECTION_CONFIG };
    try {
      return JSON.parse(setting.value) as CollectionConfig;
    } catch {
      return { ...DEFAULT_COLLECTION_CONFIG };
    }
  }

  async setConfig(collectionId: number, config: CollectionConfig): Promise<void> {
    await prismaService.db.settings.upsert({
      where: { key: `collection_config_${collectionId}` },
      create: { key: `collection_config_${collectionId}`, value: JSON.stringify(config) },
      update: { value: JSON.stringify(config) },
    });
  }

  async getDocumentsWithStatus(collectionId: number) {
    const docs = await prismaService.db.document.findMany({
      where: { metadata: { contains: `"collectionId":${collectionId}` } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, source: true, createdAt: true, metadata: true },
    });

    return docs.map((doc) => {
      let meta: Record<string, any> = {};
      try {
        meta = doc.metadata ? JSON.parse(doc.metadata) : {};
      } catch {
        meta = {};
      }
      return {
        id: doc.id,
        source: doc.source,
        createdAt: doc.createdAt,
        parsed: meta.parsed ?? false,
        parsedAt: meta.parsedAt ?? null,
        chunkCount: meta.chunkCount ?? 0,
        embedded: meta.embedded ?? false,
        embeddedAt: meta.embeddedAt ?? null,
        error: meta.error ?? null,
      };
    });
  }
}

export const collectionService = new CollectionService();
