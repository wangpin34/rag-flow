import { prismaService } from '../repository/prisma.service';
import { providerApiService } from './provider-api.service';
import { vectorDatabaseService } from './vector-database.service';

export interface ParserConfig {
  strategy: 'paragraph' | 'fixed-size' | 'sentence';
  chunkSize: number;
  chunkOverlap: number;
}

export interface CollectionConfig {
  parser: ParserConfig;
  embeddingModelId: number | null;
  rerankModelId: number | null;
  autoProcess: boolean;
  retrieveTopK: number;
}

export const DEFAULT_COLLECTION_CONFIG: CollectionConfig = {
  parser: { strategy: 'paragraph', chunkSize: 1000, chunkOverlap: 200 },
  embeddingModelId: null,
  rerankModelId: null,
  autoProcess: false,
  retrieveTopK: 4,
};

class DocumentProcessorService {
  private splitByParagraph(text: string, chunkSize: number, overlap: number): string[] {
    const paragraphs = text.split(/\n\n+/).filter((p) => p.trim());
    const chunks: string[] = [];
    let current = '';
    for (const para of paragraphs) {
      const candidate = current ? `${current}\n\n${para}` : para;
      if (candidate.length > chunkSize && current) {
        chunks.push(current.trim());
        const tail = current.length > overlap ? current.slice(-overlap) : current;
        current = `${tail}\n\n${para}`;
      } else {
        current = candidate;
      }
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks;
  }

  private splitByFixedSize(text: string, chunkSize: number, overlap: number): string[] {
    const chunks: string[] = [];
    const step = Math.max(1, chunkSize - overlap);
    for (let i = 0; i < text.length; i += step) {
      const slice = text.slice(i, i + chunkSize).trim();
      if (slice) chunks.push(slice);
    }
    return chunks;
  }

  private splitBySentence(text: string, chunkSize: number, overlap: number): string[] {
    const sentences = text.match(/[^.!?\n]+[.!?\n]+/g) ?? [text];
    const chunks: string[] = [];
    let current = '';
    for (const sentence of sentences) {
      const candidate = current ? `${current} ${sentence}` : sentence;
      if (candidate.length > chunkSize && current) {
        chunks.push(current.trim());
        const tail = current.length > overlap ? current.slice(-overlap) : current;
        current = `${tail} ${sentence}`;
      } else {
        current = candidate;
      }
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks;
  }

  splitText(content: string, config: ParserConfig): string[] {
    switch (config.strategy) {
      case 'paragraph':
        return this.splitByParagraph(content, config.chunkSize, config.chunkOverlap);
      case 'fixed-size':
        return this.splitByFixedSize(content, config.chunkSize, config.chunkOverlap);
      case 'sentence':
        return this.splitBySentence(content, config.chunkSize, config.chunkOverlap);
    }
  }

  async parseDocument(documentId: number, config: ParserConfig): Promise<{ chunkCount: number }> {
    const doc = await prismaService.db.document.findUnique({ where: { id: documentId } });
    if (!doc) throw new Error(`Document ${documentId} not found`);

    const chunkTexts = this.splitText(doc.content, config);

    await prismaService.db.chunk.deleteMany({ where: { documentId } });
    await prismaService.db.chunk.createMany({
      data: chunkTexts.map((content, idx) => ({ documentId, content, chunkIndex: idx })),
    });

    const meta = this._parseMeta(doc.metadata);
    Object.assign(meta, {
      parsed: true,
      parsedAt: new Date().toISOString(),
      chunkCount: chunkTexts.length,
      parseStrategy: config.strategy,
      error: undefined,
    });

    await prismaService.db.document.update({
      where: { id: documentId },
      data: { metadata: JSON.stringify(meta) },
    });

    return { chunkCount: chunkTexts.length };
  }

  async embedDocument(documentId: number, embeddingModelId: number, onProgress?: (current: number, total: number) => void): Promise<void> {
    const doc = await prismaService.db.document.findUnique({
      where: { id: documentId },
      include: { chunks: { orderBy: { chunkIndex: 'asc' } } },
    });
    if (!doc) throw new Error(`Document ${documentId} not found`);
    if (!doc.chunks.length) throw new Error(`Document ${documentId} has no chunks — parse it first`);

    const model = await prismaService.db.model.findUnique({
      where: { id: embeddingModelId },
      include: { provider: true },
    });
    if (!model) throw new Error(`Embedding model ${embeddingModelId} not found`);

    const apiKey = model.provider.apiKey || (model.provider.apiKeyName ? process.env[model.provider.apiKeyName] : undefined);
    const providerInfo = { name: model.provider.name, apiEndpoint: model.provider.apiEndpoint };

    // Delete existing chunk embeddings for this document before re-embedding
    vectorDatabaseService.deleteEmbeddingsBatch([documentId]);

    // Embed each chunk individually
    const chunkEmbeddings: Array<{ chunkId: number; documentId: number; embedding: number[] }> = [];
    const total = doc.chunks.length;
    for (let i = 0; i < total; i++) {
      const chunk = doc.chunks[i];
      const embedding = await providerApiService.generateEmbedding(
        providerInfo,
        model.name,
        chunk.content,
        apiKey,
      );
      chunkEmbeddings.push({ chunkId: chunk.id, documentId, embedding });
      onProgress?.(i + 1, total);
    }

    vectorDatabaseService.insertEmbeddingsBatch(chunkEmbeddings);

    const meta = this._parseMeta(doc.metadata);
    Object.assign(meta, {
      embedded: true,
      embeddedAt: new Date().toISOString(),
      embeddingModelId,
      embeddedChunks: doc.chunks.length,
      error: undefined,
    });

    await prismaService.db.document.update({
      where: { id: documentId },
      data: { metadata: JSON.stringify(meta) },
    });
  }

  async processDocument(documentId: number, config: CollectionConfig, onProgress?: (documentId: number, current: number, total: number) => void): Promise<void> {
    try {
      await this.parseDocument(documentId, config.parser);
      if (config.embeddingModelId) {
        await this.embedDocument(documentId, config.embeddingModelId, (current, total) => onProgress?.(documentId, current, total));
      }
    } catch (err: any) {
      const doc = await prismaService.db.document.findUnique({ where: { id: documentId } });
      if (doc) {
        const meta = this._parseMeta(doc.metadata);
        meta.error = err?.message ?? 'Unknown error';
        await prismaService.db.document.update({
          where: { id: documentId },
          data: { metadata: JSON.stringify(meta) },
        });
      }
      throw err;
    }
  }

  async processAll(collectionId: number, config: CollectionConfig, onProgress?: (documentId: number, current: number, total: number) => void): Promise<{ processed: number; errors: number }> {
    const docs = await prismaService.db.document.findMany({
      where: { metadata: { contains: `"collectionId":${collectionId}` } },
      select: { id: true },
    });

    let processed = 0;
    let errors = 0;
    for (const doc of docs) {
      try {
        await this.processDocument(doc.id, config, onProgress);
        processed++;
      } catch {
        errors++;
      }
    }
    return { processed, errors };
  }

  private _parseMeta(raw: string | null): Record<string, any> {
    try {
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }
}

export const documentProcessorService = new DocumentProcessorService();
