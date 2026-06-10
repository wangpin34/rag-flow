import type { Model, Prisma } from '@prisma/client';
import { prismaService } from './prisma.service';

class ModelService {
  /**
   * Create a new model
   */
  async create(data: Prisma.ModelCreateInput): Promise<Model> {
    return prismaService.db.model.create({
      data,
      include: {
        provider: true,
      },
    });
  }

  /**
   * Get a model by ID
   */
  async findById(id: number) {
    return prismaService.db.model.findUnique({
      where: { id },
      include: {
        provider: true,
      },
    });
  }

  /**
   * Get a model by provider and name
   */
  async findByProviderAndName(providerId: number, name: string) {
    return prismaService.db.model.findUnique({
      where: {
        providerId_name: {
          providerId,
          name,
        },
      },
      include: {
        provider: true,
      },
    });
  }

  /**
   * Get all models
   */
  async findAll(options?: {
    includeInactive?: boolean;
    providerId?: number;
    modelType?: string;
  }) {
    const where: Prisma.ModelWhereInput = {};

    if (!options?.includeInactive) {
      where.isActive = true;
    }

    if (options?.providerId) {
      where.providerId = options.providerId;
    }

    if (options?.modelType) {
      where.modelType = options.modelType;
    }

    return prismaService.db.model.findMany({
      where,
      include: {
        provider: true,
      },
      orderBy: [
        { provider: { name: 'asc' } },
        { name: 'asc' },
      ],
    });
  }

  /**
   * Get models by provider ID
   */
  async findByProviderId(providerId: number, includeInactive = false) {
    return prismaService.db.model.findMany({
      where: {
        providerId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: {
        provider: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  /**
   * Get models by type (embedding, chat, completion)
   */
  async findByType(modelType: string, includeInactive = false) {
    return prismaService.db.model.findMany({
      where: {
        modelType,
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: {
        provider: true,
      },
      orderBy: [
        { provider: { name: 'asc' } },
        { name: 'asc' },
      ],
    });
  }

  /**
   * Get all embedding models
   */
  async findEmbeddingModels(includeInactive = false) {
    return this.findByType('embedding', includeInactive);
  }

  /**
   * Get all chat models
   */
  async findChatModels(includeInactive = false) {
    return this.findByType('chat', includeInactive);
  }

  /**
   * Update a model
   */
  async update(id: number, data: Prisma.ModelUpdateInput): Promise<Model> {
    return prismaService.db.model.update({
      where: { id },
      data,
      include: {
        provider: true,
      },
    });
  }

  /**
   * Delete a model
   */
  async delete(id: number): Promise<Model> {
    return prismaService.db.model.delete({
      where: { id },
    });
  }

  /**
   * Toggle model active status
   */
  async toggleActive(id: number): Promise<Model> {
    const model = await this.findById(id);
    if (!model) {
      throw new Error(`Model with id ${id} not found`);
    }
    return this.update(id, { isActive: !model.isActive });
  }

  /**
   * Get model statistics
   */
  async getStatistics() {
    const [totalModels, activeModels, byType] = await Promise.all([
      prismaService.db.model.count(),
      prismaService.db.model.count({ where: { isActive: true } }),
      prismaService.db.model.groupBy({
        by: ['modelType'],
        _count: true,
      }),
    ]);

    const modelsByType = byType.reduce(
      (acc, item) => {
        acc[item.modelType] = item._count;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      totalModels,
      activeModels,
      inactiveModels: totalModels - activeModels,
      modelsByType,
    };
  }
}

export const modelService = new ModelService();
